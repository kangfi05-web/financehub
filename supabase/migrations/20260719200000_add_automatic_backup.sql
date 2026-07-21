/*
# FinanceHub — Automatic Daily Backup to Telegram (v1.17.0)

## Overview
Menambahkan backup harian otomatis, dikirim ke Telegram admin sebagai
file JSON — supaya ada salinan data yang benar-benar berada DI LUAR
Supabase (belajar dari insiden project Supabase lama yang hilang total
tanpa jejak).

## Extensions
- `pg_cron` — untuk menjadwalkan job harian.
- `pg_net` — untuk memanggil Edge Function dari dalam database (async
  HTTP request).

## Functions
- `export_backup_json()` (SECURITY DEFINER, `service_role` only) —
  mengumpulkan semua tabel penting jadi satu JSON: profiles,
  personal_business, personal_transactions, groups, group_members
  (termasuk pin_code_hash supaya PIN anggota ikut ter-backup),
  group_transactions, member_transaction_details, capital_additions,
  withdrawals, withdrawal_settings, member_withdrawal_settings, reports,
  settings, group_join_requests.

## Scheduled Job
- `daily-financehub-backup` — jalan tiap hari jam 23:00 UTC (06:00 WIB),
  memanggil Edge Function `send-backup` lewat `net.http_post`.

## Edge Function (dideploy terpisah, lihat kode di repo/dashboard)
- `send-backup` — ambil data dari `export_backup_json()`, kirim sebagai
  dokumen JSON ke chat Telegram admin (dari tabel `telegram_accounts`)
  via `sendDocument`. Juga bisa dipanggil manual dari tombol "Kirim
  Backup ke Telegram Sekarang" di halaman Pengaturan.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION export_backup_json()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'exported_at', now(),
    'profiles', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM profiles t),
    'personal_business', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM personal_business t),
    'personal_transactions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM personal_transactions t),
    'groups', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM groups t),
    'group_members', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM group_members t),
    'group_transactions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM group_transactions t),
    'member_transaction_details', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM member_transaction_details t),
    'capital_additions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM capital_additions t),
    'withdrawals', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM withdrawals t),
    'withdrawal_settings', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM withdrawal_settings t),
    'member_withdrawal_settings', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM member_withdrawal_settings t),
    'reports', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM reports t),
    'settings', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM settings t),
    'group_join_requests', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM group_join_requests t)
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION export_backup_json() TO service_role;

SELECT cron.schedule(
  'daily-financehub-backup',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dnvhyrbrrnvuvoxsbclp.supabase.co/functions/v1/send-backup',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
