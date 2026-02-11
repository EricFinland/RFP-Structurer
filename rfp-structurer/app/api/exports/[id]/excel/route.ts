import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Requirement, EvaluationCriterion } from "@/types/rfp";

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
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RFP Structurer";
  workbook.created = new Date();

  // --- Sheet 1: Compliance Matrix ---
  const complianceSheet = workbook.addWorksheet("Compliance Matrix");

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } },
    alignment: { vertical: "middle", wrapText: true },
    border: {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    },
  };

  complianceSheet.columns = [
    { header: "Req ID", key: "id", width: 12 },
    { header: "Requirement", key: "description", width: 55 },
    { header: "Mandatory", key: "mandatory", width: 12 },
    { header: "Section", key: "section", width: 14 },
    { header: "Evaluation Criterion", key: "evaluationCriterion", width: 22 },
    { header: "Response Needed", key: "responseNeeded", width: 16 },
    { header: "Response Status", key: "responseStatus", width: 16 },
  ];

  // Apply header styles
  complianceSheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });
  complianceSheet.getRow(1).height = 28;

  const requirements = (data.requirements as Requirement[]) || [];
  requirements.forEach((req, idx) => {
    const row = complianceSheet.addRow({
      id: req.id,
      description: req.description,
      mandatory: req.mandatory ? "Yes" : "No",
      section: req.section || "",
      evaluationCriterion: req.evaluationCriterion || "",
      responseNeeded: req.responseNeeded !== false ? "Yes" : "No",
      responseStatus: "Not Started",
    });

    // Alternate row shading
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      });
    }

    // Highlight mandatory rows
    if (req.mandatory) {
      row.getCell("mandatory").font = { bold: true, color: { argb: "FFDC2626" } };
    }

    row.alignment = { vertical: "top", wrapText: true };
  });

  // Auto-filter
  complianceSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: requirements.length + 1, column: 7 },
  };

  // --- Sheet 2: Evaluation Criteria ---
  const evalSheet = workbook.addWorksheet("Evaluation Criteria");
  evalSheet.columns = [
    { header: "Criterion", key: "name", width: 30 },
    { header: "Weight", key: "weight", width: 15 },
    { header: "Description", key: "description", width: 50 },
  ];

  evalSheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });
  evalSheet.getRow(1).height = 28;

  const evalCriteria = (data.evaluation_criteria as EvaluationCriterion[]) || [];
  evalCriteria.forEach((ec) => {
    const row = evalSheet.addRow({
      name: ec.name,
      weight: ec.weight || "",
      description: ec.description || "",
    });
    row.alignment = { vertical: "top", wrapText: true };
  });

  // --- Sheet 3: RFP Summary ---
  const summarySheet = workbook.addWorksheet("RFP Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 60 },
  ];
  summarySheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, { style: headerStyle });
  });

  const meta = data.metadata || {};
  const summaryRows = [
    { field: "File Name", value: data.file_name },
    { field: "Title", value: (meta as Record<string, string>).title || "" },
    { field: "Issuer", value: (meta as Record<string, string>).issuer || "" },
    { field: "Submission Deadline", value: data.deadline || "Not detected" },
    { field: "Page Limits", value: (meta as Record<string, string>).page_limits || "" },
    { field: "Formatting Rules", value: (meta as Record<string, string>).formatting_rules || "" },
    { field: "Total Requirements", value: String(requirements.length) },
    { field: "Mandatory Requirements", value: String(requirements.filter((r) => r.mandatory).length) },
    { field: "Notes", value: (meta as Record<string, string>).notes || "" },
  ];

  summaryRows.forEach((row) => {
    const r = summarySheet.addRow(row);
    r.getCell("field").font = { bold: true };
    r.alignment = { vertical: "top", wrapText: true };
  });

  // Required attachments
  const attachments = (meta as Record<string, unknown>).required_attachments as string[] | undefined;
  if (attachments?.length) {
    summarySheet.addRow({});
    const attachHeader = summarySheet.addRow({ field: "Required Attachments", value: "" });
    attachHeader.getCell("field").font = { bold: true, size: 12 };
    attachments.forEach((att) => {
      summarySheet.addRow({ field: "", value: att });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${data.file_name || "rfp"}-compliance-matrix.xlsx"`,
    },
  });
}
