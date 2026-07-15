// FinanceHub — Version & Changelog Tracker
// Setiap perbaikan/update aplikasi ditambahkan sebagai entri baru di sini.

export const APP_VERSION = '1.8.3';

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.8.3',
    date: '2026-07-14',
    title: 'Perbaikan Login "Email/Sandi Salah" Padahal Sudah Daftar',
    changes: [
      'Akar masalah: Supabase mewajibkan konfirmasi email sebelum bisa login. Akun yang belum konfirmasi ditolak dengan pesan generik yang terlihat seperti "salah password", padahal bukan.',
      'Akun yang sudah terlanjur daftar sebelumnya dikonfirmasi manual — sudah bisa langsung login.',
      'Pesan error diperjelas untuk membedakan kasus email belum dikonfirmasi.',
      'Rekomendasi: matikan "Confirm email" di Supabase Dashboard supaya pengguna baru bisa langsung login setelah daftar.',
    ],
  },
  {
    version: '1.8.2',
    date: '2026-07-14',
    title: 'Realtime Sync Kini Berlaku di Semua Halaman',
    changes: [
      'Diperbaiki: auto-refresh realtime sebelumnya cuma aktif di Dashboard, Riwayat, dan Laporan — halaman Keuangan Grup dan Keuangan Pribadi tidak ikut ter-update karena punya query data sendiri yang terpisah.',
      'Sistem realtime dipindahkan ke level AppLayout (selalu aktif di semua halaman), sehingga transaksi dari bot Telegram kini langsung muncul di Keuangan Grup maupun Keuangan Pribadi tanpa reload.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-07-14',
    title: 'Bot: Deteksi Kata "grup" Lebih Fleksibel',
    changes: [
      'Diperbaiki: kata "grup" sekarang dikenali di MANA PUN posisinya dalam kalimat, tidak harus tepat setelah nominal. Contoh "300000 keuangan grup a bensin" sekarang tetap terdeteksi sebagai transaksi Grup, bukan salah masuk ke Pribadi.',
      'Teks sebelum kata "grup" otomatis digabung sebagai bagian dari kategori/deskripsi.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-07-14',
    title: 'Perintah Bot Lengkap: Tambah Modal & Tarik Dana',
    changes: [
      'Bot Telegram sekarang mendukung SEMUA aksi utama aplikasi: /pengeluaran, /pemasukan, /tambahmodal, /tarik, dan /saldo — untuk Keuangan Pribadi maupun Grup.',
      'Perintah grup bisa menyebutkan nama anggota, contoh: "/tambahmodal 500rb grup mining Budi" atau "/tarik 100000 grup mining Budi ambil profit".',
      'Penarikan dana lewat bot otomatis menghitung potongan biaya sesuai Pengaturan Potongan (per-anggota atau default grup), sama seperti di aplikasi.',
      'Perintah /saldo bisa dipersempit: /saldo grup <nama> untuk total grup, atau /saldo grup <nama> <anggota> untuk saldo satu anggota.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-07-14',
    title: 'Bot Bisa Catat ke Grup + Auto-Refresh',
    changes: [
      'Bot Telegram sekarang bisa mencatat transaksi ke Keuangan Grup: "/pengeluaran 200000 grup investasi a bensin" — otomatis terbagi proporsional ke semua anggota sesuai modal masing-masing.',
      'Tambah perintah "/saldo grup <nama>" untuk cek saldo grup lewat bot.',
      'Diperbaiki: sebelumnya kata "grup <nama>" salah dianggap kategori biasa dan transaksi masuk ke Keuangan Pribadi.',
      'Aplikasi sekarang auto-refresh real-time — transaksi yang dicatat lewat bot langsung muncul di app tanpa perlu reload manual.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-07-13',
    title: 'Integrasi Telegram Bot (Tahap 1)',
    changes: [
      'Bisa catat transaksi Keuangan Pribadi lewat perintah teks di Telegram: /pengeluaran, /pemasukan, /saldo, /help.',
      'Halaman Pengaturan → "Hubungkan Telegram": generate kode sekali pakai untuk menghubungkan akun Telegram ke akun FinanceHub.',
      'Nominal fleksibel: bisa ditulis 50000, 50.000, 50rb, 50k, atau 1.5jt.',
      'Tahap selanjutnya: dukungan Keuangan Grup lewat bot, dan pembacaan foto struk otomatis (OCR/AI vision).',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-07-13',
    title: 'Angka Berjalan di Keuangan Pribadi & Manajemen Saldo',
    changes: [
      'Angka berjalan sesi (seperti di Keuangan Grup) sekarang juga ada di Keuangan Pribadi, tepat di atas pilihan Jenis Transaksi.',
      'Ditambahkan juga di Manajemen Saldo: "Total ditambahkan (sesi ini)" pada form Tambah Modal, dan "Total ditarik (sesi ini)" pada form Penarikan Dana, masing-masing dengan tombol Reset.',
      'Tombol Reset ini murni membersihkan angka sesi di layar — TIDAK menghapus atau mengubah Pengaturan Potongan (fee) sama sekali.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-07-13',
    title: 'Angka Berjalan di Form Tambah Transaksi Grup',
    changes: [
      'Koreksi dari v1.5.0: card "Riwayat Detail" permanen dihapus karena data serupa sudah ada di Riwayat Transaksi Grup.',
      'Sebagai gantinya: ditambahkan angka berjalan sementara tepat di atas pilihan "Jenis Transaksi" pada form tambah transaksi cepat. Setiap submit Pengeluaran menambah totalnya (mis. 10.000 lalu +10.000 jadi 20.000), begitu juga Pemasukan, dihitung terpisah.',
      'Angka ini bersifat sesaat (khusus sesi saat ini, tidak tersimpan) dan bisa direset manual lewat tombol "Reset". Otomatis reset juga saat pindah grup.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-07-13',
    title: 'Riwayat Detail & Perbaikan Penarikan Dana',
    changes: [
      'Tambah card baru "Riwayat Detail Pemasukan & Pengeluaran" di Keuangan Grup: ringkasan total besar di atas, daftar transaksi dengan total berjalan (running total) di bawah.',
      'Diperbaiki: dropdown pemilihan anggota saat Tambah Modal/Penarikan Dana sebelumnya menampilkan Modal Awal, sehingga terlihat seolah hanya modal awal yang bisa ditarik. Sekarang menampilkan Saldo aktual (dana keseluruhan) anggota.',
      'Label badge riwayat transaksi diperjelas: "Tambah Modal" vs "Penarikan Modal" (sebelumnya selalu tertulis "Penarikan Modal").',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-07-13',
    title: 'Aplikasi Bisa Di-install (PWA)',
    changes: [
      'FinanceHub sekarang bisa di-install langsung dari browser ke HP/laptop, seperti aplikasi native — tanpa perlu App Store/Play Store.',
      'Tersedia tombol "Install Aplikasi" di halaman Pengaturan, plus banner otomatis saat browser mendukung.',
      'Ikon aplikasi & splash screen ditambahkan untuk pengalaman standalone.',
      'Aset statis di-cache otomatis agar loading berikutnya lebih cepat.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-07-13',
    title: 'Konfirmasi Sebelum Transaksi Saldo',
    changes: [
      'Tambah Modal dan Penarikan Dana sekarang menampilkan dialog konfirmasi berisi ringkasan (nominal, potongan, saldo sebelum/sesudah) sebelum benar-benar diproses.',
      'Mengurangi risiko salah input nominal yang langsung tersimpan tanpa jeda konfirmasi.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-07-13',
    title: 'Total Saldo Grup Mengikuti Saldo Tiap Anggota',
    changes: [
      'Diperbaiki: Tambah Modal sebelumnya dihitung ganda (menambah Total Modal DAN Total Pemasukan sekaligus). Sekarang hanya menambah Total Modal.',
      'Penarikan Dana sekarang juga langsung mengurangi modal anggota, konsisten dengan cara Tambah Modal bekerja.',
      'Total Modal/Saldo Grup selalu sama dengan penjumlahan saldo seluruh anggota — setiap Tambah Modal maupun Penarikan langsung tercermin di angka grup.',
      'Total Pemasukan, Pengeluaran, dan Profit Grup murni dari transaksi operasional saja, tidak lagi terpengaruh mutasi modal.',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-07-13',
    title: 'Migrasi ke Project Supabase Baru',
    changes: [
      'Project Supabase lama (dibuat otomatis oleh Bolt.new) sudah tidak bisa diakses.',
      'Database baru dibuat dan seluruh migration dijalankan ulang (schema utama, modul saldo, flag penarikan modal).',
      'Environment variable Netlify diarahkan ke project Supabase baru.',
      'Catatan: data lama (jika ada) tidak dapat dipulihkan — mulai dari database kosong.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-07-13',
    title: 'Perbaikan Perhitungan Penarikan Modal Grup',
    changes: [
      'Penarikan saldo anggota grup kini mengurangi Total Modal Grup secara langsung.',
      'Penarikan modal tidak lagi dihitung sebagai Total Pengeluaran maupun mempengaruhi Profit Grup.',
      'Riwayat transaksi grup menampilkan badge "Penarikan Modal" terpisah dari Pengeluaran operasional.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-07-13',
    title: 'Perbaikan Deploy & Environment Variable',
    changes: [
      'Memperbaiki layar putih akibat VITE_SUPABASE_ANON_KEY tidak ter-bundle saat build (secret env var).',
      'Menambahkan public/_redirects untuk mendukung routing SPA (React Router) di Netlify.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-12',
    title: 'Rilis Awal FinanceHub',
    changes: [
      'Modul keuangan pribadi, keuangan grup, dan manajemen saldo (top up & penarikan dana).',
    ],
  },
];
