-- RFP Structurer: Full schema
-- Run this in your Supabase SQL Editor to set up the database.

-- Create the rfps table
create table if not exists public.rfps (
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

-- Enable Row Level Security
alter table public.rfps enable row level security;

-- RLS policy: users can only access their own RFPs
create policy "user owns rfp"
  on public.rfps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- If migrating from existing schema (already have the table), run these:
-- alter table public.rfps add column if not exists evaluation_criteria jsonb;
-- alter table public.rfps add column if not exists key_sections jsonb;
