# Changelog

Semua perubahan penting pada FinanceHub dicatat di sini.
Format mengikuti [Semantic Versioning](https://semver.org/): MAJOR.MINOR.PATCH.

## [1.3.0] - 2026-07-13

### Added
- Dialog konfirmasi sebelum submit **Tambah Modal** dan **Penarikan Dana**,
  menampilkan ringkasan nominal, potongan/fee, dan saldo sebelum-sesudah.
  Mengurangi risiko salah input nominal besar yang langsung tersimpan tanpa
  jeda konfirmasi.

### Security Note (manual, dashboard-only)
- Direkomendasikan mengaktifkan **Leaked Password Protection** di Supabase
  Dashboard → Authentication → Providers → Email (tidak bisa diaktifkan
  lewat migration/API, hanya lewat dashboard).

---

## [1.2.0] - 2026-07-13

### Fixed
- **Tambah Modal dihitung ganda.** Sebelumnya, saat menambah modal anggota,
  sistem menambah `initial_capital` anggota SEKALIGUS mencatatnya sebagai
  transaksi "Pemasukan" biasa — sehingga Total Modal naik dua kali lipat dari
  seharusnya, dan Profit Grup ikut naik secara keliru.
- **Penarikan belum konsisten mengurangi modal.** Penarikan dana sebelumnya
  hanya mengurangi saldo lewat catatan transaksi, tapi tidak mengurangi
  `initial_capital` anggota secara langsung seperti halnya Tambah Modal.

### Changed
- Tambah Modal dan Penarikan Dana kini sama-sama langsung mengubah modal
  (`initial_capital`) anggota — naik saat tambah modal, turun saat menarik.
- Kedua transaksi ini ditandai `is_capital_adjustment = true` sehingga tidak
  lagi dihitung sebagai Pemasukan/Pengeluaran/Profit operasional.
- **Total Modal/Saldo Grup** kini selalu sama persis dengan penjumlahan
  saldo seluruh anggota grup — setiap penambahan atau penarikan modal
  anggota langsung tercermin di angka Total Modal Grup secara real-time.
- Total Pemasukan, Pengeluaran, dan Profit Grup sekarang murni berasal dari
  transaksi operasional (bukan mutasi modal).

---

## [1.1.1] - 2026-07-13

### Fixed
- Error `Could not find the 'is_capital_adjustment' column` saat penarikan
  saldo. Penyebab akarnya: project Supabase asli (`ocnslncgjvlrckdhthpc`,
  dibuat otomatis oleh Bolt.new) sudah tidak bisa diakses/tidak ditemukan.

### Changed
- Database dipindahkan ke project Supabase baru (`dnvhyrbrrnvuvoxsbclp`).
- Seluruh migration dijalankan ulang di project baru: schema utama, modul
  manajemen saldo, dan flag `is_capital_adjustment`.
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` di Netlify diarahkan ke
  project baru.

### Known Impact
- Data lama (grup, anggota, transaksi) tidak dapat dipulihkan karena project
  lama sudah tidak dapat diakses. Aplikasi mulai dari database kosong.

---

## [1.1.0] - 2026-07-13

### Fixed
- **Penarikan modal grup salah dihitung sebagai pengeluaran.** Sebelumnya, saat
  anggota grup melakukan penarikan saldo, transaksi dicatat sebagai
  "Pengeluaran" biasa di `group_transactions`, sehingga ikut mengurangi
  **Total Pengeluaran** dan **Profit Grup**. Ini mengganggu akurasi laporan
  saat grup mulai menjalankan investasi.

### Changed
- Penarikan saldo anggota kini ditandai `is_capital_adjustment = true`.
- **Total Modal Grup** sekarang berkurang otomatis mengikuti penarikan dana
  anggota.
- **Total Pengeluaran** dan **Profit Grup** tidak lagi terpengaruh oleh
  penarikan modal — hanya transaksi operasional (income/expense asli) yang
  dihitung.
- Riwayat transaksi grup menampilkan badge terpisah **"Penarikan Modal"**
  untuk membedakannya dari pengeluaran operasional.

### Database
- Migration `20260713090000_add_capital_adjustment_flag.sql`: menambahkan
  kolom `is_capital_adjustment` pada tabel `group_transactions` dan
  `member_transaction_details`.

---

## [1.0.1] - 2026-07-13

### Fixed
- Layar putih (blank screen) setelah deploy ke Netlify — disebabkan oleh
  `VITE_SUPABASE_ANON_KEY` yang ditandai sebagai *secret* env var sehingga
  di-strip dari bundle JS saat build. Diperbaiki dengan menandainya sebagai
  env var biasa (public/anon key memang dirancang untuk dipakai di client).
- Menambahkan `public/_redirects` agar routing SPA (React Router) berjalan
  benar di Netlify.

---

## [1.0.0] - 2026-07-12

### Added
- Rilis awal FinanceHub: modul keuangan pribadi, keuangan grup, dan
  manajemen saldo (penambahan modal & penarikan dana).
