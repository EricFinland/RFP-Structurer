import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ExtractedRfp, Requirement, EvaluationCriterion, KeySection, RfpMetadata } from "@/types/rfp";
import RfpPolling from "@/components/rfp-polling";

async function getRfp(id: string): Promise<ExtractedRfp | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("rfps")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return data || null;
}

export default async function RfpDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rfp = await getRfp(id);
  if (!rfp) {
    notFound();
  }

  const requirements = (rfp.requirements as Requirement[]) || [];
  const evalCriteria = (rfp.evaluation_criteria as EvaluationCriterion[]) || [];
  const keySections = (rfp.key_sections as KeySection[]) || [];
  const meta = (rfp.metadata || {}) as RfpMetadata;
  const mandatoryCount = requirements.filter((r) => r.mandatory).length;
  const errorMessage = rfp.status === "failed" && meta ? (meta as Record<string, unknown>).error as string : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">RFP Structurer</p>
            <h1 className="text-lg font-semibold text-slate-900">{rfp.file_name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Back
            </Link>
            {rfp.status === "complete" && (
              <>
                <Link
                  href={`/api/exports/${rfp.id}/csv`}
                  className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  CSV
                </Link>
                <Link
                  href={`/api/exports/${rfp.id}/excel`}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800 transition hover:bg-emerald-100"
                >
                  Excel
                </Link>
                <Link
                  href={`/api/exports/${rfp.id}/word`}
                  className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 font-semibold text-blue-800 transition hover:bg-blue-100"
                >
                  Word
                </Link>
                <Link
                  href={`/api/exports/${rfp.id}/json`}
                  className="rounded-md bg-slate-900 px-3 py-1.5 font-semibold text-white transition hover:bg-slate-800"
                >
                  JSON
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        {/* Polling component for auto-refresh */}
        <RfpPolling rfpId={rfp.id} status={rfp.status} />

        {/* Error banner */}
        {rfp.status === "failed" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Processing failed</p>
            <p className="text-sm text-red-700">
              {errorMessage || "An error occurred while processing this RFP. Try uploading again."}
            </p>
          </div>
        )}

        {/* Metadata panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Status</p>
              <p className="text-base font-semibold text-slate-900 capitalize">{rfp.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Submission deadline</p>
              <p className="text-base font-semibold text-slate-900">{rfp.deadline || "Not detected"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Requirements</p>
              <p className="text-base font-semibold text-slate-900">
                {requirements.length} total, {mandatoryCount} mandatory
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Uploaded</p>
              <p className="text-base font-semibold text-slate-900">
                {rfp.created_at ? new Date(rfp.created_at).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          {/* Extended metadata */}
          {(meta.issuer || meta.page_limits || meta.formatting_rules) && (
            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {meta.issuer && (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Issuer</p>
                  <p className="font-medium text-slate-900">{meta.issuer}</p>
                </div>
              )}
              {meta.page_limits && (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Page limits</p>
                  <p className="font-medium text-slate-900">{meta.page_limits}</p>
                </div>
              )}
              {meta.formatting_rules && (
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Formatting rules</p>
                  <p className="font-medium text-slate-900">{meta.formatting_rules}</p>
                </div>
              )}
            </div>
          )}

          {meta.notes && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium">Notes:</span> {meta.notes}
            </p>
          )}
        </div>

        {/* Required Attachments */}
        {meta.required_attachments && meta.required_attachments.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Required Attachments</h3>
            <ul className="mt-3 space-y-1">
              {meta.required_attachments.map((att, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  {att}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Sections */}
        {keySections.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Key Sections Identified</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {keySections.map((ks, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {ks.sectionNumber && (
                      <span className="mr-1.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-700">
                        {ks.sectionNumber}
                      </span>
                    )}
                    {ks.title}
                  </p>
                  {ks.summary && <p className="mt-1 text-xs text-slate-600">{ks.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation Criteria */}
        {evalCriteria.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-100 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">Evaluation Criteria</h3>
              <p className="text-sm text-slate-600">Weighting determines scoring priority.</p>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-600">
                <tr>
                  <th className="px-4 py-3">Criterion</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {evalCriteria.map((ec, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{ec.name}</td>
                    <td className="px-4 py-3">
                      {ec.weight ? (
                        <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                          {ec.weight}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{ec.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Compliance Matrix */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between bg-slate-100 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Compliance Matrix</h3>
              <p className="text-sm text-slate-600">
                {requirements.length} requirements extracted. {mandatoryCount} mandatory.
              </p>
            </div>
          </div>
          {requirements.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              {rfp.status === "processing"
                ? "Requirements are being extracted..."
                : "No requirements parsed."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Requirement</th>
                    <th className="px-4 py-3">Mandatory</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Evaluation</th>
                    <th className="px-4 py-3">Response Needed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {requirements.map((req) => (
                    <tr key={req.id} className={req.mandatory ? "bg-red-50/40" : ""}>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{req.id}</td>
                      <td className="px-4 py-3 max-w-md">{req.description}</td>
                      <td className="px-4 py-3">
                        {req.mandatory ? (
                          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{req.section || "—"}</td>
                      <td className="px-4 py-3">{req.evaluationCriterion || "—"}</td>
                      <td className="px-4 py-3">
                        {req.responseNeeded !== false ? (
                          <span className="text-emerald-700 font-medium">Yes</span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">
          AI-generated outputs require human review. Confirm critical dates and compliance items before submitting.
        </p>
      </main>
    </div>
  );
}
