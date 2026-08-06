import type { Metadata } from "next";
import { getProfile, getProjects, getSkills } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { SITE_URL, SERVICES } from "@/lib/site";
import { Page, PageHead, Stat, ArrowLink, Tag } from "@/components/ui";

export const metadata: Metadata = {
  title: "Hire — freelance RAG, AI agents & backend architecture",
  description:
    "Freelance and consulting engagements in RAG pipeline design and evaluation, AI agents, vector search with Qdrant, Azure OpenAI, and AWS/Azure API platform architecture. Based in India, working worldwide.",
  keywords: [
    "hire freelance RAG developer",
    "generative AI consultant India",
    "LLM engineer for hire",
    "vector search consultant",
    "Qdrant expert",
    "Azure OpenAI consultant",
    "FastAPI freelance developer",
    "NestJS consultant",
    "AI agent developer",
  ],
  alternates: { canonical: "/hire" },
  openGraph: {
    title: "Hire Gaurav Kumar — freelance GenAI & backend engineering",
    description:
      "RAG pipelines that are evaluated rather than demoed, AI agents whose output can be validated, and the cloud architecture underneath.",
    url: `${SITE_URL}/hire`,
  },
};

const FAQ = [
  {
    q: "What kind of engagements do you take?",
    a: "Scoped project work and fractional consulting. Most engagements start with a two-week diagnostic — I look at what exists, build the evaluation harness if there isn't one, and come back with a written plan and the numbers behind it. That way you find out whether the rest of the work is worth commissioning before you commit to it.",
  },
  {
    q: "Do you work with teams already building on LLMs?",
    a: "That's most of the work. The usual pattern is a RAG system that demos well and performs badly, with no way to tell whether any change helps. The first job is a labelled eval set from real queries; the second is hybrid retrieval and reranking measured against it. The improvement is usually in the reranker and the chunking, not the embedding model.",
  },
  {
    q: "Which cloud do you work in?",
    a: "Azure and AWS, both in production. On Azure that means APIM, Azure OpenAI, Managed Identity and Microsoft Fabric; on AWS it means Lambda, Fargate, ECS/EKS, SQS and EventBridge. I write the identity model and gateway decisions down with the rejected alternatives, so the choice stays reviewable after I leave.",
  },
  {
    q: "How do you handle timezones?",
    a: "Based in India (IST, UTC+5:30) and used to overlapping with both European and US mornings. Every engagement I've run remotely has been asynchronous by default, with the architecture written down rather than explained in a call.",
  },
  {
    q: "What does a finished engagement leave behind?",
    a: "Working code, an evaluation harness you can run yourself, architecture and data-flow diagrams, and a decision record listing the options considered and rejected. If your next engineer can't review my reasoning without me in the room, I haven't finished.",
  },
];

export default async function HirePage() {
  markRoute("/hire");
  const [profile, projects, skills] = await Promise.all([
    getProfile(),
    getProjects(),
    getSkills(),
  ]);
  const techCount = new Set(Object.values(skills).flat()).size;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <Page>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <PageHead
        label="freelance & consulting"
        title="RAG systems that are measured, not demoed."
        lede={`${profile.yearsExperience} years building generative AI and backend systems in production — retrieval pipelines, AI agents, vector search and the cloud architecture that keeps them upright. Available for scoped project work and fractional consulting, worldwide.`}
        aside={
          <div className="grid grid-cols-3 gap-6 lg:grid-cols-1 lg:gap-4">
            <Stat value={profile.yearsExperience} label="years in production" tone="signal" />
            <Stat value={String(projects.length)} label="systems documented" />
            <Stat value={String(techCount)} label="technologies" />
          </div>
        }
      />

      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <h2 className="mono mb-8" style={{ color: "var(--faint)" }}>
          what I take on
        </h2>
        <div className="grid gap-10 md:grid-cols-2">
          {SERVICES.map((s) => (
            <div key={s.id}>
              <h3 className="text-[17px] font-medium tracking-tight">{s.name}</h3>
              <p className="mt-2 max-w-[52ch] text-[14.5px]" style={{ color: "var(--dim)" }}>
                {s.summary}
              </p>
              <ul className="mt-4 space-y-1.5">
                {s.deliverables.map((d) => (
                  <li key={d} className="flex gap-2.5 text-[13.5px]" style={{ color: "var(--dim)" }}>
                    <span style={{ color: "var(--signal)" }} aria-hidden>
                      →
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <h2 className="mono mb-6" style={{ color: "var(--faint)" }}>
          proof, not adjectives
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((p) => (
            <a
              key={p.slug}
              href={`/work/${p.slug}`}
              className="row block border-b py-4 pl-4"
              style={{ borderColor: "var(--line)" }}
            >
              <p className="text-[15px] font-medium">{p.name}</p>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--dim)" }}>
                {p.tagline}
              </p>
              <p className="num mt-2 text-[13px]" style={{ color: "var(--signal)" }}>
                {p.metrics[0]?.value} <span style={{ color: "var(--faint)" }}>{p.metrics[0]?.label.toLowerCase()}</span>
              </p>
            </a>
          ))}
        </div>
        <p className="prose-body mt-8">
          Every case study lists the trade-off that was accepted, not just the win.
          The <a href="/decisions">decision log</a> shows the options each choice beat.
          If you want to interrogate any of it, <a href="/ask">/ask</a> runs real
          retrieval over the whole corpus and shows you its sources.
        </p>
      </section>

      <section className="border-b py-12" style={{ borderColor: "var(--line)" }}>
        <h2 className="mono mb-7" style={{ color: "var(--faint)" }}>
          common questions
        </h2>
        <div className="max-w-[74ch] space-y-7">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="text-[15.5px] font-medium">{f.q}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--dim)" }}>
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="pulse-dot" aria-hidden />
          <span className="mono" style={{ color: "var(--signal)" }}>
            {profile.availability}
          </span>
        </div>
        <h2 className="display max-w-[16ch]">Tell me what&rsquo;s not working.</h2>
        <p className="prose-body mt-5">
          The most useful first message describes the system you have and the thing
          it won&rsquo;t do. No brief required — I&rsquo;ll tell you honestly whether
          it&rsquo;s work I&rsquo;m the right person for.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
          <ArrowLink href={`mailto:${profile.email}`}>{profile.email}</ArrowLink>
          <ArrowLink href="/resume">Résumé</ArrowLink>
          <ArrowLink href="/work">Case studies</ArrowLink>
        </div>
        <div className="mt-8 flex flex-wrap gap-1.5">
          {Object.values(skills).flat().slice(0, 22).map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </div>
      </section>
    </Page>
  );
}
