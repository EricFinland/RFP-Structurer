export type RfpStatus = "processing" | "complete" | "failed";

export interface Requirement {
  id: string;
  description: string;
  mandatory: boolean;
  section?: string | null;
  evaluationCriterion?: string | null;
  responseNeeded?: boolean | null;
}

export interface EvaluationCriterion {
  name: string;
  weight?: string | null;
  description?: string | null;
}

export interface KeySection {
  title: string;
  sectionNumber?: string | null;
  summary?: string | null;
}

export interface RfpMetadata {
  title?: string | null;
  issuer?: string | null;
  submission_deadline?: string | null;
  notes?: string | null;
  page_limits?: string | null;
  formatting_rules?: string | null;
  required_attachments?: string[] | null;
}

export interface ExtractedRfp {
  id: string;
  user_id: string;
  file_name: string;
  status: RfpStatus;
  deadline?: string | null;
  storage_key: string;
  created_at?: string;
  metadata?: RfpMetadata | null;
  requirements?: Requirement[] | null;
  evaluation_criteria?: EvaluationCriterion[] | null;
  key_sections?: KeySection[] | null;
}
