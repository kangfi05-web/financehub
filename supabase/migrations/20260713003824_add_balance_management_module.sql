/*
# FinanceHub Pro - Manajemen Saldo & Penarikan Dana

## Overview
Menambahkan modul penambahan modal (top up) dan penarikan dana (withdraw)
dengan sistem potongan/fee yang dapat diatur per grup dan per anggota.

## New Tables
1. `capital_additions` — penambahan modal untuk bisnis pribadi atau anggota grup.
   - scope: 'personal' | 'group'
   - ref_id: business_id (personal) atau member_id (group)
   - nominal, balance_before, balance_after
2. `withdrawals` — penarikan dana dengan potongan administrasi.
   - scope: 'personal' | 'group'
   - ref_id: business_id (personal) atau member_id (group)
   - withdrawal_amount, fee_percentage, fee_amount, net_received
   - balance_before, balance_after, status, reason
3. `withdrawal_settings` — pengaturan potongan per grup.
   - group_id (nullable untuk global default)
   - fee_percentage, fixed_fee, min_withdrawal, max_withdrawal
4. `member_withdrawal_settings` — pengaturan potongan khusus per anggota.
   - member_id, fee_percentage, fixed_fee

## Security
- RLS enabled on every table.
- Owner-scoped policies (TO authenticated) using auth.uid() = user_id.
- All owner columns default to auth.uid().
*/

-- =============================================================
-- CAPITAL ADDITIONS (Penambahan Modal)
-- =============================================================
CREATE TABLE IF NOT EXISTS capital_additions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('personal','group')),
  ref_id uuid NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  transaction_no text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  nominal numeric(18,2) NOT NULL DEFAULT 0,
  balance_before numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) NOT NULL DEFAULT 0,
  description text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE capital_additions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cap_add_user ON capital_additions(user_id);
CREATE INDEX IF NOT EXISTS idx_cap_add_scope_ref ON capital_additions(scope, ref_id);
CREATE INDEX IF NOT EXISTS idx_cap_add_date ON capital_additions(transaction_date);

DROP POLICY IF EXISTS "select_own_capital_additions" ON capital_additions;
CREATE POLICY "select_own_capital_additions" ON capital_additions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_capital_additions" ON capital_additions;
CREATE POLICY "insert_own_capital_additions" ON capital_additions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_capital_additions" ON capital_additions;
CREATE POLICY "update_own_capital_additions" ON capital_additions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_capital_additions" ON capital_additions;
CREATE POLICY "delete_own_capital_additions" ON capital_additions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- WITHDRAWALS (Penarikan Dana)
-- =============================================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('personal','group')),
  ref_id uuid NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  member_id uuid REFERENCES group_members(id) ON DELETE CASCADE,
  transaction_no text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  withdrawal_amount numeric(18,2) NOT NULL DEFAULT 0,
  fee_percentage numeric(8,4) NOT NULL DEFAULT 0,
  fixed_fee numeric(18,2) NOT NULL DEFAULT 0,
  fee_amount numeric(18,2) NOT NULL DEFAULT 0,
  net_received numeric(18,2) NOT NULL DEFAULT 0,
  balance_before numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_scope_ref ON withdrawals(scope, ref_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_date ON withdrawals(transaction_date);
CREATE INDEX IF NOT EXISTS idx_withdrawals_group ON withdrawals(group_id);

DROP POLICY IF EXISTS "select_own_withdrawals" ON withdrawals;
CREATE POLICY "select_own_withdrawals" ON withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_withdrawals" ON withdrawals;
CREATE POLICY "insert_own_withdrawals" ON withdrawals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_withdrawals" ON withdrawals;
CREATE POLICY "update_own_withdrawals" ON withdrawals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_withdrawals" ON withdrawals;
CREATE POLICY "delete_own_withdrawals" ON withdrawals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- WITHDRAWAL SETTINGS (Per-Group Fee Config)
-- =============================================================
CREATE TABLE IF NOT EXISTS withdrawal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  fee_percentage numeric(8,4) NOT NULL DEFAULT 0,
  fixed_fee numeric(18,2) NOT NULL DEFAULT 0,
  min_withdrawal numeric(18,2) NOT NULL DEFAULT 0,
  max_withdrawal numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);
ALTER TABLE withdrawal_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wd_settings_user ON withdrawal_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_wd_settings_group ON withdrawal_settings(group_id);

DROP POLICY IF EXISTS "select_own_wd_settings" ON withdrawal_settings;
CREATE POLICY "select_own_wd_settings" ON withdrawal_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wd_settings" ON withdrawal_settings;
CREATE POLICY "insert_own_wd_settings" ON withdrawal_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wd_settings" ON withdrawal_settings;
CREATE POLICY "update_own_wd_settings" ON withdrawal_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wd_settings" ON withdrawal_settings;
CREATE POLICY "delete_own_wd_settings" ON withdrawal_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- MEMBER WITHDRAWAL SETTINGS (Per-Member Override)
-- =============================================================
CREATE TABLE IF NOT EXISTS member_withdrawal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  fee_percentage numeric(8,4) NOT NULL DEFAULT 0,
  fixed_fee numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id)
);
ALTER TABLE member_withdrawal_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_mem_wd_settings_user ON member_withdrawal_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_mem_wd_settings_member ON member_withdrawal_settings(member_id);

DROP POLICY IF EXISTS "select_own_mem_wd_settings" ON member_withdrawal_settings;
CREATE POLICY "select_own_mem_wd_settings" ON member_withdrawal_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_mem_wd_settings" ON member_withdrawal_settings;
CREATE POLICY "insert_own_mem_wd_settings" ON member_withdrawal_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_mem_wd_settings" ON member_withdrawal_settings;
CREATE POLICY "update_own_mem_wd_settings" ON member_withdrawal_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_mem_wd_settings" ON member_withdrawal_settings;
CREATE POLICY "delete_own_mem_wd_settings" ON member_withdrawal_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
