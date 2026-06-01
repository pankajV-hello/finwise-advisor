-- ─── DOCUMENTS TABLE ─────────────────────────────────────────────────────────
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  file_name text not null,
  file_type text not null,        -- pdf, csv, image, xlsx
  file_size int,                  -- bytes
  storage_path text not null,     -- supabase storage path
  document_type text,             -- bank_statement, salary_slip, t4, t1, w2, 1040, investment_statement, receipt, other
  institution text,               -- bank/employer name extracted
  period_start date,              -- statement period
  period_end date,
  extracted_data jsonb,           -- structured data extracted by Claude
  analysis_summary text,          -- plain-text summary from Claude
  status text default 'pending',  -- pending, processing, done, failed
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── PLAID / BANK CONNECTIONS ────────────────────────────────────────────────
create table public.bank_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  provider text not null default 'plaid',   -- plaid, manual
  institution_name text not null,
  institution_logo text,
  plaid_access_token text,                  -- encrypted in prod
  plaid_item_id text,
  plaid_institution_id text,
  last_sync_at timestamptz,
  status text default 'active',             -- active, error, disconnected
  created_at timestamptz default now()
);

-- RLS
alter table public.documents enable row level security;
alter table public.bank_connections enable row level security;
create policy "Users own their documents" on public.documents for all using (auth.uid() = user_id);
create policy "Users own their bank_connections" on public.bank_connections for all using (auth.uid() = user_id);

-- Storage bucket (run via Supabase dashboard or CLI)
-- insert into storage.buckets (id, name, public) values ('financial-docs', 'financial-docs', false);
-- create policy "Users access own docs" on storage.objects for all using (auth.uid()::text = (storage.foldername(name))[1]);
