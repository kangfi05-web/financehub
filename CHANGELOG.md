# Changelog

Semua perubahan penting pada FinanceHub dicatat di sini.
Format mengikuti [Semantic Versioning](https://semver.org/): MAJOR.MINOR.PATCH.

## [1.18.0] - 2026-07-20

### Added
- **Alur "Terima & Buatkan PIN" terpadu** di halaman Permintaan Bergabung:
  - Klik tombol → pilih grup tujuan + modal awal di dialog.
  - Satu klik "Terima & Buatkan PIN" langsung: insert `group_members`,
    panggil `set_member_pin` RPC untuk generate PIN 6 digit, dan update
    status permintaan jadi `approved` — tiga langkah manual sebelumnya
    jadi satu aksi.
  - PIN yang dihasilkan ditampilkan di dialog konfirmasi dengan tombol
    salin, siap dibagikan ke anggota baru.
- Query `groups` ditambahkan ke halaman ini untuk mengisi dropdown
  pilihan grup tujuan.

### Notes
- Tidak ada perubahan pada skema database — memakai tabel dan fungsi
  yang sudah ada (`group_members`, `set_member_pin`).

---

## [1.17.0] - 2026-07-20

### Added
- **Backup otomatis harian** — belajar dari insiden project Supabase
  lama yang hilang total tanpa jejak, sekarang ada salinan data yang
  benar-benar berada DI LUAR Supabase:
  - Extension `pg_cron` + `pg_net` diaktifkan.
  - Fungsi `export_backup_json()`: mengumpulkan semua tabel penting
    (termasuk `pin_code_hash` anggota, supaya PIN tidak perlu dibuat
    ulang kalau harus restore).
  - Job terjadwal `daily-financehub-backup`, jalan tiap hari jam 23:00
    UTC (06:00 WIB), memanggil Edge Function baru `send-backup`.
  - `send-backup` mengirim file JSON ke chat Telegram admin via
    `sendDocument`.
  - Tombol **"Kirim Backup ke Telegram Sekarang"** di Pengaturan untuk
    backup manual kapan saja — terpisah dari fitur "Backup Database"
    manual (unduh ke perangkat) yang sudah ada sebelumnya.

### Fixed
- **Link reset password sering gagal** ("token sudah tidak ada/
  kedaluwarsa") meski baru saja dikirim. Penyebabnya: pemindai
  keamanan email (Gmail/Outlook) otomatis "mencicipi" link di email
  sebelum pengguna sempat klik, menghabiskan token sekali-pakainya.
  Diperbaiki dengan beralih ke flow **PKCE** (`flowType: 'pkce'` di
  client Supabase), yang mensyaratkan kode verifikasi lokal di browser
  yang sama — pemindai otomatis tidak punya ini, jadi link tetap valid
  saat pengguna asli mengkliknya.
- `ResetPasswordPage` sekarang mendengarkan event `PASSWORD_RECOVERY`
  dari `onAuthStateChange` (bukan cuma cek sesi sekali di awal), supaya
  tidak "kepagian" sebelum proses tukar kode PKCE selesai.

---

## [1.16.0] - 2026-07-18

### Added
- **Lupa Kata Sandi** untuk admin — sejak pendaftaran admin baru dikunci
  total (v1.15.0), perlu jalur resmi kalau lupa sandi:
  - Link "Lupa kata sandi?" di halaman Masuk (`/auth`).
  - Masukkan email → Supabase kirim link reset → klik link → diarahkan
    ke halaman baru `/reset-password` untuk atur kata sandi baru.
  - `AuthContext` mendapat fungsi baru `resetPassword` dan
    `updatePassword`.
  - Pesan error diperluas untuk kasus link kedaluwarsa, sesi reset
    hilang, dan rate limit.

### Notes
- `/reset-password` sengaja TIDAK dibungkus `PublicRoute` — setelah klik
  link dari email, Supabase membuat sesi "recovery" sementara (`user`
  jadi truthy), yang kalau dibungkus `PublicRoute` akan langsung
  di-redirect ke `/` sebelum sempat atur kata sandi baru.
- Kalau pengiriman email reset bermasalah (pernah terjadi sebelumnya di
  project ini karena rate limit SMTP bawaan Supabase), jalur cadangan
  tetap tersedia: reset manual lewat database.

---

## [1.15.0] - 2026-07-18

### Security
- **Ditemukan celah:** karena aplikasi ini didesain single-admin (bukan
  multi-tenant per-user), 4 akun lain yang sempat mendaftar sebelum ada
  pembatasan (`hafiffdn05@gmail.com`, `babangok160@gmail.com`,
  `hafififdnshop@gmail.com`, `gunawan.skr@gmail.com`) ternyata punya akses
  penuh ke SEMUA data admin (grup, transaksi, dll), bukan cuma data
  mereka sendiri. Keempatnya sudah dihapus dari database.
- **`AuthPage` disederhanakan jadi login-only** — opsi "Daftar di sini"
  dan seluruh alur sign-up dihapus total dari antarmuka. Halaman ini
  sekarang murni untuk admin pemilik masuk, bukan mendaftar.

### Manual Action Recommended
- Matikan **"Allow new users to sign up"** di Supabase Dashboard →
  Authentication → Sign In/Providers → User Signups. Ini penegakan di
  level backend (bukan cuma UI) yang memastikan tidak ada jalur apa pun
  untuk membuat akun admin baru ke depannya.

---

## [1.14.1] - 2026-07-18

### Fixed
- **Form `/join` gagal terkirim** ("Gagal mengirim, coba lagi."). Root
  cause: `.select().single()` dipanggil setelah INSERT untuk mengambil
  `id` baris baru, tapi role `anon` (pengunjung publik tanpa login)
  sengaja tidak diberi kebijakan RLS SELECT pada `group_join_requests`
  (demi privasi NIK & data pribadi pendaftar lain). PostgREST melaporkan
  ini sebagai error "new row violates row-level security policy" — bukan
  karena INSERT-nya gagal, tapi RETURNING-nya yang diblokir RLS.
- Fix: `id` permintaan sekarang di-generate di sisi client
  (`crypto.randomUUID()`) sebelum INSERT, sehingga tidak perlu membaca
  balik hasilnya dari database. Kebijakan RLS SELECT untuk `anon` TETAP
  tidak diberikan (privasi data pendaftar tetap terjaga).

### Verified
- Dikonfirmasi ulang: `ProtectedRoute` sudah mengarahkan pengunjung yang
  belum login dari `/` ke `/welcome` secara otomatis sejak v1.14.0 — tidak
  ada perubahan tambahan diperlukan untuk menjadikan `/welcome` "halaman
  utama".

---

## [1.14.0] - 2026-07-16

### Added
- **Halaman depan baru `/welcome`** — pintu masuk publik dengan 2 pilihan:
  "Saya Admin" (ke halaman login) atau "Join Grup" (ke form pendaftaran).
  Route terlindungi (`ProtectedRoute`) sekarang mengarahkan pengunjung yang
  belum login ke sini, bukan langsung ke `/auth`.
- **Form pendaftaran publik `/join`** — tanpa perlu akun: Nama Lengkap,
  Alamat, NIK (16 digit, tervalidasi), No HP Aktif, dan Grup yang Diminati
  (opsional).
- **Notifikasi Telegram otomatis** ke admin setiap ada pendaftaran baru,
  via Edge Function baru `notify-join-request` — lengkap nama, alamat,
  NIK, no HP, dan minat grup.
- **Halaman admin "Permintaan Bergabung"** (`/join-requests`, terlindungi
  login) — daftar semua pendaftar dengan badge jumlah permintaan baru di
  Sidebar, NIK disamarkan by default (bisa di-reveal), tombol tandai
  status (Sudah Dihubungi / Diterima / Ditolak) dan hapus.

### Database
- Migration `20260716100000_add_group_join_requests.sql`: tabel baru
  `group_join_requests`. INSERT publik (anon), tapi SELECT/UPDATE/DELETE
  hanya untuk user yang login (admin) — NIK dan data pribadi lain tidak
  pernah bisa diakses publik.

### Notes
- Alur PIN untuk anggota (generate/reset/kelola) tetap memakai fitur yang
  sudah ada di Keuangan Grup — belum diotomatisasi penuh dari halaman
  Permintaan Bergabung, admin masih menambahkan anggota & generate PIN
  secara manual setelah meninjau pendaftaran (disengaja, supaya admin
  tetap mengontrol siapa yang benar-benar ditambahkan ke grup mana).
- URL Edge Function di `JoinGroupPage` memakai `supabase.functions.invoke()`
  (bukan URL hardcoded) supaya tidak rawan putus kalau project Supabase
  berpindah di kemudian hari.

---

## [1.13.0] - 2026-07-16

### Added
- **Kartu "Saldo Kamu"** di paling atas halaman `/monitor` — lebih besar
  dan menonjol dari kartu lain: avatar besar berwarna, saldo & profit
  dengan angka animasi, plus mini grafik tren (sparkline) saldo pribadi
  dari waktu ke waktu.
- **Donut chart "Komposisi Modal Grup"** — visualisasi porsi kontribusi
  modal tiap anggota terhadap total modal grup.
- **Warna konsisten per anggota** (`src/lib/member-colors.ts`, baru): satu
  anggota selalu dapat warna yang sama di avatar, grafik tren, dan donut
  chart — dipakai bersama di halaman admin (Keuangan Grup) maupun Ruang
  Anggota (`/monitor`), supaya gampang dikenali sekilas tanpa baca nama.

### Fixed (ditemukan & diperbaiki saat pengembangan fitur ini)
- Perbaikan pelanggaran React "Rules of Hooks" di `MemberMonitorPage`: satu
  `useMemo` sempat ditempatkan setelah early-return kondisional, yang bisa
  menyebabkan urutan pemanggilan hooks tidak konsisten antar render.
  Dipindahkan ke posisi yang benar (sebelum semua early-return) dan
  diverifikasi bersih lewat ESLint (`react-hooks/rules-of-hooks`) serta
  full type-check dan production build.

### Notes
- `StatCard` value type sudah `ReactNode` sejak v1.12.0 — dipakai lagi di
  sini tanpa perubahan tambahan.
- Tidak ada logika kalkulasi (`computeGroupSummary`, `computeMemberSummary`,
  urutan peringkat) yang diubah pada rilis ini.

---

## [1.12.0] - 2026-07-16

### Added
- **Angka animasi (AnimatedNumber)** — nilai saldo, profit, dan total di
  halaman `/monitor` (Ruang Anggota) sekarang menghitung naik/turun secara
  halus (ease-out) tiap kali datanya berubah, bukan langsung ganti statis.
  Otomatis nonaktif kalau pengguna mengaktifkan "prefers-reduced-motion".
- **Indikator live** di header `/monitor`: titik hijau berkedip + teks
  "Update X detik lalu", menunjukkan data memang diperbarui otomatis.
- **Animasi masuk bertahap** — kartu-kartu (ringkasan, saldo anggota,
  papan peringkat, riwayat) muncul fade-in dari bawah secara berurutan
  saat halaman dibuka, memakai animasi `slide-up` yang sudah ada di
  desain sistem (tidak menambah animasi baru).

### Notes
- Perubahan ini murni visual/kosmetik pada halaman `/monitor`. Logika
  perhitungan (`computeGroupSummary`, `computeMemberSummary`, urutan
  papan peringkat) tidak disentuh sama sekali — sudah diverifikasi lewat
  build & type-check penuh tanpa error.
- `StatCard` kini menerima `value` sebagai `ReactNode` (sebelumnya
  `string`) agar bisa menampung komponen angka animasi; perubahan ini
  backward-compatible karena string tetap valid `ReactNode`, dipastikan
  tidak memengaruhi pemakaian `StatCard` di halaman lain.

---

## [1.11.1] - 2026-07-15

### Fixed
- **"Buat PIN" tidak menghasilkan apa-apa.** Fungsi `set_member_pin`,
  `clear_member_pin`, dan `verify_member_pin` gagal dengan error
  `function gen_salt(unknown) does not exist` — `SET search_path = public`
  tidak menyertakan schema `extensions`, tempat ekstensi `pgcrypto`
  (fungsi `crypt`/`gen_salt`) terpasang di project Supabase ini.
- Ketiga fungsi diperbaiki (`search_path = public, extensions`). PIN
  sekarang berhasil dibuat, di-reset, dan diverifikasi dengan benar.

---

## [1.11.0] - 2026-07-15

### Added
- **Ruang Anggota (Member PIN Access)** — fitur besar baru:
  - Halaman publik **`/monitor`** — anggota grup masukkan PIN 4-8 digit
    (tanpa perlu daftar akun/email sama sekali) untuk memantau Keuangan
    Grup secara read-only: saldo semua anggota, papan peringkat, dan
    riwayat transaksi grup lengkap.
  - Admin bisa **generate/reset/nonaktifkan PIN** tiap anggota lewat ikon
    kunci di kartu anggota (halaman Keuangan Grup).
  - PIN di-hash dengan bcrypt (pgcrypto), tidak pernah tersimpan sebagai
    teks biasa.
  - Tidak ada tombol tambah/edit/hapus di mode ini — murni lihat-saja.

### Database
- Migration `20260715120000_add_member_pin_access.sql`:
  - Kolom baru `group_members.pin_code_hash`.
  - Fungsi `set_member_pin`, `clear_member_pin` (khusus admin/pemilik
    grup yang login).
  - Fungsi `verify_member_pin` (publik, dipanggil tanpa login dari
    halaman `/monitor`).

### Security Notes
- `verify_member_pin` disengaja bersifat publik (tanpa autentikasi) agar
  anggota tidak perlu akun. Keamanannya bergantung pada PIN yang cukup
  acak (disarankan 6 digit, di-generate otomatis oleh sistem).

---

## [1.10.1] - 2026-07-15

### Fixed
- **Papan Peringkat salah urutan.** Sebelumnya diurutkan berdasarkan
  persentase profit — tapi karena transaksi grup dibagi proporsional
  sesuai porsi modal, persentase profit SELALU sama untuk semua anggota
  (semua dapat return % yang sama), sehingga urutan peringkat jadi acak/
  tidak mencerminkan siapa yang benar-benar untung paling besar.
- Sekarang diurutkan berdasarkan **profit dalam Rupiah**, jadi anggota
  dengan nominal keuntungan terbesar benar-benar menempati peringkat 1.
- Tampilan kartu peringkat disesuaikan: nominal Rupiah jadi angka utama
  (lebih besar/tebal), persentase jadi info sekunder.

---

## [1.10.0] - 2026-07-15

### Added
- **Grafik "Tren Saldo per Anggota"** di Keuangan Grup — line chart dengan
  garis terpisah warna-warni untuk tiap anggota, menunjukkan perkembangan
  saldo mereka seiring waktu berdasarkan riwayat transaksi.
- **Papan Peringkat Anggota** — mengurutkan anggota berdasarkan persentase
  profit tertinggi, dengan badge juara 1/2/3.
- Toggle **"🏆 Papan Peringkat"** di header grup untuk menyalakan/mematikan
  fitur ini per grup — memberi kontrol ke pemilik grup kalau ada anggota
  yang tidak nyaman uangnya dibanding-bandingkan secara terbuka.

### Database
- Migration `20260715100000_add_group_leaderboard_toggle.sql`: kolom baru
  `show_leaderboard` (default `true`) pada tabel `groups`.

---

## [1.9.0] - 2026-07-15

### Changed
- **Strategi auto-refresh diubah dari full-realtime ke hybrid (realtime +
  polling).** WebSocket realtime Supabase terbukti sulit diandalkan 100%
  di kondisi jaringan/browser tertentu meski secara teknis sudah terhubung
  (`SUBSCRIBED`) dan token otentikasi sudah benar. Daripada terus
  bergantung sepenuhnya padanya, aplikasi sekarang JUGA melakukan polling
  otomatis setiap 8 detik untuk semua data, sebagai jaminan tambahan yang
  pasti berhasil.
- `refetchOnWindowFocus` diaktifkan — data ikut diperbarui begitu kamu
  kembali ke tab aplikasi.
- `staleTime` dipersingkat dari 30 detik menjadi 5 detik.

### Impact
- Transaksi dari bot Telegram (atau sumber mana pun) sekarang akan muncul
  otomatis di aplikasi dalam hitungan detik, tanpa perlu refresh manual —
  terlepas dari apakah koneksi realtime berhasil atau tidak.

---

## [1.8.4] - 2026-07-15

### Fixed
- **Realtime sama sekali tidak berjalan (termasuk Dashboard yang sebelumnya
  berfungsi).** Akar masalah: token JWT sesi login tidak dikirim eksplisit
  ke koneksi WebSocket realtime Supabase. Karena semua tabel memakai RLS
  (`auth.uid() = user_id`), tanpa token yang valid di sisi realtime,
  `auth.uid()` bernilai NULL dan setiap event perubahan data ditolak secara
  diam-diam oleh RLS — tanpa error yang terlihat di console. Data biasa
  (lewat query manual/refresh) tetap normal karena itu memakai jalur
  otentikasi REST API yang berbeda dan benar.

### Changed
- `useRealtimeSync` sekarang memanggil `supabase.realtime.setAuth(token)`
  secara eksplisit sebelum channel di-subscribe, dan mengirim ulang token
  setiap kali sesi di-refresh otomatis (event `TOKEN_REFRESHED`).
- Nama channel realtime dibuat unik per-mount (`-${Date.now()}`) untuk
  menghindari konflik topik saat re-render/re-mount.

---

## [1.8.3] - 2026-07-14

### Fixed
- **Login gagal "email/sandi salah" padahal baru daftar.** Penyebabnya
  Supabase Auth mewajibkan konfirmasi email sebelum login diizinkan.
  Percobaan login dengan email belum terkonfirmasi ditolak dengan pesan
  yang sama seperti kredensial salah, sehingga membingungkan.
- Akun yang sudah terlanjur mendaftar (`babangok160@gmail.com`,
  `hafiffdn05@gmail.com`) dikonfirmasi manual lewat database — sudah bisa
  login sekarang.

### Changed
- Pesan error login diperjelas untuk membedakan kasus "email belum
  dikonfirmasi" vs kredensial yang benar-benar salah.

### Manual Action Recommended
- Nonaktifkan **"Confirm email"** di Supabase Dashboard → Authentication →
  Providers → Email, supaya pengguna baru bisa langsung login setelah
  daftar tanpa perlu klik link konfirmasi di email.

---

## [1.8.2] - 2026-07-14

### Fixed
- **Realtime tidak berlaku di Keuangan Grup & Keuangan Pribadi.** Sebelumnya
  langganan realtime dipasang di dalam hook `useDashboardData`, yang hanya
  dipakai oleh Dashboard, Riwayat, dan Laporan. Halaman Keuangan Grup dan
  Keuangan Pribadi memakai query data sendiri (terpisah), sehingga tidak
  pernah "mendengar" perubahan data dari bot Telegram — harus refresh
  manual, meski Dashboard sudah update otomatis.

### Changed
- Realtime sync dipindahkan ke `AppLayout` (komponen yang selalu aktif di
  semua halaman berlogin), lewat hook baru `useRealtimeSync`. Sekarang
  SEMUA halaman ikut auto-refresh saat ada perubahan data dari mana pun,
  termasuk dari perintah bot Telegram.

---

## [1.8.1] - 2026-07-14

### Fixed
- **Perintah grup masih salah masuk ke Pribadi saat pengeluaran.** Akar
  masalah: bot hanya mendeteksi kata "grup" jika berada TEPAT setelah
  nominal. Kalau user menulis kata lain duluan (mis. "300000 keuangan
  grup a bensin"), deteksi gagal dan transaksi jatuh ke Keuangan Pribadi.
  Sekarang bot mencari kata "grup" di posisi mana pun dalam kalimat.

---

## [1.8.0] - 2026-07-14

### Added
- **Perintah bot lengkap** — semua aksi utama aplikasi kini bisa dilakukan
  lewat Telegram:
  - `/tambahmodal <nominal> [deskripsi]` — Tambah Modal Pribadi
  - `/tambahmodal <nominal> grup <nama grup> <nama anggota> [deskripsi]` — Tambah Modal Grup
  - `/tarik <nominal> [alasan]` — Tarik Dana Pribadi
  - `/tarik <nominal> grup <nama grup> <nama anggota> [alasan]` — Tarik Dana Grup
  - `/saldo grup <nama grup> <nama anggota>` — saldo satu anggota spesifik
- Penarikan dana lewat bot menghitung potongan biaya otomatis, memakai
  prioritas yang sama seperti aplikasi: override per-anggota
  (`member_withdrawal_settings`) dulu, baru fallback ke setting grup
  (`withdrawal_settings`).
- Pencarian nama grup/anggota fleksibel: bisa nama sebagian/awalan, tidak
  harus persis sama.

---

## [1.7.1] - 2026-07-14

### Fixed
- **Bot mencatat ke tempat yang salah.** Perintah seperti
  `/pengeluaran 200000 grup a` sebelumnya dianggap kategori teks biasa
  ("grup a"), sehingga transaksi selalu masuk ke Keuangan Pribadi meski
  user menargetkan Grup. Sekarang bot mengenali kata kunci `grup <nama>`
  dan mencatat ke Keuangan Grup yang benar.
- **Data tidak auto-update.** Transaksi yang ditambahkan lewat bot
  Telegram (atau sumber lain) tidak langsung terlihat di aplikasi tanpa
  reload manual. Sekarang aplikasi memakai Supabase Realtime untuk
  auto-refresh begitu ada perubahan data.

### Added
- Bot bisa mencatat ke **Keuangan Grup**, otomatis dibagi proporsional ke
  semua anggota sesuai porsi modal masing-masing (sama seperti transaksi
  grup lewat aplikasi).
- Perintah baru: `/saldo grup <nama grup>`.
- Realtime sync aktif untuk semua tabel transaksi utama.

---

## [1.7.0] - 2026-07-13

### Added
- **Integrasi Telegram Bot (Tahap 1)** — mencatat transaksi Keuangan
  Pribadi lewat perintah teks di Telegram, tanpa buka aplikasi:
  - `/start <kode>` — hubungkan akun Telegram ke FinanceHub
  - `/pengeluaran <nominal> [kategori]` — catat pengeluaran
  - `/pemasukan <nominal> [kategori]` — catat pemasukan
  - `/saldo` — cek saldo bisnis pribadi
  - `/help` — bantuan
  - Nominal fleksibel: 50000, 50.000, 50rb, 50k, 1.5jt
- Halaman **Pengaturan → Hubungkan Telegram**: generate kode sekali pakai
  (berlaku 10 menit) untuk menghubungkan akun.
- Edge Function `telegram-webhook` di Supabase sebagai penerima pesan bot.
- Tabel baru: `telegram_link_codes`, `telegram_accounts`.

### Roadmap (belum dikerjakan)
- Tahap 2: dukungan pencatatan Keuangan Grup lewat bot.
- Tahap 3: baca foto struk/nota otomatis pakai AI vision (OCR).

---

## [1.6.0] - 2026-07-13

### Added
- Angka berjalan sesi (pola yang sama seperti Keuangan Grup) sekarang juga
  tersedia di **Keuangan Pribadi**, di atas pilihan Jenis Transaksi.
- Angka berjalan sesi di **Manajemen Saldo**:
  - Form **Tambah Modal**: "Total ditambahkan (sesi ini)".
  - Form **Penarikan Dana**: "Total ditarik (sesi ini)".
  - Masing-masing punya tombol **Reset** sendiri.

### Notes
- Tombol Reset di atas murni membersihkan angka tampilan sesi (React state
  lokal, tidak tersimpan ke database) — **tidak** menyentuh data
  **Pengaturan Potongan** (`withdrawal_settings`, `member_withdrawal_settings`)
  sama sekali.

---

## [1.5.1] - 2026-07-13

### Changed (koreksi dari v1.5.0)
- Card **"Riwayat Detail Pemasukan & Pengeluaran"** (permanen, tabel penuh)
  dihapus — ternyata bukan yang dimaksud, dan datanya sudah ada di Riwayat
  Transaksi Grup.

### Added
- **Angka berjalan sementara** di form tambah transaksi cepat (Keuangan
  Grup), tepat di atas pilihan "Jenis Transaksi":
  - Tiap submit Pengeluaran menambah ke total berjalan Pengeluaran.
  - Tiap submit Pemasukan menambah ke total berjalan Pemasukan (terpisah).
  - Kalau keduanya pernah diisi, keduanya tampil sekaligus secara ringkas.
  - Bersifat sesaat: hanya untuk sesi saat ini (tidak tersimpan ke
    database), ada tombol "Reset" manual, dan otomatis reset saat pindah
    grup.

---

## [1.5.0] - 2026-07-13

### Added
- Card **"Riwayat Detail Pemasukan & Pengeluaran"** di halaman Keuangan
  Grup: ringkasan Total Pemasukan/Pengeluaran besar di atas, diikuti daftar
  transaksi kronologis dengan **total berjalan (running total)** — setiap
  transaksi baru menambah ke total berjalan jenisnya masing-masing.

### Fixed
- **Penarikan dana terkesan dibatasi hanya sebesar Modal Awal.** Penyebabnya:
  dropdown pemilihan anggota di Tambah Modal & Penarikan Dana menampilkan
  `initial_capital` (modal awal), bukan saldo aktual/dana keseluruhan
  anggota. Validasi backend sebenarnya sudah benar (memakai saldo aktual),
  tapi tampilannya menyesatkan. Sekarang dropdown menampilkan saldo aktual.
- Label badge "Penarikan Modal" pada riwayat transaksi sekarang dinamis:
  "Tambah Modal" untuk penambahan, "Penarikan Modal" untuk penarikan.

---

## [1.4.0] - 2026-07-13

### Added
- **PWA (Progressive Web App)** — FinanceHub sekarang bisa di-install ke
  HP/laptop langsung dari browser, tanpa App Store/Play Store.
- Ikon aplikasi (72px–512px + maskable) dan manifest dengan tema warna brand.
- Banner "Install FinanceHub" otomatis muncul saat browser mendukung, bisa
  ditutup. Tombol install permanen juga tersedia di Pengaturan.
- Service worker meng-cache aset statis untuk loading lebih cepat di
  kunjungan berikutnya.

---

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
