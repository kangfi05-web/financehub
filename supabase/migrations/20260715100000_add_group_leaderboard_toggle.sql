/*
# FinanceHub — Group Leaderboard Toggle (v1.10.0)

Menambahkan kolom `show_leaderboard` pada tabel `groups` supaya pemilik
grup bisa menyalakan/mematikan tampilan Papan Peringkat perbandingan
antar anggota. Default: aktif (true).
*/

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS show_leaderboard boolean NOT NULL DEFAULT true;
