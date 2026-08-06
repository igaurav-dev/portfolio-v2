import type { Metadata } from "next";
import { getExperiments } from "@/lib/content";
import { markRoute } from "@/lib/trace";
import { Page, PageHead, Tag } from "@/components/ui";
import { Backpressure } from "@/components/craft/backpressure";
import { HashRing } from "@/components/craft/hash-ring";
import { LatencyScale } from "@/components/craft/latency-scale";
import { TailLatency } from "@/components/craft/tail-latency";

export const metadata: Metadata = {
  title: "Craft",
  description:
    "Interactive explainers for four ideas that are easy to state and hard to feel.",
};

const WIDGETS: Record<string, React.ComponentType> = {
  backpressure: Backpressure,
  "consistent-hashing": HashRing,
  "latency-numbers": LatencyScale,
  "tail-latency": TailLatency,
};

export default async function CraftPage() {
  markRoute("/craft");
  const experiments = await getExperiments();

  return (
    <Page>
      <PageHead
        label="craft"
        title="Four things that are easy to state and hard to feel."
        lede="I keep having the same conversations at whiteboards. These are the four explanations I got tired of drawing, so I built them instead. Everything runs in your browser — drag something."
      />

      <div className="py-4">
        {experiments.map((e) => {
          const Widget = WIDGETS[e.id];
          return (
            <section
              key={e.id}
              id={e.id}
              className="scroll-mt-24 border-b py-12"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="mb-7 max-w-[62ch]">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-[19px] font-medium tracking-tight">{e.title}</h2>
                  <Tag>{e.kind}</Tag>
                </div>
                <p className="text-[15px]" style={{ color: "var(--dim)" }}>
                  {e.blurb}
                </p>
              </div>
              {Widget ? <Widget /> : null}
            </section>
          );
        })}
      </div>
    </Page>
  );
}
