import type { PersonalTransaction, GroupMember, MemberTransactionDetail } from '@/types';

export interface PersonalFinanceSummary {
  initialCapital: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  profit: number;
  profitPercentage: number;
}

export function computePersonalSummary(
  initialCapital: number,
  transactions: PersonalTransaction[]
): PersonalFinanceSummary {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.nominal), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.nominal), 0);
  const currentBalance = initialCapital + totalIncome - totalExpense;
  const profit = totalIncome - totalExpense;
  const profitPercentage = initialCapital > 0 ? (profit / initialCapital) * 100 : 0;
  return { initialCapital, totalIncome, totalExpense, currentBalance, profit, profitPercentage };
}

export interface MemberComputed extends GroupMember {
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  profit: number;
  profitPercentage: number;
}

export function computeMemberSummary(
  member: GroupMember,
  details: MemberTransactionDetail[]
): MemberComputed {
  let totalIncome = 0;
  let totalExpense = 0;
  for (const d of details) {
    if (d.member_id !== member.id) continue;
    const amount = Number(d.share_amount);
    const delta = Number(d.balance_after) - Number(d.balance_before);
    if (delta > 0) totalIncome += amount;
    else totalExpense += amount;
  }
  const currentBalance = Number(member.initial_capital) + totalIncome - totalExpense;
  const profit = totalIncome - totalExpense;
  const profitPercentage = Number(member.initial_capital) > 0 ? (profit / Number(member.initial_capital)) * 100 : 0;
  return {
    ...member,
    totalIncome,
    totalExpense,
    currentBalance,
    profit,
    profitPercentage,
  };
}

export function getMemberBalance(
  member: GroupMember,
  details: MemberTransactionDetail[]
): number {
  const memberDetails = details
    .filter((d) => d.member_id === member.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (memberDetails.length === 0) return Number(member.initial_capital);
  return Number(memberDetails[memberDetails.length - 1].balance_after);
}

export interface ShareSplit {
  memberId: string;
  sharePercentage: number;
  shareAmount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export function calculateProportionalSplit(
  members: GroupMember[],
  details: MemberTransactionDetail[],
  amount: number,
  type: 'income' | 'expense'
): ShareSplit[] {
  const totalCapital = members.reduce((sum, m) => sum + Number(m.initial_capital), 0);
  if (totalCapital <= 0) return [];

  return members.map((member) => {
    const sharePercentage = (Number(member.initial_capital) / totalCapital) * 100;
    const shareAmount = (amount * sharePercentage) / 100;
    const balanceBefore = getMemberBalance(member, details);
    const balanceAfter = type === 'income' ? balanceBefore + shareAmount : balanceBefore - shareAmount;
    return {
      memberId: member.id,
      sharePercentage,
      shareAmount,
      balanceBefore,
      balanceAfter,
    };
  });
}

export interface GroupFinanceSummary {
  totalCapital: number;
  totalIncome: number;
  totalExpense: number;
  groupBalance: number;
  profit: number;
  profitPercentage: number;
}

export function computeGroupSummary(
  members: GroupMember[],
  details: MemberTransactionDetail[]
): GroupFinanceSummary {
  const totalCapital = members.reduce((sum, m) => sum + Number(m.initial_capital), 0);
  let totalIncome = 0;
  let totalExpense = 0;
  for (const d of details) {
    const delta = Number(d.balance_after) - Number(d.balance_before);
    if (delta > 0) totalIncome += Number(d.share_amount);
    else totalExpense += Number(d.share_amount);
  }
  const groupBalance = totalCapital + totalIncome - totalExpense;
  const profit = totalIncome - totalExpense;
  const profitPercentage = totalCapital > 0 ? (profit / totalCapital) * 100 : 0;
  return { totalCapital, totalIncome, totalExpense, groupBalance, profit, profitPercentage };
}

export function generateTransactionNo(prefix: string, count: number): string {
  const num = String(count + 1).padStart(5, '0');
  return `${prefix}-${num}`;
}

export interface WithdrawalCalc {
  feePercentage: number;
  fixedFee: number;
  feeAmount: number;
  netReceived: number;
  balanceAfter: number;
}

export function calculateWithdrawal(
  balance: number,
  withdrawalAmount: number,
  feePercentage: number,
  fixedFee: number
): WithdrawalCalc {
  const percentageFee = (withdrawalAmount * feePercentage) / 100;
  const feeAmount = Math.round(percentageFee + fixedFee);
  const netReceived = withdrawalAmount - feeAmount;
  const balanceAfter = balance - withdrawalAmount;
  return { feePercentage, fixedFee, feeAmount, netReceived, balanceAfter };
}

export interface WithdrawalValidation {
  valid: boolean;
  error: string | null;
}

export function validateWithdrawal(
  balance: number,
  amount: number,
  minWithdrawal: number,
  maxWithdrawal: number
): WithdrawalValidation {
  if (amount <= 0) return { valid: false, error: 'Nominal penarikan harus lebih dari 0.' };
  if (amount > balance) return { valid: false, error: 'Saldo tidak mencukupi untuk penarikan ini.' };
  if (minWithdrawal > 0 && amount < minWithdrawal)
    return { valid: false, error: `Minimal penarikan adalah Rp${minWithdrawal.toLocaleString('id-ID')}.` };
  if (maxWithdrawal > 0 && amount > maxWithdrawal)
    return { valid: false, error: `Maksimal penarikan adalah Rp${maxWithdrawal.toLocaleString('id-ID')}.` };
  return { valid: true, error: null };
}
