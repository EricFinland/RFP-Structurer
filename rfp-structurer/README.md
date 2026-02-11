# RFP Structurer

Upload an RFP PDF, extract a full compliance matrix with OpenAI, and export to Excel, Word, CSV, or JSON. Built as a single Next.js app with Supabase auth, Postgres, S3 storage, and Tailwind.

## What It Does

When a contractor uploads an RFP PDF, the system extracts:
- Submission deadline
- All mandatory requirements (with section numbers preserved)
- Evaluation criteria with weights
- Key document sections
- Page limits, formatting rules, required attachments
- Structured compliance matrix ready to export

## Stack
- Next.js 16 App Router (TypeScript, React Compiler)
- Tailwind v4
- Supabase (auth + Postgres)
- S3-compatible storage
- OpenAI Responses API (gpt-4.1-mini)
- ExcelJS (Excel export)
- docx (Word export)

## Setup
1) Install deps:
```bash
npm install
```
2) Copy envs and fill in:
```bash
cp .env.example .env.local
```
3) Supabase schema (run in SQL editor or use `supabase/schema.sql`):
```sql
create table public.rfps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  file_name text not null,
  storage_key text not null,
  status text not null check (status in ('processing','complete','failed')),
  deadline text,
  metadata jsonb,
  requirements jsonb,
  evaluation_criteria jsonb,
  key_sections jsonb,
  created_at timestamptz default now()
);

alter table public.rfps enable row level security;
create policy "user owns rfp"
  on public.rfps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
4) S3 bucket: create a private bucket matching `S3_BUCKET`. User files are stored at `userId/<uuid>-filename.pdf`.
5) Run locally:
```bash
npm run dev
```
App runs on http://localhost:3000.

## Core Flows

### Upload & Processing
1. User uploads a PDF via the dashboard
2. File is validated (PDF only, <10MB), stored in S3
3. `rfps` row created with `status=processing`
4. Background processing: PDF text extraction -> OpenAI structured extraction -> results saved to DB
5. User is redirected to the results page, which auto-polls until processing completes

### Extraction
The LLM prompt extracts:
- **Metadata**: title, issuer, deadline, page limits, formatting rules, required attachments
- **Requirements**: ID, description, mandatory flag, section number, evaluation criterion, response needed flag
- **Evaluation Criteria**: name, weight percentage, description
- **Key Sections**: title, section number, summary

### Exports
- **Excel** (`/api/exports/[id]/excel`): 3-sheet workbook (Compliance Matrix, Evaluation Criteria, RFP Summary) with formatted headers, auto-filter, and color coding
- **Word** (`/api/exports/[id]/word`): Structured document with metadata, key sections, evaluation criteria table, and compliance matrix table
- **CSV** (`/api/exports/[id]/csv`): Flat compliance matrix with all fields
- **JSON** (`/api/exports/[id]/json`): Raw data export

## Files to Look At
- `lib/process-rfp.ts` — PDF parsing + OpenAI extraction (the core)
- `types/rfp.ts` — TypeScript interfaces for all extracted data
- `app/api/upload/route.ts` — upload + async processing trigger
- `app/rfps/[id]/page.tsx` — results view with all sections
- `app/api/exports/[id]/excel/route.ts` — Excel export
- `app/api/exports/[id]/word/route.ts` — Word export
- `app/dashboard/page.tsx` — list uploads + upload card
- `components/rfp-polling.tsx` — auto-refresh while processing
- `middleware.ts` — route protection

## Security Notes
- Only authenticated users can access their rows (RLS policy required)
- Files are namespaced per user in S3
- Upload route rejects non-PDF or >10MB files
- No PDF text is logged; only minimal error logs
- UI reminder: "AI-generated outputs require human review"

## TODOs / Next Steps
- Move processing to a Supabase Edge Function / queue for reliability
- Add per-user rate limiting on uploads
- Add unit tests for `process-rfp` chunking and schema validation
- OCR fallback for image-based PDFs
