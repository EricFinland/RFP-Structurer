import { OpenAI } from "openai";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { getSupabaseServerClient } from "./supabase/server";
import type { Requirement, EvaluationCriterion, KeySection } from "@/types/rfp";

const extractionSchema = z.object({
  metadata: z
    .object({
      title: z.string().nullable().optional(),
      issuer: z.string().nullable().optional(),
      submission_deadline: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      page_limits: z.string().nullable().optional(),
      formatting_rules: z.string().nullable().optional(),
      required_attachments: z.array(z.string()).nullable().optional(),
    })
    .optional(),
  requirements: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
        mandatory: z.boolean().optional().default(false),
        section: z.string().nullable().optional(),
        evaluation_criterion: z.string().nullable().optional(),
        response_needed: z.boolean().optional().default(true),
      })
    )
    .default([]),
  evaluation_criteria: z
    .array(
      z.object({
        name: z.string(),
        weight: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .default([]),
  key_sections: z
    .array(
      z.object({
        title: z.string(),
        section_number: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
      })
    )
    .default([]),
});

/**
 * Split text at paragraph boundaries instead of mid-word.
 * Falls back to hard split if no paragraph break is found.
 */
function chunkText(text: string, maxChunkSize = 3500): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a double-newline (paragraph boundary)
    let breakPoint = remaining.lastIndexOf("\n\n", maxChunkSize);
    if (breakPoint < maxChunkSize * 0.5) {
      // If no good paragraph break, try single newline
      breakPoint = remaining.lastIndexOf("\n", maxChunkSize);
    }
    if (breakPoint < maxChunkSize * 0.3) {
      // If still no good break, try space
      breakPoint = remaining.lastIndexOf(" ", maxChunkSize);
    }
    if (breakPoint < maxChunkSize * 0.3) {
      // Hard split as last resort
      breakPoint = maxChunkSize;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}

async function callOpenAI(prompt: string) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    text: { format: { type: "json_object" } },
  });

  const text = completion.output_text;
  if (!text) {
    throw new Error("No content returned from OpenAI");
  }
  return text;
}

const SYSTEM_PROMPT = `You are an expert government contracts analyst. Your job is to extract a complete, structured compliance matrix from RFP (Request for Proposal) documents.

You MUST return valid JSON with the following structure:

{
  "metadata": {
    "title": "Short RFP title or solicitation number",
    "issuer": "Issuing agency or organization",
    "submission_deadline": "ISO 8601 date/time if found, e.g. 2024-03-15T14:00:00Z",
    "notes": "Any important general notes (e.g. small business set-aside, NAICS code)",
    "page_limits": "Page limit rules if stated (e.g. 'Technical volume: 50 pages, Management volume: 25 pages')",
    "formatting_rules": "Formatting rules if stated (e.g. 'Times New Roman 12pt, 1-inch margins')",
    "required_attachments": ["List of required attachments/forms/certifications"]
  },
  "requirements": [
    {
      "id": "REQ-001",
      "description": "Full requirement text, quoted from the RFP where possible",
      "mandatory": true,
      "section": "Section number or heading where this requirement appears (e.g. '3.2.4')",
      "evaluation_criterion": "Which evaluation factor this maps to, if identifiable",
      "response_needed": true
    }
  ],
  "evaluation_criteria": [
    {
      "name": "Technical Approach",
      "weight": "40%",
      "description": "Brief description of what this criterion evaluates"
    }
  ],
  "key_sections": [
    {
      "title": "Section title",
      "section_number": "e.g. Section L",
      "summary": "One-sentence summary of what this section covers"
    }
  ]
}

EXTRACTION RULES:
1. REQUIREMENTS: Extract EVERY requirement, instruction, and compliance item. Include both explicit ("shall", "must") and implicit requirements. Use IDs like REQ-001, REQ-002, etc.
2. MANDATORY: Mark as mandatory=true if the text uses "shall", "must", "required", or similar imperative language. Mark as false for "should", "may", "optional".
3. RESPONSE NEEDED: Set response_needed=true if the offeror needs to provide a written response, deliverable, or demonstration. Set false for informational items.
4. EVALUATION CRITERIA: Extract all evaluation factors/criteria with their weights/percentages. Look in sections titled "Evaluation Factors", "Evaluation Criteria", "Basis of Award", "Section M", etc.
5. KEY SECTIONS: Identify major document sections especially: Submission Instructions (Section L), Evaluation Criteria (Section M), Statement of Work/PWS, Compliance Requirements, Contract Clauses.
6. DEADLINE: Look for submission deadline, proposal due date, closing date, or response date. Convert to ISO 8601 format.
7. SECTION NUMBERS: Preserve exact section numbers (e.g., "3.2.4", "Section L", "L.5") in the section field.
8. Do NOT fabricate requirements. Only extract what is actually stated in the document.
9. Do NOT include the raw source text in your response.`;

export async function processRfp({
  rfpId,
  userId,
  fileBuffer,
  fileName,
}: {
  rfpId: string;
  userId: string;
  fileBuffer: Buffer;
  fileName: string;
}) {
  const supabase = await getSupabaseServerClient();
  try {
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
    const textResult = await parser.getText();
    const text = textResult.text || "";

    if (text.trim().length < 50) {
      throw new Error("PDF text extraction returned insufficient content. The PDF may be image-based or corrupted.");
    }

    const chunks = chunkText(text);

    const userPrompt = `Analyze the following RFP document and extract a complete compliance matrix.

RFP FILENAME: ${fileName}

RFP CONTENT (${chunks.length} chunks):
${chunks
  .map((chunk, idx) => `--- Chunk ${idx + 1} of ${chunks.length} ---\n${chunk}`)
  .join("\n\n")}

Extract ALL requirements, evaluation criteria, key sections, and metadata. Be thorough - missing a requirement could cost the contractor the bid.`;

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

    const rawResponse = await callOpenAI(fullPrompt);
    const parsed = extractionSchema.safeParse(JSON.parse(rawResponse));
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${parsed.error.message}`);
    }

    const requirements: Requirement[] = parsed.data.requirements.map((req, idx) => ({
      id: req.id || `REQ-${String(idx + 1).padStart(3, "0")}`,
      description: req.description,
      mandatory: req.mandatory ?? false,
      section: req.section,
      evaluationCriterion: req.evaluation_criterion,
      responseNeeded: req.response_needed ?? true,
    }));

    const evaluationCriteria: EvaluationCriterion[] = parsed.data.evaluation_criteria.map((ec) => ({
      name: ec.name,
      weight: ec.weight,
      description: ec.description,
    }));

    const keySections: KeySection[] = parsed.data.key_sections.map((ks) => ({
      title: ks.title,
      sectionNumber: ks.section_number,
      summary: ks.summary,
    }));

    await supabase
      .from("rfps")
      .update({
        status: "complete",
        deadline: parsed.data.metadata?.submission_deadline ?? null,
        metadata: parsed.data.metadata ?? {},
        requirements,
        evaluation_criteria: evaluationCriteria,
        key_sections: keySections,
      })
      .eq("id", rfpId)
      .eq("user_id", userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown processing error";
    await supabase
      .from("rfps")
      .update({
        status: "failed",
        metadata: { error: message },
      })
      .eq("id", rfpId);
    throw error;
  }
}
