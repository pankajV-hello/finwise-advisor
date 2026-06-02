-- FinWise AI — Onboarding & Legal migration (safe to re-run)

-- Profiles: entity type, onboarding state, legal acceptance
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='entity_type') then
    alter table public.profiles add column entity_type text default 'individual'; -- individual | sme
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='onboarding_completed') then
    alter table public.profiles add column onboarding_completed boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='accepted_terms_at') then
    alter table public.profiles add column accepted_terms_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='accepted_terms_version') then
    alter table public.profiles add column accepted_terms_version text;
  end if;
  -- SME fields
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='business_name') then
    alter table public.profiles add column business_name text;
    alter table public.profiles add column business_structure text;     -- sole_trader, company, partnership, trust
    alter table public.profiles add column business_industry text;
    alter table public.profiles add column gst_registered boolean default false;
    alter table public.profiles add column employee_count int default 0;
    alter table public.profiles add column annual_revenue numeric(15,2) default 0;
  end if;
end $$;

-- Financial profiles: income source breakdown (JSON) + age
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='financial_profiles' and column_name='income_sources') then
    alter table public.financial_profiles add column income_sources jsonb default '[]'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='financial_profiles' and column_name='age') then
    alter table public.financial_profiles add column age int;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='financial_profiles' and column_name='owns_home') then
    alter table public.financial_profiles add column owns_home boolean default false;
  end if;
end $$;

-- Audit log table (security/compliance)
create table if not exists public.audit_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  entity text,
  metadata jsonb,
  ip_address text,
  created_at timestamptz default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "Users view own audit_log" on public.audit_log;
create policy "Users view own audit_log" on public.audit_log for select using (auth.uid() = user_id);
drop policy if exists "Users insert own audit_log" on public.audit_log;
create policy "Users insert own audit_log" on public.audit_log for insert with check (auth.uid() = user_id);
