import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { CapitalAddition, Withdrawal, WithdrawalSettings, MemberWithdrawalSettings } from '@/types';

export function useBalanceData() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const capitalAdditions = useQuery({
    queryKey: ['capital_additions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capital_additions')
        .select('*')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CapitalAddition[];
    },
    enabled: !!userId,
  });

  const withdrawals = useQuery({
    queryKey: ['withdrawals', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Withdrawal[];
    },
    enabled: !!userId,
  });

  const withdrawalSettings = useQuery({
    queryKey: ['withdrawal_settings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_settings')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data as WithdrawalSettings[];
    },
    enabled: !!userId,
  });

  const memberWithdrawalSettings = useQuery({
    queryKey: ['member_withdrawal_settings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_withdrawal_settings')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data as MemberWithdrawalSettings[];
    },
    enabled: !!userId,
  });

  return {
    capitalAdditions: capitalAdditions.data ?? [],
    withdrawals: withdrawals.data ?? [],
    withdrawalSettings: withdrawalSettings.data ?? [],
    memberWithdrawalSettings: memberWithdrawalSettings.data ?? [],
  };
}
