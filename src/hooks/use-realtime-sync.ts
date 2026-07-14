import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

/**
 * Realtime sync app-wide: auto-refresh data begitu ada perubahan di
 * database (termasuk dari bot Telegram), tanpa perlu reload manual.
 *
 * PENTING: dipasang sekali di komponen yang selalu hidup di semua halaman
 * (AppLayout), BUKAN di dalam hook per-halaman seperti useDashboardData.
 * Kalau dipasang per-halaman, tiap halaman yang query datanya sendiri
 * (mis. GroupFinancePage, PersonalFinancePage) tidak akan pernah dengar
 * perubahan realtime karena hook tersebut tidak mereka pakai.
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const tables = [
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
    const channel = supabase.channel(`realtime-sync-${userId}`);
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: [table] })
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
