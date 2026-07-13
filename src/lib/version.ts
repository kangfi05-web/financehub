// FinanceHub — Version & Changelog Tracker
// Setiap perbaikan/update aplikasi ditambahkan sebagai entri baru di sini.

export const APP_VERSION = '1.4.0';

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
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
