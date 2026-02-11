import { NextResponse } from "next/server";
import { Parser } from "json2csv";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Requirement } from "@/types/rfp";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("rfps")
    .select("id, requirements, file_name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  const requirements = ((data.requirements as Requirement[]) || []).map((req) => ({
    id: req.id,
    description: req.description,
    mandatory: req.mandatory ? "Yes" : "No",
    section: req.section || "",
    evaluationCriterion: req.evaluationCriterion || "",
    responseNeeded: req.responseNeeded !== false ? "Yes" : "No",
    responseStatus: "Not Started",
  }));

  const parser = new Parser({
    fields: [
      { label: "Requirement ID", value: "id" },
      { label: "Requirement", value: "description" },
      { label: "Mandatory", value: "mandatory" },
      { label: "Section", value: "section" },
      { label: "Evaluation Criterion", value: "evaluationCriterion" },
      { label: "Response Needed", value: "responseNeeded" },
      { label: "Response Status", value: "responseStatus" },
    ],
  });
  const csv = parser.parse(requirements);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${data.file_name || "rfp"}-compliance-matrix.csv"`,
    },
  });
}
