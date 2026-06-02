-- FinWise AI — Idempotent Schema (safe to run multiple times)
-- Run this in: Supabase Dashboard → SQL Editor → New query

create extension if not exists "uuid-ossp";

-- ─── TABLES ──────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  country text default 'AU',
  currency text default 'AUD',
  financial_year_start int default 7,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.financial_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique,
  employment_type text,
  annual_income numeric(15,2) default 0,
  filing_status text default 'single',
  dependents int default 0,
  risk_tolerance text default 'moderate',
  investment_goals text[],
  net_worth numeric(15,2) default 0,
  monthly_expenses numeric(15,2) default 0,
  emergency_fund_months int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null,
  institution text,
  balance numeric(15,2) default 0,
  currency text default 'AUD',
  is_asset boolean default true,
  interest_rate numeric(5,4),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  date date not null default current_date,
  description text not null,
  amount numeric(15,2) not null,
  category text not null,
  subcategory text,
  type text not null,
  is_recurring boolean default false,
  is_tax_deductible boolean default false,
  receipt_url text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null,
  color text default '#C9A84C',
  icon text,
  is_tax_deductible boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.mortgages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  property_name text not null default 'Primary Residence',
  purchase_price numeric(15,2),
  down_payment numeric(15,2),
  loan_amount numeric(15,2) not null,
  interest_rate numeric(5,4) not null,
  amortization_years int not null default 25,
  term_years int default 5,
  payment_frequency text default 'monthly',
  start_date date,
  lender text,
  is_variable_rate boolean default false,
  prepayment_annual numeric(15,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null,
  target_amount numeric(15,2) not null,
  current_amount numeric(15,2) default 0,
  target_date date,
  monthly_contribution numeric(15,2) default 0,
  priority text default 'medium',
  status text default 'active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tax_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  tax_year int not null,
  employment_income numeric(15,2) default 0,
  self_employment_income numeric(15,2) default 0,
  investment_income numeric(15,2) default 0,
  rental_income numeric(15,2) default 0,
  other_income numeric(15,2) default 0,
  rrsp_contributions numeric(15,2) default 0,
  rrsp_room numeric(15,2) default 0,
  tfsa_room numeric(15,2) default 0,
  super_concessional_contributions numeric(15,2) default 0,
  super_non_concessional_contributions numeric(15,2) default 0,
  hecs_help_debt numeric(15,2) default 0,
  medicare_levy_exemption boolean default false,
  kiwisaver_contributions numeric(15,2) default 0,
  kiwisaver_rate numeric(3,2) default 0.03,
  charitable_donations numeric(15,2) default 0,
  medical_expenses numeric(15,2) default 0,
  tuition numeric(15,2) default 0,
  home_office_expenses numeric(15,2) default 0,
  business_expenses numeric(15,2) default 0,
  tax_paid numeric(15,2) default 0,
  expected_refund numeric(15,2),
  filing_status text default 'not_filed',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tax_year)
);

create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  agent text not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.alerts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  severity text default 'info',
  is_read boolean default false,
  action_url text,
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size int,
  storage_path text not null,
  document_type text,
  institution text,
  period_start date,
  period_end date,
  extracted_data jsonb,
  analysis_summary text,
  status text default 'pending',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bank_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  provider text not null default 'plaid',
  institution_name text not null,
  institution_logo text,
  plaid_access_token text,
  plaid_item_id text,
  plaid_institution_id text,
  last_sync_at timestamptz,
  status text default 'active',
  created_at timestamptz default now()
);

-- ─── ADD MISSING COLUMNS (safe if already exist) ─────────────────────────────
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='country') then
    alter table public.profiles add column country text default 'AU';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tax_profiles' and column_name='super_concessional_contributions') then
    alter table public.tax_profiles add column super_concessional_contributions numeric(15,2) default 0;
    alter table public.tax_profiles add column super_non_concessional_contributions numeric(15,2) default 0;
    alter table public.tax_profiles add column hecs_help_debt numeric(15,2) default 0;
    alter table public.tax_profiles add column medicare_levy_exemption boolean default false;
    alter table public.tax_profiles add column kiwisaver_contributions numeric(15,2) default 0;
    alter table public.tax_profiles add column kiwisaver_rate numeric(3,2) default 0.03;
  end if;
end $$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.financial_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.mortgages enable row level security;
alter table public.goals enable row level security;
alter table public.tax_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.alerts enable row level security;
alter table public.documents enable row level security;
alter table public.bank_connections enable row level security;

-- ─── POLICIES (drop first so re-running is safe) ─────────────────────────────
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users own their financial_profiles" on public.financial_profiles for all using (auth.uid() = user_id);
create policy "Users own their accounts"            on public.accounts           for all using (auth.uid() = user_id);
create policy "Users own their transactions"        on public.transactions       for all using (auth.uid() = user_id);
create policy "Users own their categories"          on public.categories         for all using (auth.uid() = user_id);
create policy "Users own their mortgages"           on public.mortgages          for all using (auth.uid() = user_id);
create policy "Users own their goals"               on public.goals              for all using (auth.uid() = user_id);
create policy "Users own their tax_profiles"        on public.tax_profiles       for all using (auth.uid() = user_id);
create policy "Users own their conversations"       on public.conversations      for all using (auth.uid() = user_id);
create policy "Users own their messages"            on public.messages           for all using (auth.uid() = user_id);
create policy "Users own their alerts"              on public.alerts             for all using (auth.uid() = user_id);
create policy "Users own their documents"           on public.documents          for all using (auth.uid() = user_id);
create policy "Users own their bank_connections"    on public.bank_connections   for all using (auth.uid() = user_id);

-- ─── FUNCTIONS & TRIGGERS ────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  insert into public.financial_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, type, color, icon, is_tax_deductible)
  select new.id, name, type, color, icon, is_tax_deductible from (values
    ('Salary / PAYG',              'income',  '#22c55e', 'briefcase',    false),
    ('ABN / Freelance',            'income',  '#10b981', 'laptop',       true),
    ('Investments & Dividends',    'income',  '#06b6d4', 'trending-up',  false),
    ('Rental Income',              'income',  '#8b5cf6', 'home',         false),
    ('Super / KiwiSaver / RRSP',   'income',  '#f59e0b', 'shield',       false),
    ('Government Payments',        'income',  '#84cc16', 'landmark',     false),
    ('Housing & Rent',             'expense', '#ef4444', 'home',         false),
    ('Mortgage Repayments',        'expense', '#f97316', 'home',         false),
    ('Food & Groceries',           'expense', '#f97316', 'utensils',     false),
    ('Transport & Vehicle',        'expense', '#eab308', 'car',          true),
    ('Healthcare & Medical',       'expense', '#ec4899', 'heart',        true),
    ('Education & Training',       'expense', '#6366f1', 'graduation-cap', true),
    ('Entertainment',              'expense', '#14b8a6', 'film',         false),
    ('Shopping & Personal',        'expense', '#f43f5e', 'shopping-bag', false),
    ('Business Expenses',          'expense', '#a855f7', 'briefcase',    true),
    ('Charitable Donations',       'expense', '#84cc16', 'heart-handshake', true),
    ('Super Contributions',        'expense', '#f59e0b', 'shield',       true),
    ('Insurance',                  'expense', '#0ea5e9', 'shield',       false),
    ('Utilities',                  'expense', '#64748b', 'zap',          false),
    ('Subscriptions',              'expense', '#8b5cf6', 'repeat',       false),
    ('GST / Tax Paid',             'expense', '#64748b', 'receipt',      false)
  ) as t(name, type, color, icon, is_tax_deductible)
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at           on public.profiles;
drop trigger if exists update_financial_profiles_updated_at on public.financial_profiles;
drop trigger if exists update_accounts_updated_at           on public.accounts;
drop trigger if exists update_mortgages_updated_at          on public.mortgages;
drop trigger if exists update_goals_updated_at              on public.goals;
drop trigger if exists update_tax_profiles_updated_at       on public.tax_profiles;
drop trigger if exists update_conversations_updated_at      on public.conversations;
drop trigger if exists update_documents_updated_at          on public.documents;

create trigger update_profiles_updated_at           before update on public.profiles           for each row execute procedure public.update_updated_at();
create trigger update_financial_profiles_updated_at before update on public.financial_profiles for each row execute procedure public.update_updated_at();
create trigger update_accounts_updated_at           before update on public.accounts           for each row execute procedure public.update_updated_at();
create trigger update_mortgages_updated_at          before update on public.mortgages          for each row execute procedure public.update_updated_at();
create trigger update_goals_updated_at              before update on public.goals              for each row execute procedure public.update_updated_at();
create trigger update_tax_profiles_updated_at       before update on public.tax_profiles       for each row execute procedure public.update_updated_at();
create trigger update_conversations_updated_at      before update on public.conversations      for each row execute procedure public.update_updated_at();
create trigger update_documents_updated_at          before update on public.documents          for each row execute procedure public.update_updated_at();
