import { getSupabaseServerClient } from "@/lib/supabase/server";
import UploadCard from "@/components/upload-card";
import DashboardRefresh from "@/components/dashboard-refresh";
import type { ExtractedRfp } from "@/types/rfp";
import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";

type RfpListItem = Pick<ExtractedRfp, "id" | "file_name" | "status" | "deadline" | "created_at">;

async function getRfps(): Promise<RfpListItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data: rfps } = await supabase
    .from("rfps")
    .select("id, file_name, status, deadline, created_at")
    .order("created_at", { ascending: false });

  return (rfps as RfpListItem[]) || [];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processing: "bg-blue-100 text-blue-800",
    complete: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] || "bg-slate-100 text-slate-800"}`}
    >
      {status === "processing" && (
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      )}
      {status}
    </span>
  );
}

export default async function Dashboard() {
  const rfps = await getRfps();
  const hasProcessing = rfps.some((r) => r.status === "processing");

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardRefresh hasProcessing={hasProcessing} />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">RFP Structurer</p>
            <h1 className="text-lg font-semibold text-slate-900">Compliance workspace</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">RFPs</h2>
            <p className="text-sm text-slate-600">
              Upload PDFs to extract deadlines and compliance requirements. AI-generated outputs
              require human review.
            </p>
          </div>
          <UploadCard />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-5 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>File</span>
            <span>Status</span>
            <span>Deadline</span>
            <span>Uploaded</span>
            <span></span>
          </div>
          {rfps.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No uploads yet.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rfps.map((rfp) => (
                <li key={rfp.id} className="grid grid-cols-5 items-center px-4 py-3 text-sm text-slate-800">
                  <span className="truncate">{rfp.file_name}</span>
                  <span><StatusBadge status={rfp.status} /></span>
                  <span className="text-slate-700">{rfp.deadline || "—"}</span>
                  <span className="text-slate-700">
                    {rfp.created_at ? new Date(rfp.created_at).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-right">
                    <Link
                      href={`/rfps/${rfp.id}`}
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Open
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
