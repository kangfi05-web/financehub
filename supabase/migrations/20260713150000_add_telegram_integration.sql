/*
# FinanceHub — Telegram Bot Integration (v1.7.0, Tahap 1)

## Overview
Menambahkan kemampuan mencatat transaksi via perintah teks di Telegram.
Alur: user generate kode link di app -> kirim /start <kode> ke bot ->
akun Telegram ter-hubung ke akun FinanceHub -> user bisa kirim perintah
seperti "/pengeluaran 50000 bensin" untuk mencatat transaksi personal.

## New Tables
1. `telegram_link_codes` — kode sekali pakai untuk menghubungkan akun,
   dibuat dari halaman Pengaturan, kedaluwarsa 10 menit.
2. `telegram_accounts` — pemetaan chat_id Telegram -> user_id FinanceHub
   setelah link berhasil.

## Security
- RLS aktif di kedua tabel, user hanya bisa lihat/hapus link miliknya sendiri.
- Insert/update dari sisi Edge Function memakai service role (bypass RLS
  by design, karena dipicu oleh webhook Telegram, bukan sesi user login).
*/

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tg_link_codes_user ON telegram_link_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_link_codes_code ON telegram_link_codes(code);
DROP POLICY IF EXISTS "select_own_tg_link_codes" ON telegram_link_codes;
CREATE POLICY "select_own_tg_link_codes" ON telegram_link_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tg_link_codes" ON telegram_link_codes;
CREATE POLICY "insert_own_tg_link_codes" ON telegram_link_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tg_link_codes" ON telegram_link_codes;
CREATE POLICY "delete_own_tg_link_codes" ON telegram_link_codes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS telegram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id text NOT NULL UNIQUE,
  telegram_username text,
  default_business_id uuid REFERENCES personal_business(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE telegram_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tg_accounts_user ON telegram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_accounts_chat ON telegram_accounts(chat_id);
DROP POLICY IF EXISTS "select_own_tg_accounts" ON telegram_accounts;
CREATE POLICY "select_own_tg_accounts" ON telegram_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tg_accounts" ON telegram_accounts;
CREATE POLICY "delete_own_tg_accounts" ON telegram_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tg_accounts" ON telegram_accounts;
CREATE POLICY "update_own_tg_accounts" ON telegram_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
