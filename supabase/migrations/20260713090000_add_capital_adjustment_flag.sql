/*
# FinanceHub Pro - Capital Adjustment Flag (v1.1.0)

## Overview
Penarikan saldo anggota grup selama ini tercatat sebagai "Pengeluaran" biasa
di group_transactions, sehingga ikut mengurangi Total Pengeluaran dan Profit
Grup. Padahal penarikan dana adalah pengurangan MODAL, bukan biaya operasional.

Migration ini menambahkan flag `is_capital_adjustment` sehingga:
- Saldo anggota tetap berkurang (tidak berubah, sudah benar sebelumnya)
- Total Modal Grup ikut berkurang mengikuti penarikan
- Total Pengeluaran & Profit Grup TIDAK terpengaruh oleh penarikan modal
  (supaya tidak mengganggu perhitungan saat menjalankan investasi)

## Changes
1. `group_transactions` — tambah kolom `is_capital_adjustment boolean DEFAULT false`
2. `member_transaction_details` — tambah kolom `is_capital_adjustment boolean DEFAULT false`

## Security
No RLS changes needed; existing policies remain in effect.
*/

ALTER TABLE group_transactions
  ADD COLUMN IF NOT EXISTS is_capital_adjustment boolean NOT NULL DEFAULT false;

ALTER TABLE member_transaction_details
  ADD COLUMN IF NOT EXISTS is_capital_adjustment boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_group_tx_capital_adj ON group_transactions(is_capital_adjustment);
CREATE INDEX IF NOT EXISTS idx_member_tx_details_capital_adj ON member_transaction_details(is_capital_adjustment);
