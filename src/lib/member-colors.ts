// Palet warna konsisten untuk membedakan anggota grup secara visual
// (avatar, grafik tren, donut chart, dll) — supaya satu anggota selalu
// dapat warna yang sama di semua tempat, tidak berubah-ubah antar render.

export const MEMBER_COLOR_PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--destructive))',
  'hsl(var(--info))',
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#84cc16', // lime
];

/**
 * Ambil warna konsisten untuk seorang anggota, berdasarkan posisinya
 * dalam daftar anggota yang sudah diurutkan stabil (mis. urut by id).
 * Dua tempat berbeda yang memanggil fungsi ini dengan urutan anggota
 * yang sama akan selalu menghasilkan warna yang sama per anggota.
 */
export function getMemberColor(index: number): string {
  return MEMBER_COLOR_PALETTE[index % MEMBER_COLOR_PALETTE.length];
}

/** Urutkan anggota secara stabil (by id) supaya index warna konsisten. */
export function stableMemberOrder<T extends { id: string }>(members: T[]): T[] {
  return [...members].sort((a, b) => a.id.localeCompare(b.id));
}
