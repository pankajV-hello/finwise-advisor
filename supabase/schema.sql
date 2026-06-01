-- FinWise AI - Complete Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  country text default 'CA', -- CA or US for tax jurisdiction
  currency text default 'CAD',
  financial_year_start int default 1, -- month number
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── FINANCIAL PROFILE ───────────────────────────────────────────────────────
create table public.financial_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique,
  employment_type text, -- employed, self-employed, retired, student
  annual_income numeric(15,2) default 0,
  filing_status text default 'single', -- single, married, common-law, divorced
  dependents int default 0,
  risk_tolerance text default 'moderate', -- conservative, moderate, aggressive
  investment_goals text[], -- retirement, house, education, travel
  net_worth numeric(15,2) default 0,
  monthly_expenses numeric(15,2) default 0,
  emergency_fund_months int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ACCOUNTS (assets & liabilities) ────────────────────────────────────────
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null, -- checking, savings, investment, rrsp, tfsa, rrsp, credit_card, loan, mortgage, crypto, other
  institution text,
  balance numeric(15,2) default 0,
  currency text default 'CAD',
  is_asset boolean default true,
  interest_rate numeric(5,4), -- for loans/mortgages
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TRANSACTIONS (Bookkeeper) ───────────────────────────────────────────────
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  date date not null default current_date,
  description text not null,
  amount numeric(15,2) not null, -- positive = income, negative = expense
  category text not null,
  subcategory text,
  type text not null, -- income, expense, transfer
  is_recurring boolean default false,
  is_tax_deductible boolean default false,
  receipt_url text,
  notes text,
  created_at timestamptz default now()
);

-- ─── CATEGORIES ──────────────────────────────────────────────────────────────
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null, -- income, expense
  color text default '#C9A84C',
  icon text,
  is_tax_deductible boolean default false,
  created_at timestamptz default now()
);

-- ─── MORTGAGE PROFILES ───────────────────────────────────────────────────────
create table public.mortgages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  property_name text not null default 'Primary Residence',
  purchase_price numeric(15,2),
  down_payment numeric(15,2),
  loan_amount numeric(15,2) not null,
  interest_rate numeric(5,4) not null, -- e.g. 0.0525 for 5.25%
  amortization_years int not null default 25,
  term_years int default 5,
  payment_frequency text default 'monthly', -- monthly, bi-weekly, weekly
  start_date date,
  lender text,
  is_variable_rate boolean default false,
  prepayment_annual numeric(15,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── GOALS ───────────────────────────────────────────────────────────────────
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null, -- retirement, emergency, vacation, house, education, debt_payoff, other
  target_amount numeric(15,2) not null,
  current_amount numeric(15,2) default 0,
  target_date date,
  monthly_contribution numeric(15,2) default 0,
  priority text default 'medium', -- low, medium, high
  status text default 'active', -- active, completed, paused
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── TAX PROFILES ────────────────────────────────────────────────────────────
create table public.tax_profiles (
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
  charitable_donations numeric(15,2) default 0,
  medical_expenses numeric(15,2) default 0,
  tuition numeric(15,2) default 0,
  home_office_expenses numeric(15,2) default 0,
  business_expenses numeric(15,2) default 0,
  tax_paid numeric(15,2) default 0,
  expected_refund numeric(15,2),
  filing_status text default 'not_filed', -- not_filed, filed, assessed
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tax_year)
);

-- ─── CONVERSATIONS (AI Chat History) ─────────────────────────────────────────
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  agent text not null, -- tax, financial, mortgage, bookkeeper, general
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null, -- user, assistant
  content text not null,
  created_at timestamptz default now()
);

-- ─── ALERTS ──────────────────────────────────────────────────────────────────
create table public.alerts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null, -- goal_progress, budget_exceeded, tax_deadline, mortgage_renewal, tip
  title text not null,
  message text not null,
  severity text default 'info', -- info, warning, success, error
  is_read boolean default false,
  action_url text,
  created_at timestamptz default now()
);

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

-- Profiles policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Generic user-owned table policies
create policy "Users own their financial_profiles" on public.financial_profiles for all using (auth.uid() = user_id);
create policy "Users own their accounts" on public.accounts for all using (auth.uid() = user_id);
create policy "Users own their transactions" on public.transactions for all using (auth.uid() = user_id);
create policy "Users own their categories" on public.categories for all using (auth.uid() = user_id);
create policy "Users own their mortgages" on public.mortgages for all using (auth.uid() = user_id);
create policy "Users own their goals" on public.goals for all using (auth.uid() = user_id);
create policy "Users own their tax_profiles" on public.tax_profiles for all using (auth.uid() = user_id);
create policy "Users own their conversations" on public.conversations for all using (auth.uid() = user_id);
create policy "Users own their messages" on public.messages for all using (auth.uid() = user_id);
create policy "Users own their alerts" on public.alerts for all using (auth.uid() = user_id);

-- ─── TRIGGER: auto-create profile on signup ──────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.financial_profiles (user_id)
  values (new.id);

  -- Seed default categories
  insert into public.categories (user_id, name, type, color, icon, is_tax_deductible) values
    (new.id, 'Salary', 'income', '#22c55e', 'briefcase', false),
    (new.id, 'Freelance', 'income', '#10b981', 'laptop', true),
    (new.id, 'Investments', 'income', '#06b6d4', 'trending-up', false),
    (new.id, 'Rental Income', 'income', '#8b5cf6', 'home', false),
    (new.id, 'Housing', 'expense', '#ef4444', 'home', false),
    (new.id, 'Food & Dining', 'expense', '#f97316', 'utensils', false),
    (new.id, 'Transport', 'expense', '#eab308', 'car', false),
    (new.id, 'Healthcare', 'expense', '#ec4899', 'heart', true),
    (new.id, 'Education', 'expense', '#6366f1', 'graduation-cap', true),
    (new.id, 'Entertainment', 'expense', '#14b8a6', 'film', false),
    (new.id, 'Shopping', 'expense', '#f43f5e', 'shopping-bag', false),
    (new.id, 'Business Expenses', 'expense', '#a855f7', 'briefcase', true),
    (new.id, 'Charitable Donations', 'expense', '#84cc16', 'heart-handshake', true),
    (new.id, 'Savings', 'expense', '#0ea5e9', 'piggy-bank', false),
    (new.id, 'Utilities', 'expense', '#64748b', 'zap', false);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── FUNCTION: update updated_at timestamp ───────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at();
create trigger update_financial_profiles_updated_at before update on public.financial_profiles for each row execute procedure public.update_updated_at();
create trigger update_accounts_updated_at before update on public.accounts for each row execute procedure public.update_updated_at();
create trigger update_mortgages_updated_at before update on public.mortgages for each row execute procedure public.update_updated_at();
create trigger update_goals_updated_at before update on public.goals for each row execute procedure public.update_updated_at();
create trigger update_tax_profiles_updated_at before update on public.tax_profiles for each row execute procedure public.update_updated_at();
create trigger update_conversations_updated_at before update on public.conversations for each row execute procedure public.update_updated_at();
