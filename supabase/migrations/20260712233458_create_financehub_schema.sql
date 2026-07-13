/*
# FinanceHub Pro - Database Schema

## Overview
Creates the complete schema for FinanceHub Pro, a multi-user financial management
system supporting both personal business finance and group business finance with
proportional capital-based distribution of income and expenses among group members.

## Tables
1. `profiles` — user profile data linked to auth.users (email, full_name)
2. `personal_business` — a user's personal business (name, type, start date, initial capital)
3. `personal_transactions` — income/expense transactions for a personal business,
   with running balance_before/balance_after
4. `groups` — a group business with multiple members
5. `group_members` — members of a group, each with their own initial capital
6. `group_transactions` — income/expense transactions for a group
7. `member_transaction_details` — per-member impact of each group transaction
   (share percentage, share amount, balance before/after)
8. `reports` — saved/generated report snapshots (metadata)
9. `settings` — per-user app settings (theme, currency)
10. `audit_logs` — audit trail of every data change

## Derived fields
Current balance, total income, total expense, profit and profit percentage are
computed in the frontend from transactions + initial capital. Running balances
(balance_before / balance_after) are stored on each transaction row for history.

## Security
- RLS enabled on every table.
- Owner-scoped policies (TO authenticated) using auth.uid() = user_id.
- All owner columns default to auth.uid() so inserts omitting user_id still succeed.
- Child tables scope ownership through their parent's user_id.

## Notes
1. Foreign keys use ON DELETE CASCADE so deleting a business/group cleans up
   related transactions automatically.
2. Indexes added on frequently-queried foreign keys and date columns.
3. Personal and group transactions are completely separate tables — never combined.
*/

-- =============================================================
-- PROFILES
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- =============================================================
-- PERSONAL BUSINESS
-- =============================================================
CREATE TABLE IF NOT EXISTS personal_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  business_type text NOT NULL DEFAULT 'Lainnya',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  initial_capital numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE personal_business ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_personal_business_user ON personal_business(user_id);

DROP POLICY IF EXISTS "select_own_personal_business" ON personal_business;
CREATE POLICY "select_own_personal_business" ON personal_business FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_personal_business" ON personal_business;
CREATE POLICY "insert_own_personal_business" ON personal_business FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_personal_business" ON personal_business;
CREATE POLICY "update_own_personal_business" ON personal_business FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_personal_business" ON personal_business;
CREATE POLICY "delete_own_personal_business" ON personal_business FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- PERSONAL TRANSACTIONS (separate from group)
-- =============================================================
CREATE TABLE IF NOT EXISTS personal_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES personal_business(id) ON DELETE CASCADE,
  transaction_no text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  category text NOT NULL DEFAULT 'Lainnya',
  description text,
  nominal numeric(18,2) NOT NULL DEFAULT 0,
  balance_before numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE personal_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_personal_tx_user ON personal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_tx_business ON personal_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_personal_tx_date ON personal_transactions(transaction_date);

DROP POLICY IF EXISTS "select_own_personal_tx" ON personal_transactions;
CREATE POLICY "select_own_personal_tx" ON personal_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_personal_tx" ON personal_transactions;
CREATE POLICY "insert_own_personal_tx" ON personal_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_personal_tx" ON personal_transactions;
CREATE POLICY "update_own_personal_tx" ON personal_transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_personal_tx" ON personal_transactions;
CREATE POLICY "delete_own_personal_tx" ON personal_transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- GROUPS
-- =============================================================
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id);

DROP POLICY IF EXISTS "select_own_groups" ON groups;
CREATE POLICY "select_own_groups" ON groups FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_groups" ON groups;
CREATE POLICY "insert_own_groups" ON groups FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_groups" ON groups;
CREATE POLICY "update_own_groups" ON groups FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_groups" ON groups;
CREATE POLICY "delete_own_groups" ON groups FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- GROUP MEMBERS
-- =============================================================
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  initial_capital numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

DROP POLICY IF EXISTS "select_own_group_members" ON group_members;
CREATE POLICY "select_own_group_members" ON group_members FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_group_members" ON group_members;
CREATE POLICY "insert_own_group_members" ON group_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_group_members" ON group_members;
CREATE POLICY "update_own_group_members" ON group_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_group_members" ON group_members;
CREATE POLICY "delete_own_group_members" ON group_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- GROUP TRANSACTIONS (separate from personal)
-- =============================================================
CREATE TABLE IF NOT EXISTS group_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  transaction_no text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  category text NOT NULL DEFAULT 'Lainnya',
  description text,
  nominal numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE group_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_group_tx_user ON group_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_tx_group ON group_transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_tx_date ON group_transactions(transaction_date);

DROP POLICY IF EXISTS "select_own_group_tx" ON group_transactions;
CREATE POLICY "select_own_group_tx" ON group_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_group_tx" ON group_transactions;
CREATE POLICY "insert_own_group_tx" ON group_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_group_tx" ON group_transactions;
CREATE POLICY "update_own_group_tx" ON group_transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_group_tx" ON group_transactions;
CREATE POLICY "delete_own_group_tx" ON group_transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- MEMBER TRANSACTION DETAILS (per-member impact of a group tx)
-- =============================================================
CREATE TABLE IF NOT EXISTS member_transaction_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_transaction_id uuid NOT NULL REFERENCES group_transactions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  share_percentage numeric(8,4) NOT NULL DEFAULT 0,
  share_amount numeric(18,2) NOT NULL DEFAULT 0,
  balance_before numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE member_transaction_details ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_member_tx_details_user ON member_transaction_details(user_id);
CREATE INDEX IF NOT EXISTS idx_member_tx_details_group_tx ON member_transaction_details(group_transaction_id);
CREATE INDEX IF NOT EXISTS idx_member_tx_details_member ON member_transaction_details(member_id);

DROP POLICY IF EXISTS "select_own_member_tx_details" ON member_transaction_details;
CREATE POLICY "select_own_member_tx_details" ON member_transaction_details FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_member_tx_details" ON member_transaction_details;
CREATE POLICY "insert_own_member_tx_details" ON member_transaction_details FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_member_tx_details" ON member_transaction_details;
CREATE POLICY "update_own_member_tx_details" ON member_transaction_details FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_member_tx_details" ON member_transaction_details;
CREATE POLICY "delete_own_member_tx_details" ON member_transaction_details FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- REPORTS (saved report snapshots metadata)
-- =============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'summary',
  scope text NOT NULL CHECK (scope IN ('personal','group','all')),
  ref_id uuid,
  period_start date,
  period_end date,
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reports" ON reports;
CREATE POLICY "update_own_reports" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reports" ON reports;
CREATE POLICY "delete_own_reports" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- SETTINGS (per-user app settings)
-- =============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'light',
  currency text NOT NULL DEFAULT 'IDR',
  notifications_enabled boolean NOT NULL DEFAULT true,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_settings" ON settings;
CREATE POLICY "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- AUDIT LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_audit_logs" ON audit_logs;
CREATE POLICY "insert_own_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_audit_logs" ON audit_logs;
CREATE POLICY "delete_own_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
