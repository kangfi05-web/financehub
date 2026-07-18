/*
# FinanceHub — Group Join Requests (v1.14.0)

## Overview
Menambahkan alur pendaftaran publik untuk calon anggota grup:
1. Halaman publik `/join` — siapa saja bisa isi form (nama, alamat, NIK,
   no HP, grup yang diminati) tanpa perlu login.
2. Data tersimpan ke `group_join_requests`, admin dapat notifikasi
   Telegram otomatis.
3. Admin buka halaman "Permintaan Bergabung" untuk lihat & tindak lanjuti
   (tambahkan sebagai anggota grup, generate PIN via fitur yang sudah ada).

## Security Notes
- NIK adalah data pribadi sensitif. Kolom ini HANYA bisa dibaca oleh user
  yang login (admin) — RLS SELECT dibatasi `TO authenticated`.
- INSERT bersifat publik (anon) by design, supaya calon anggota tidak
  perlu akun untuk mendaftar. Tidak ada SELECT/UPDATE/DELETE untuk anon.
*/

CREATE TABLE IF NOT EXISTS group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  address text NOT NULL,
  nik text NOT NULL,
  phone text NOT NULL,
  requested_group text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','approved','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_join_requests" ON group_join_requests;
CREATE POLICY "public_insert_join_requests" ON group_join_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_join_requests" ON group_join_requests;
CREATE POLICY "authenticated_select_join_requests" ON group_join_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_update_join_requests" ON group_join_requests;
CREATE POLICY "authenticated_update_join_requests" ON group_join_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_join_requests" ON group_join_requests;
CREATE POLICY "authenticated_delete_join_requests" ON group_join_requests
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_join_requests_status ON group_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_created ON group_join_requests(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE group_join_requests;
