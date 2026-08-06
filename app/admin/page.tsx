import type { Metadata } from "next";
import { markRoute } from "@/lib/trace";
import { AdminConsole } from "@/components/admin-console";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  markRoute("/admin");
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10">
      <AdminConsole synthesisEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
    </div>
  );
}
