/*
# FinanceHub — Member PIN Access / Monitoring Mode (v1.11.0)

## Overview
Menambahkan "Ruang Anggota": setiap anggota grup bisa diberi PIN unik
(4-8 digit) oleh admin. Anggota memakai PIN itu di halaman publik
`/monitor` (TIDAK perlu daftar akun/login email sama sekali) untuk
melihat data Keuangan Grup secara READ-ONLY: saldo semua anggota,
riwayat transaksi, grafik tren, dan papan peringkat.

## New Column
- `group_members.pin_code_hash` — PIN di-hash pakai bcrypt (pgcrypto),
  tidak pernah disimpan dalam bentuk teks biasa.

## New Functions (SECURITY DEFINER)
1. `set_member_pin(p_member_id, p_pin)` — admin (pemilik grup yang login)
   generate/reset PIN anggota. Validasi PIN 4-8 digit angka.
2. `clear_member_pin(p_member_id)` — admin hapus PIN anggota (menonaktifkan
   akses monitoring anggota tsb).
3. `verify_member_pin(p_pin)` — dipanggil TANPA autentikasi dari halaman
   publik `/monitor`. Kalau PIN cocok, mengembalikan seluruh data grup
   terkait (group, members, transactions, details) dalam bentuk JSON agar
   bisa dirender read-only di client memakai fungsi kalkulasi yang sama
   (lib/finance.ts) seperti yang dipakai admin.

## Security Notes
- PIN di-hash dengan bcrypt (pgcrypto `crypt()`), bukan plaintext.
- `verify_member_pin` bersifat publik by design (dipanggil tanpa login) —
  keamanannya bergantung pada PIN yang cukup acak dan tidak mudah ditebak
  (disarankan 6 digit). Tidak ada rate-limiting di level ini; untuk
  penggunaan grup kecil/personal ini captured risk yang wajar.
- Fungsi admin (`set_member_pin`, `clear_member_pin`) memverifikasi
  `auth.uid()` cocok dengan `user_id` pemilik anggota tsb sebelum mengizinkan
  perubahan.
*/

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS pin_code_hash text;

CREATE INDEX IF NOT EXISTS idx_group_members_pin ON group_members(pin_code_hash) WHERE pin_code_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION set_member_pin(p_member_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.id = p_member_id AND gm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'PIN harus 4-8 digit angka';
  END IF;

  UPDATE group_members
  SET pin_code_hash = crypt(p_pin, gen_salt('bf'))
  WHERE id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_member_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION clear_member_pin(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_members gm WHERE gm.id = p_member_id AND gm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE group_members SET pin_code_hash = NULL WHERE id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION clear_member_pin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION verify_member_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_group record;
  result jsonb;
BEGIN
  IF p_pin IS NULL OR p_pin = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN kosong');
  END IF;

  SELECT * INTO v_member
  FROM group_members
  WHERE pin_code_hash IS NOT NULL
    AND pin_code_hash = crypt(p_pin, pin_code_hash)
  LIMIT 1;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN tidak ditemukan atau salah');
  END IF;

  SELECT * INTO v_group FROM groups WHERE id = v_member.group_id;

  SELECT jsonb_build_object(
    'success', true,
    'member_id', v_member.id,
    'member_name', v_member.name,
    'group', to_jsonb(v_group),
    'members', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM group_members m WHERE m.group_id = v_group.id), '[]'::jsonb),
    'transactions', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM group_transactions t WHERE t.group_id = v_group.id), '[]'::jsonb),
    'details', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM member_transaction_details d WHERE d.group_id = v_group.id), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_member_pin(text) TO anon, authenticated;
