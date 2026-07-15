import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const WATCHED_TABLES = [
  'personal_business',
  'personal_transactions',
  'groups',
  'group_members',
  'group_transactions',
  'member_transaction_details',
  'capital_additions',
  'withdrawals',
  'withdrawal_settings',
  'member_withdrawal_settings',
  'telegram_accounts',
];

/**
 * Realtime sync app-wide: auto-refresh data begitu ada perubahan di
 * database (termasuk dari bot Telegram), tanpa perlu reload manual.
 *
 * PENTING: dipasang sekali di komponen yang selalu hidup di semua halaman
 * (AppLayout), BUKAN di dalam hook per-halaman seperti useDashboardData.
 * Kalau dipasang per-halaman, tiap halaman yang query datanya sendiri
 * (mis. GroupFinancePage, PersonalFinancePage) tidak akan pernah dengar
 * perubahan realtime karena hook tersebut tidak mereka pakai.
 *
 * PENTING #2: tabel-tabel ini punya RLS aktif ("select_own_..." memakai
 * auth.uid() = user_id). Supaya event realtime lolos RLS, token JWT user
 * harus dikirim eksplisit ke koneksi realtime lewat supabase.realtime.setAuth()
 * SEBELUM channel di-subscribe — kalau tidak, auth.uid() akan NULL di sisi
 * realtime dan semua event akan senyap difilter RLS (tanpa error apa pun).
 */
export function useRealtimeSync() {
  const { user, session } = useAuth();
  const userId = user?.id;
  const accessToken = session?.access_token;
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('idle');

  useEffect(() => {
    if (!userId || !accessToken) return;

    let cancelled = false;

    async function setup() {
      // Kirim token JWT eksplisit ke koneksi realtime agar RLS (auth.uid())
      // bisa dievaluasi dengan benar untuk postgres_changes.
      await supabase.realtime.setAuth(accessToken!);
      if (cancelled) return;

      const channel = supabase.channel(`realtime-sync-${userId}-${Date.now()}`);
      for (const table of WATCHED_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          () => qc.invalidateQueries({ queryKey: [table] })
        );
      }
      channel.subscribe((s) => setStatus(s));

      return channel;
    }

    const channelPromise = setup();

    return () => {
      cancelled = true;
      channelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, [userId, accessToken, qc]);

  // Kirim ulang token tiap kali auto-refresh token terjadi, supaya koneksi
  // realtime tidak "kadaluwarsa" secara diam-diam saat sesi login panjang.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED' && newSession?.access_token) {
        supabase.realtime.setAuth(newSession.access_token);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return status;
}
