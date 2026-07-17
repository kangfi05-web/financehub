import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface AnimatedNumberProps {
  /** Nilai numerik target yang ingin ditampilkan (mis. nominal Rupiah). */
  value: number;
  /** Fungsi format tampilan, mis. formatCurrency atau formatPercentage. */
  formatter: (n: number) => string;
  /** Durasi animasi dalam ms. Default 800ms. */
  durationMs?: number;
}

/**
 * Menampilkan angka dengan animasi "menghitung" dari nilai sebelumnya ke
 * nilai baru (ease-out), bukan langsung berubah statis. Otomatis nonaktif
 * kalau pengguna mengaktifkan "prefers-reduced-motion" di sistem mereka.
 *
 * Aman dipakai untuk nilai apa pun (termasuk negatif/desimal) karena hanya
 * mengubah ANGKA yang dilempar ke `formatter` — bukan mengubah logic
 * kalkulasi di tempat lain.
 */
export function AnimatedNumber({ value, formatter, durationMs = 800 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const prevValueRef = useRef(prefersReducedMotion ? value : 0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const end = value;

    if (start === end) {
      setDisplay(end);
      return;
    }

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + (end - start) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = end;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <>{formatter(display)}</>;
}
