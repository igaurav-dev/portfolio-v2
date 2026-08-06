export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://igaurav.dev"
).replace(/\/$/, "");

/** Keywords a freelance client would actually type. */
export const SERVICE_KEYWORDS = [
  "freelance generative AI engineer",
  "RAG pipeline consultant",
  "hire RAG developer",
  "LLM application developer",
  "vector search engineer",
  "Qdrant consultant",
  "Azure OpenAI consultant",
  "FastAPI backend developer",
  "NestJS developer for hire",
  "AWS serverless architect",
  "AI agent development",
  "freelance full stack developer India",
];

export const SERVICES = [
  {
    id: "rag",
    name: "RAG pipeline design and evaluation",
    summary:
      "Retrieval that can be measured rather than demoed — an eval set, hybrid retrieval, reranking, and a refusal path so it stops guessing when the corpus does not cover the question.",
    deliverables: [
      "Labelled evaluation set built from your real queries",
      "Hybrid retrieval with reranking, benchmarked against your baseline",
      "Grounded citations that resolve to a location a human can check",
      "A refusal path, and the numbers that show it working",
    ],
  },
  {
    id: "agents",
    name: "AI agents and document intelligence",
    summary:
      "Agents that produce artefacts a deterministic system can validate — a query, a config, a structured extraction — rather than prose nobody can check.",
    deliverables: [
      "Scoped document QA that answers only from supplied sources",
      "Structured extraction with schema validation and repair loops",
      "Tool-use orchestration with LangGraph or LangChain",
      "Cost and latency instrumentation per step",
    ],
  },
  {
    id: "architecture",
    name: "Cloud and API platform architecture",
    summary:
      "Azure or AWS platform design with the identity model, gateway choice and capacity sizing written down alongside the options that were rejected.",
    deliverables: [
      "Architecture and data-flow diagrams signed off before provisioning",
      "Gateway, identity and quota design (APIM, Managed Identity, per-tenant limits)",
      "Measurable SLAs — throughput, latency, per-tenant quota",
      "A decision record your next engineer can actually review",
    ],
  },
  {
    id: "backend",
    name: "Backend systems and cost reduction",
    summary:
      "Python, FastAPI, NestJS and Node services on AWS or Azure, with the queueing, backpressure and observability that keep them upright — and a hard look at the bill.",
    deliverables: [
      "Service design with explicit backpressure and load-shedding policy",
      "Queue and job orchestration (SQS, EventBridge, BullMQ)",
      "Cloud cost and carbon analysis from Cost & Usage Reports",
      "Tracing on the paths a user actually feels",
    ],
  },
];
