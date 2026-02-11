import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from "docx";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Requirement, EvaluationCriterion, KeySection, RfpMetadata } from "@/types/rfp";

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20, font: "Arial" })],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: "1E293B" },
    width: { size: 0, type: WidthType.AUTO },
  });
}

function cell(text: string, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20, font: "Arial", bold })],
      }),
    ],
    width: { size: 0, type: WidthType.AUTO },
  });
}

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

  const meta = (data.metadata || {}) as RfpMetadata;
  const requirements = (data.requirements as Requirement[]) || [];
  const evalCriteria = (data.evaluation_criteria as EvaluationCriterion[]) || [];
  const keySections = (data.key_sections as KeySection[]) || [];

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: meta.title || data.file_name,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      text: "RFP Compliance Analysis",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Metadata section
  children.push(
    new Paragraph({
      text: "Document Summary",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    })
  );

  const metaItems = [
    ["Issuer", meta.issuer || "Not detected"],
    ["Submission Deadline", data.deadline || "Not detected"],
    ["Page Limits", meta.page_limits || "Not specified"],
    ["Formatting Rules", meta.formatting_rules || "Not specified"],
    ["Total Requirements", String(requirements.length)],
    ["Mandatory Requirements", String(requirements.filter((r) => r.mandatory).length)],
  ];

  metaItems.forEach(([label, value]) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: value, size: 22, font: "Arial" }),
        ],
        spacing: { after: 80 },
      })
    );
  });

  if (meta.notes) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Notes: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: meta.notes, size: 22, font: "Arial" }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  // Required Attachments
  if (meta.required_attachments?.length) {
    children.push(
      new Paragraph({
        text: "Required Attachments",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );
    meta.required_attachments.forEach((att) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `- ${att}`, size: 22, font: "Arial" })],
          spacing: { after: 40 },
        })
      );
    });
  }

  // Key Sections
  if (keySections.length > 0) {
    children.push(
      new Paragraph({
        text: "Key Sections Identified",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );

    keySections.forEach((ks) => {
      const label = ks.sectionNumber ? `${ks.sectionNumber} - ${ks.title}` : ks.title;
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: label, bold: true, size: 22, font: "Arial" }),
          ],
          spacing: { after: 40 },
        })
      );
      if (ks.summary) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: ks.summary, size: 20, font: "Arial", italics: true })],
            spacing: { after: 80 },
          })
        );
      }
    });
  }

  // Evaluation Criteria
  if (evalCriteria.length > 0) {
    children.push(
      new Paragraph({
        text: "Evaluation Criteria",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );

    const evalTableRows = [
      new TableRow({
        children: [
          headerCell("Criterion"),
          headerCell("Weight"),
          headerCell("Description"),
        ],
        tableHeader: true,
      }),
      ...evalCriteria.map(
        (ec) =>
          new TableRow({
            children: [
              cell(ec.name, true),
              cell(ec.weight || ""),
              cell(ec.description || ""),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        rows: evalTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  // Compliance Matrix
  children.push(
    new Paragraph({
      text: "Compliance Matrix",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 100 },
    })
  );

  if (requirements.length > 0) {
    const complianceRows = [
      new TableRow({
        children: [
          headerCell("ID"),
          headerCell("Requirement"),
          headerCell("Mandatory"),
          headerCell("Section"),
          headerCell("Response Needed"),
          headerCell("Status"),
        ],
        tableHeader: true,
      }),
      ...requirements.map(
        (req) =>
          new TableRow({
            children: [
              cell(req.id, true),
              cell(req.description),
              cell(req.mandatory ? "Yes" : "No"),
              cell(req.section || ""),
              cell(req.responseNeeded !== false ? "Yes" : "No"),
              cell("Not Started"),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        rows: complianceRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "No requirements extracted.", size: 22, font: "Arial" })],
      })
    );
  }

  // Disclaimer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "This document was generated by RFP Structurer. AI-generated outputs require human review. Confirm critical dates and compliance items before submitting.",
          size: 18,
          font: "Arial",
          italics: true,
          color: "64748B",
        }),
      ],
      spacing: { before: 400 },
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${data.file_name || "rfp"}-compliance.docx"`,
    },
  });
}
