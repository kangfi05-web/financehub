export type TransactionType = 'income' | 'expense';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonalBusiness {
  id: string;
  user_id: string;
  name: string;
  business_type: string;
  start_date: string;
  initial_capital: number;
  created_at: string;
  updated_at: string;
}

export interface PersonalTransaction {
  id: string;
  user_id: string;
  business_id: string;
  transaction_no: string;
  transaction_date: string;
  type: TransactionType;
  category: string;
  description: string | null;
  nominal: number;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export interface Group {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  show_leaderboard: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  user_id: string;
  group_id: string;
  name: string;
  phone: string | null;
  initial_capital: number;
  pin_code_hash: string | null;
  created_at: string;
}

export interface GroupTransaction {
  id: string;
  user_id: string;
  group_id: string;
  transaction_no: string;
  transaction_date: string;
  type: TransactionType;
  category: string;
  description: string | null;
  nominal: number;
  is_capital_adjustment: boolean;
  created_at: string;
}

export interface MemberTransactionDetail {
  id: string;
  user_id: string;
  group_transaction_id: string;
  group_id: string;
  member_id: string;
  share_percentage: number;
  share_amount: number;
  balance_before: number;
  balance_after: number;
  is_capital_adjustment: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSettings {
  id: string;
  user_id: string;
  theme: 'light' | 'dark';
  currency: string;
  notifications_enabled: boolean;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type BalanceScope = 'personal' | 'group';

export interface CapitalAddition {
  id: string;
  user_id: string;
  scope: BalanceScope;
  ref_id: string;
  group_id: string | null;
  transaction_no: string;
  transaction_date: string;
  nominal: number;
  balance_before: number;
  balance_after: number;
  description: string | null;
  attachment_url: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  scope: BalanceScope;
  ref_id: string;
  group_id: string | null;
  member_id: string | null;
  transaction_no: string;
  transaction_date: string;
  withdrawal_amount: number;
  fee_percentage: number;
  fixed_fee: number;
  fee_amount: number;
  net_received: number;
  balance_before: number;
  balance_after: number;
  status: 'completed' | 'pending' | 'rejected';
  reason: string | null;
  created_at: string;
}

export interface WithdrawalSettings {
  id: string;
  user_id: string;
  group_id: string | null;
  fee_percentage: number;
  fixed_fee: number;
  min_withdrawal: number;
  max_withdrawal: number;
  created_at: string;
  updated_at: string;
}

export interface MemberWithdrawalSettings {
  id: string;
  user_id: string;
  member_id: string;
  group_id: string;
  fee_percentage: number;
  fixed_fee: number;
  created_at: string;
  updated_at: string;
}
