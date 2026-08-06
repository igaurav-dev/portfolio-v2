import { cache } from "react";
import { span } from "./trace";
import {
  getProjects,
  getDecisions,
  getTimeline,
  getProfile,
  getSkills,
} from "./content";

/* ------------------------------------------------------------------
   KNOWLEDGE GRAPH
   Entities and edges derived from the same content the site renders.
   Two jobs: it is explorable at /graph, and it expands retrieval on
   /ask by one hop so a question about a technology can reach the
   projects that used it even when the words never overlap.
   ------------------------------------------------------------------ */

export type NodeType =
  | "person"
  | "company"
  | "project"
  | "tech"
  | "category"
  | "decision";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  /** degree, filled in during build */
  weight: number;
  href?: string;
  detail?: string;
}

export type EdgeRel =
  | "works_at"
  | "built"
  | "uses"
  | "belongs_to"
  | "decided_on"
  | "knows";

export interface GraphEdge {
  source: string;
  target: string;
  rel: EdgeRel;
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacency: Map<string, Set<string>>;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const buildGraph = cache(async (): Promise<Graph> => {
  const [projects, decisions, timeline, profile, skills] = await Promise.all([
    getProjects(),
    getDecisions(),
    getTimeline(),
    getProfile(),
    getSkills(),
  ]);

  return span("graph.build", "compute", () => {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const addNode = (n: Omit<GraphNode, "weight">) => {
      if (!nodes.has(n.id)) nodes.set(n.id, { ...n, weight: 0 });
      return n.id;
    };
    const addEdge = (source: string, target: string, rel: EdgeRel, weight = 1) => {
      if (source === target) return;
      edges.push({ source, target, rel, weight });
    };

    // person
    const me = addNode({
      id: "person:me",
      label: profile.name,
      type: "person",
      href: "/about",
      detail: profile.role,
    });

    // skill categories and technologies
    for (const [category, list] of Object.entries(skills)) {
      const catId = addNode({
        id: `category:${slugify(category)}`,
        label: category,
        type: "category",
        detail: `${list.length} technologies`,
      });
      addEdge(me, catId, "knows");
      for (const tech of list) {
        const techId = addNode({
          id: `tech:${slugify(tech)}`,
          label: tech,
          type: "tech",
        });
        addEdge(techId, catId, "belongs_to");
      }
    }

    // companies from the timeline
    for (const role of timeline) {
      const orgId = addNode({
        id: `company:${slugify(role.org)}`,
        label: role.org,
        type: "company",
        href: "/resume",
        detail: `${role.role} · ${role.period}`,
      });
      addEdge(me, orgId, "works_at", 3);
    }

    // projects, and the technologies they actually used
    for (const project of projects) {
      const projectId = addNode({
        id: `project:${project.slug}`,
        label: project.name,
        type: "project",
        href: `/work/${project.slug}`,
        detail: project.tagline,
      });
      addEdge(me, projectId, "built", 2);

      const orgLabel = project.client.split("·").pop()?.trim() ?? project.client;
      const orgId = `company:${slugify(orgLabel)}`;
      if (nodes.has(orgId)) addEdge(orgId, projectId, "built", 2);

      for (const tech of project.stack) {
        const techId = addNode({
          id: `tech:${slugify(tech)}`,
          label: tech,
          type: "tech",
        });
        addEdge(projectId, techId, "uses");
      }
    }

    // decisions attach to their project
    for (const decision of decisions) {
      const decisionId = addNode({
        id: `decision:${decision.id}`,
        label: decision.title,
        type: "decision",
        href: `/decisions#${decision.id}`,
        detail: decision.decision,
      });
      const projectId = `project:${decision.project}`;
      if (nodes.has(projectId)) addEdge(projectId, decisionId, "decided_on", 2);
    }

    // degree
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    }
    for (const [id, neighbours] of adjacency) {
      const node = nodes.get(id);
      if (node) node.weight = neighbours.size;
    }

    return { nodes: [...nodes.values()], edges, adjacency };
  }, "entities derived from content/, never hand-maintained");
});

/** Neighbours within `depth` hops, excluding the seed. */
export function neighbourhood(
  graph: Graph,
  seed: string,
  depth = 1,
): Set<string> {
  const seen = new Set<string>([seed]);
  let frontier = [seed];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of graph.adjacency.get(id) ?? []) {
        if (!seen.has(neighbour)) {
          seen.add(neighbour);
          next.push(neighbour);
        }
      }
    }
    frontier = next;
  }
  seen.delete(seed);
  return seen;
}

/**
 * Match free text against node labels. Used to seed graph expansion during
 * retrieval — "Qdrant" finds the tech node, which reaches four projects.
 */
export function matchNodes(graph: Graph, text: string): GraphNode[] {
  const haystack = text.toLowerCase();
  return graph.nodes
    .filter((n) => {
      const label = n.label.toLowerCase();
      if (label.length < 3) return false;
      return haystack.includes(label);
    })
    .sort((a, b) => b.label.length - a.label.length)
    .slice(0, 6);
}

export interface GraphStats {
  nodes: number;
  edges: number;
  byType: { type: NodeType; count: number }[];
  density: number;
  mostConnected: GraphNode[];
}

export function graphStats(graph: Graph): GraphStats {
  const byType = new Map<NodeType, number>();
  for (const n of graph.nodes) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
  const n = graph.nodes.length;
  return {
    nodes: n,
    edges: graph.edges.length,
    byType: [...byType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    density: n > 1 ? (2 * graph.edges.length) / (n * (n - 1)) : 0,
    mostConnected: [...graph.nodes].sort((a, b) => b.weight - a.weight).slice(0, 6),
  };
}
