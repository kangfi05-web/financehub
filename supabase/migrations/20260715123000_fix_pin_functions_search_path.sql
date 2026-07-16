/*
# FinanceHub — Fix PIN Functions search_path (v1.11.1)

Bug: fungsi set_member_pin/clear_member_pin/verify_member_pin gagal
dengan error "function gen_salt(unknown) does not exist" karena
SET search_path = public tidak menyertakan schema `extensions`, tempat
ekstensi pgcrypto (crypt, gen_salt) terpasang di project Supabase ini.

Fix: tambahkan `extensions` ke search_path ketiga fungsi.
*/

CREATE OR REPLACE FUNCTION set_member_pin(p_member_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

CREATE OR REPLACE FUNCTION clear_member_pin(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

CREATE OR REPLACE FUNCTION verify_member_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
