import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { PersonalBusiness, PersonalTransaction, Group, GroupMember, GroupTransaction, MemberTransactionDetail, AuditLog, CapitalAddition, Withdrawal } from '@/types';

export function useDashboardData() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const personalBusiness = useQuery({
    queryKey: ['personal_business', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_business')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PersonalBusiness[];
    },
    enabled: !!userId,
  });

  const personalTransactions = useQuery({
    queryKey: ['personal_transactions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PersonalTransaction[];
    },
    enabled: !!userId,
  });

  const groups = useQuery({
    queryKey: ['groups', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!userId,
  });

  const groupMembers = useQuery({
    queryKey: ['group_members', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!userId,
  });

  const groupTransactions = useQuery({
    queryKey: ['group_transactions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GroupTransaction[];
    },
    enabled: !!userId,
  });

  const memberDetails = useQuery({
    queryKey: ['member_transaction_details', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_transaction_details')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as MemberTransactionDetail[];
    },
    enabled: !!userId,
  });

  const auditLogs = useQuery({
    queryKey: ['audit_logs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!userId,
  });

  const capitalAdditions = useQuery({
    queryKey: ['capital_additions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capital_additions')
        .select('*')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });
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
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data as Withdrawal[];
    },
    enabled: !!userId,
  });

  return {
    personalBusiness: personalBusiness.data ?? [],
    personalTransactions: personalTransactions.data ?? [],
    groups: groups.data ?? [],
    groupMembers: groupMembers.data ?? [],
    groupTransactions: groupTransactions.data ?? [],
    memberDetails: memberDetails.data ?? [],
    auditLogs: auditLogs.data ?? [],
    capitalAdditions: capitalAdditions.data ?? [],
    withdrawals: withdrawals.data ?? [],
    loading:
      personalBusiness.isLoading ||
      personalTransactions.isLoading ||
      groups.isLoading ||
      groupMembers.isLoading ||
      groupTransactions.isLoading ||
      memberDetails.isLoading,
  };
}
