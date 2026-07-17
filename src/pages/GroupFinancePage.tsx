import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  FileDown,
  Sheet as SheetIcon,
  FileText,
  Eye,
  Phone,
  Wallet,
  KeyRound,
  Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  computeGroupSummary,
  computeMemberSummary,
  calculateProportionalSplit,
  generateTransactionNo,
} from '@/lib/finance';
import { getMemberColor, stableMemberOrder } from '@/lib/member-colors';
import { formatCurrency, formatPercentage, formatDate, todayISO } from '@/lib/format';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Group, GroupMember, GroupTransaction, MemberTransactionDetail } from '@/types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@/lib/theme';

export function GroupFinancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<GroupMember | null>(null);
  const [pinDialogMember, setPinDialogMember] = useState<GroupMember | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberCapital, setMemberCapital] = useState(0);

  const [showTxDialog, setShowTxDialog] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txNominal, setTxNominal] = useState(0);
  const [txCategory, setTxCategory] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(todayISO());

  // Angka berjalan sementara (sesi ini saja, tidak tersimpan ke database):
  // bertambah tiap kali submit transaksi, dan bisa direset manual.
  const [sessionIncome, setSessionIncome] = useState(0);
  const [sessionExpense, setSessionExpense] = useState(0);

  useEffect(() => {
    setSessionIncome(0);
    setSessionExpense(0);
  }, [selectedGroupId]);

  const [confirmDelete, setConfirmDelete] = useState<
    { type: 'tx' | 'group' | 'member' | 'reset'; id?: string } | null
  >(null);
  const [search, setSearch] = useState('');
  const [detailMember, setDetailMember] = useState<GroupMember | null>(null);

  // Queries
  const groupsQ = useQuery({
    queryKey: ['groups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Group[];
    },
    enabled: !!user,
  });

  const membersQ = useQuery({
    queryKey: ['group_members', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as GroupMember[];
    },
    enabled: !!user,
  });

  const groupTxQ = useQuery({
    queryKey: ['group_transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GroupTransaction[];
    },
    enabled: !!user,
  });

  const memberDetailsQ = useQuery({
    queryKey: ['member_transaction_details', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_transaction_details')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as MemberTransactionDetail[];
    },
    enabled: !!user,
  });

  const groups = groupsQ.data ?? [];
  const allMembers = membersQ.data ?? [];
  const allGroupTx = groupTxQ.data ?? [];
  const allDetails = memberDetailsQ.data ?? [];

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0] ?? null;
  const groupMembers = useMemo(
    () => (selectedGroup ? allMembers.filter((m) => m.group_id === selectedGroup.id) : []),
    [allMembers, selectedGroup]
  );
  const groupTx = useMemo(
    () => (selectedGroup ? allGroupTx.filter((t) => t.group_id === selectedGroup.id) : []),
    [allGroupTx, selectedGroup]
  );
  const groupDetails = useMemo(
    () => (selectedGroup ? allDetails.filter((d) => d.group_id === selectedGroup.id) : []),
    [allDetails, selectedGroup]
  );

  const groupSummary = useMemo(
    () => (selectedGroup ? computeGroupSummary(groupMembers, groupDetails) : null),
    [selectedGroup, groupMembers, groupDetails]
  );

  const memberSummaries = useMemo(
    () => groupMembers.map((m) => computeMemberSummary(m, groupDetails)),
    [groupMembers, groupDetails]
  );

  // Preview split for current tx input
  const splitPreview = useMemo(() => {
    if (txNominal <= 0 || groupMembers.length === 0) return [];
    return calculateProportionalSplit(groupMembers, groupDetails, txNominal, txType);
  }, [txNominal, groupMembers, groupDetails, txType]);

  // Group CRUD
  function openCreateGroup() {
    setEditingGroup(null);
    setGroupName('');
    setGroupDesc('');
    setShowGroupForm(true);
  }
  function openEditGroup(g: Group) {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupDesc(g.description ?? '');
    setShowGroupForm(true);
  }
  const saveGroup = async () => {
    if (groupName.trim().length < 2) { toast.error('Nama grup minimal 2 karakter'); return; }
    if (editingGroup) {
      const { error } = await supabase
        .from('groups')
        .update({ name: groupName, description: groupDesc || null, updated_at: new Date().toISOString() })
        .eq('id', editingGroup.id);
      if (error) { toast.error('Gagal memperbarui grup'); return; }
      await logAudit('update', 'groups', editingGroup.id, { name: groupName });
      toast.success('Grup berhasil diperbarui');
    } else {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name: groupName, description: groupDesc || null, user_id: user!.id })
        .select()
        .single();
      if (error) { toast.error('Gagal membuat grup'); return; }
      await logAudit('create', 'groups', data.id, { name: groupName });
      toast.success('Grup berhasil dibuat');
      setSelectedGroupId(data.id);
    }
    setShowGroupForm(false);
    qc.invalidateQueries({ queryKey: ['groups'] });
  };

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
      await logAudit('delete', 'groups', id);
    },
    onSuccess: () => {
      toast.success('Grup berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group_members'] });
      qc.invalidateQueries({ queryKey: ['group_transactions'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Member CRUD
  function openCreateMember() {
    setEditingMember(null);
    setMemberName('');
    setMemberPhone('');
    setMemberCapital(0);
    setShowMemberForm(true);
  }
  function openEditMember(m: GroupMember) {
    setEditingMember(m);
    setMemberName(m.name);
    setMemberPhone(m.phone ?? '');
    setMemberCapital(Number(m.initial_capital));
    setShowMemberForm(true);
  }

  const generatePinMut = useMutation({
    mutationFn: async (member: GroupMember) => {
      const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6 digit
      const { error } = await supabase.rpc('set_member_pin', { p_member_id: member.id, p_pin: pin });
      if (error) throw error;
      return pin;
    },
    onSuccess: (pin) => {
      setGeneratedPin(pin);
      qc.invalidateQueries({ queryKey: ['group_members'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const clearPinMut = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc('clear_member_pin', { p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('PIN dinonaktifkan');
      setGeneratedPin(null);
      qc.invalidateQueries({ queryKey: ['group_members'] });
    },
    onError: (err) => toast.error(err.message),
  });
  const saveMember = async () => {
    if (!selectedGroup) return;
    if (memberName.trim().length < 2) { toast.error('Nama anggota minimal 2 karakter'); return; }
    if (memberCapital < 0) { toast.error('Modal tidak boleh negatif'); return; }
    if (editingMember) {
      const { error } = await supabase
        .from('group_members')
        .update({ name: memberName, phone: memberPhone || null, initial_capital: memberCapital })
        .eq('id', editingMember.id);
      if (error) { toast.error('Gagal memperbarui anggota'); return; }
      await logAudit('update', 'group_members', editingMember.id, { name: memberName });
      toast.success('Anggota berhasil diperbarui');
    } else {
      const { error } = await supabase
        .from('group_members')
        .insert({ name: memberName, phone: memberPhone || null, initial_capital: memberCapital, group_id: selectedGroup.id, user_id: user!.id });
      if (error) { toast.error('Gagal menambah anggota'); return; }
      await logAudit('create', 'group_members', undefined, { name: memberName, group: selectedGroup.name });
      toast.success('Anggota berhasil ditambahkan');
    }
    setShowMemberForm(false);
    qc.invalidateQueries({ queryKey: ['group_members'] });
  };

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_members').delete().eq('id', id);
      if (error) throw error;
      await logAudit('delete', 'group_members', id);
    },
    onSuccess: () => {
      toast.success('Anggota berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['group_members'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Transaction add
  const addTxMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup || txNominal <= 0) throw new Error('Nominal tidak valid');
      if (groupMembers.length === 0) throw new Error('Tambahkan anggota terlebih dahulu');
      const splits = calculateProportionalSplit(groupMembers, groupDetails, txNominal, txType);
      const txNo = generateTransactionNo('GR', allGroupTx.length);

      const { data: txData, error: txError } = await supabase
        .from('group_transactions')
        .insert({
          user_id: user!.id,
          group_id: selectedGroup.id,
          transaction_no: txNo,
          transaction_date: txDate,
          type: txType,
          category: txCategory || (txType === 'income' ? 'Pemasukan' : 'Pengeluaran'),
          description: txDescription || null,
          nominal: txNominal,
        })
        .select()
        .single();
      if (txError) throw txError;

      const detailRows = splits.map((s) => ({
        user_id: user!.id,
        group_transaction_id: txData.id,
        group_id: selectedGroup.id,
        member_id: s.memberId,
        share_percentage: s.sharePercentage,
        share_amount: s.shareAmount,
        balance_before: s.balanceBefore,
        balance_after: s.balanceAfter,
      }));
      const { error: detailError } = await supabase.from('member_transaction_details').insert(detailRows);
      if (detailError) throw detailError;
      await logAudit('create', 'group_transactions', txData.id, { type: txType, nominal: txNominal });
    },
    onSuccess: () => {
      toast.success(txType === 'income' ? 'Pemasukan grup berhasil ditambahkan' : 'Pengeluaran grup berhasil ditambahkan');
      if (txType === 'income') setSessionIncome((v) => v + txNominal);
      else setSessionExpense((v) => v + txNominal);
      setShowTxDialog(false);
      setTxNominal(0);
      setTxCategory('');
      setTxDescription('');
      setTxDate(todayISO());
      qc.invalidateQueries({ queryKey: ['group_transactions'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: deErr } = await supabase.from('member_transaction_details').delete().eq('group_transaction_id', id);
      if (deErr) throw deErr;
      const { error: txErr } = await supabase.from('group_transactions').delete().eq('id', id);
      if (txErr) throw txErr;
      await logAudit('delete', 'group_transactions', id);
    },
    onSuccess: () => {
      toast.success('Transaksi grup berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['group_transactions'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Reset all group transactions
  const resetTxMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) throw new Error('Pilih grup terlebih dahulu');
      const { error: dErr } = await supabase
        .from('member_transaction_details')
        .delete()
        .eq('group_id', selectedGroup.id);
      if (dErr) throw dErr;
      const { error: tErr } = await supabase
        .from('group_transactions')
        .delete()
        .eq('group_id', selectedGroup.id);
      if (tErr) throw tErr;
      await logAudit('reset', 'group_transactions', selectedGroup.id, { group: selectedGroup.name });
    },
    onSuccess: () => {
      toast.success('Semua transaksi grup berhasil direset');
      qc.invalidateQueries({ queryKey: ['group_transactions'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Filtered tx
  const filteredTx = useMemo(() => {
    if (!search) return groupTx;
    const q = search.toLowerCase();
    return groupTx.filter(
      (t) =>
        t.category.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.transaction_no.toLowerCase().includes(q)
    );
  }, [groupTx, search]);

  // Chart data
  const chartData = useMemo(() => {
    const sorted = [...groupTx].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    return sorted.map((t) => ({
      date: formatDate(t.transaction_date, 'dd/MM'),
      nominal: Number(t.nominal),
      type: t.type,
    }));
  }, [groupTx]);

  const memberBalanceChartData = useMemo(
    () =>
      memberSummaries.map((m) => ({
        name: m.name,
        saldo: m.currentBalance,
        modal: Number(m.initial_capital),
      })),
    [memberSummaries]
  );

  // Tren saldo per anggota dari waktu ke waktu: satu baris per tanggal,
  // satu kolom per anggota (nilai saldo di-carry forward dari transaksi
  // terakhir sampai tanggal itu).
  const memberTrendData = useMemo(() => {
    if (groupMembers.length === 0) return [];
    const sorted = [...groupDetails].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const dates = Array.from(new Set(sorted.map((d) => formatDate(d.created_at, 'dd/MM')))).sort(
      (a, b) => {
        const da = sorted.find((d) => formatDate(d.created_at, 'dd/MM') === a)!.created_at;
        const db = sorted.find((d) => formatDate(d.created_at, 'dd/MM') === b)!.created_at;
        return new Date(da).getTime() - new Date(db).getTime();
      }
    );
    if (dates.length === 0) return [];

    const running: Record<string, number> = {};
    for (const m of groupMembers) running[m.name] = Number(m.initial_capital);
    // Mundurkan running ke titik SEBELUM transaksi pertama (pakai initial_capital),
    // lalu jalankan maju sesuai urutan transaksi per tanggal.
    const memberIdToName = new Map(groupMembers.map((m) => [m.id, m.name]));

    return dates.map((dateLabel) => {
      const detailsThisDate = sorted.filter((d) => formatDate(d.created_at, 'dd/MM') === dateLabel);
      for (const d of detailsThisDate) {
        const name = memberIdToName.get(d.member_id);
        if (name) running[name] = Number(d.balance_after);
      }
      return { date: dateLabel, ...running };
    });
  }, [groupDetails, groupMembers]);



  // Papan peringkat: urutkan anggota berdasarkan profit nominal (Rupiah)
  // tertinggi. Catatan: kalau transaksi grup dibagi proporsional sesuai
  // modal, persentase profit semua anggota akan SAMA (karena semua orang
  // dapat porsi return yang sama secara %) — jadi nominal Rupiah jauh
  // lebih berguna untuk membedakan siapa yang paling banyak "menghasilkan".
  const leaderboard = useMemo(
    () => [...memberSummaries].sort((a, b) => b.profit - a.profit),
    [memberSummaries]
  );

  const toggleLeaderboardMut = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) return;
      const { error } = await supabase
        .from('groups')
        .update({ show_leaderboard: !selectedGroup.show_leaderboard })
        .eq('id', selectedGroup.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
    onError: (err) => toast.error(err.message),
  });

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';

  // Export
  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { header: 'No. Transaksi', key: 'transaction_no' },
      { header: 'Tanggal', key: 'transaction_date_fmt' },
      { header: 'Jenis', key: 'type' },
      { header: 'Kategori', key: 'category' },
      { header: 'Keterangan', key: 'description' },
      { header: 'Nominal', key: 'nominal_fmt' },
      { header: 'Dampak Anggota', key: 'members_affected' },
    ];
    const rows = filteredTx.map((t) => {
      const details = groupDetails.filter((d) => d.group_transaction_id === t.id);
      const affected = details
        .map((d) => {
          const m = groupMembers.find((mm) => mm.id === d.member_id);
          return m ? `${m.name} (${formatPercentage(Number(d.share_percentage))})` : '';
        })
        .filter(Boolean)
        .join('; ');
      return {
        transaction_no: t.transaction_no,
        transaction_date_fmt: formatDate(t.transaction_date),
        type: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        category: t.category,
        description: t.description ?? '-',
        nominal_fmt: formatCurrency(Number(t.nominal)),
        members_affected: affected,
      };
    });
    const fname = `keuangan-grup-${selectedGroup?.name ?? 'all'}`;
    if (format === 'csv') exportToCSV(fname, columns, rows);
    else if (format === 'excel') exportToExcel(fname, columns, rows);
    else exportToPDF(fname, `Laporan Keuangan Grup - ${selectedGroup?.name ?? ''}`, columns, rows);
    toast.success(`Data berhasil diexport ke ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keuangan Grup</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kelola keuangan bisnis kelompok dengan pembagian proporsional</p>
        </div>
        <Button onClick={openCreateGroup}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Grup
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Belum ada grup bisnis"
          description="Buat grup bisnis pertama Anda, tambahkan anggota, dan kelola keuangan bersama dengan pembagian modal proporsional."
          action={<Button onClick={openCreateGroup}><Plus className="mr-2 h-4 w-4" /> Buat Grup Bisnis</Button>}
        />
      ) : (
        <>
          {/* Group selector */}
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  selectedGroup?.id === g.id
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <Users className="mr-1.5 inline h-3.5 w-3.5" />
                {g.name}
              </button>
            ))}
          </div>

          {selectedGroup && groupSummary && (
            <>
              {/* Group info */}
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedGroup.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {groupMembers.length} anggota {selectedGroup.description ? `• ${selectedGroup.description}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                      <span className="text-xs font-medium text-muted-foreground">🏆 Papan Peringkat</span>
                      <Switch
                        checked={selectedGroup.show_leaderboard}
                        onCheckedChange={() => toggleLeaderboardMut.mutate()}
                        disabled={toggleLeaderboardMut.isPending}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEditGroup(selectedGroup)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Grup
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete({ type: 'group', id: selectedGroup.id })}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete({ type: 'reset' })}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Transaksi
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Group summary */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard label="Total Modal Grup" value={formatCurrency(groupSummary.totalCapital)} icon={Wallet} accent="info" />
                <StatCard label="Total Pengeluaran" value={formatCurrency(groupSummary.totalExpense)} icon={TrendingDown} accent="destructive" />
                <StatCard label="Total Pemasukan" value={formatCurrency(groupSummary.totalIncome)} icon={TrendingUp} accent="success" />
                <StatCard label="Saldo Grup" value={formatCurrency(groupSummary.groupBalance)} icon={Wallet} accent="primary" />
                <StatCard label="Profit Grup" value={formatCurrency(groupSummary.profit)} icon={TrendingUp} accent={groupSummary.profit >= 0 ? 'success' : 'destructive'} />
                <StatCard
                  label="Persentase Profit"
                  value={formatPercentage(groupSummary.profitPercentage)}
                  icon={TrendingUp}
                  accent={groupSummary.profitPercentage >= 0 ? 'success' : 'destructive'}
                />
              </div>

              {/* Members section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Anggota Grup</CardTitle>
                    <Button size="sm" onClick={openCreateMember} disabled={groupMembers.length >= 20}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Tambah Anggota
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {groupMembers.length === 0 ? (
                    <EmptyState
                      icon={<UserPlus className="h-6 w-6" />}
                      title="Belum ada anggota"
                      description="Tambahkan anggota dengan modal masing-masing untuk menghitung pembagian proporsional."
                      action={<Button size="sm" onClick={openCreateMember}><UserPlus className="mr-1.5 h-3.5 w-3.5" /> Tambah Anggota</Button>}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {memberSummaries.map((m) => {
                        const sharePct = groupSummary.totalCapital > 0
                          ? (Number(m.initial_capital) / groupSummary.totalCapital) * 100
                          : 0;
                        return (
                          <div
                            key={m.id}
                            className="group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md animate-slide-up"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-sm">{m.name}</p>
                                  {m.phone && (
                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Phone className="h-3 w-3" /> {m.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailMember(m)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 ${m.pin_code_hash ? 'text-success' : ''}`}
                                  onClick={() => { setPinDialogMember(m); setGeneratedPin(null); }}
                                  title={m.pin_code_hash ? 'PIN aktif — kelola akses monitoring' : 'Buat PIN akses monitoring'}
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMember(m)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                  onClick={() => setConfirmDelete({ type: 'member', id: m.id })}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Kepemilikan</span>
                                <Badge variant="secondary" className="font-medium">{formatPercentage(sharePct)}</Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Modal</span>
                                <span className="font-medium">{formatCurrency(Number(m.initial_capital))}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Saldo</span>
                                <span className="font-semibold text-primary">{formatCurrency(m.currentBalance)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Profit</span>
                                <span className={`font-medium ${m.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {formatCurrency(m.profit)} ({formatPercentage(m.profitPercentage)})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick transaction entry — inline, no dialog */}
              {groupMembers.length > 0 && (
                <Card className="animate-slide-up">
                  <CardContent className="p-4 sm:p-5">
                    {(sessionIncome > 0 || sessionExpense > 0) && (
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {sessionExpense > 0 && (
                            <span className="font-medium text-destructive">
                              Pengeluaran berjalan: {formatCurrency(sessionExpense)}
                            </span>
                          )}
                          {sessionIncome > 0 && (
                            <span className="font-medium text-success">
                              Pemasukan berjalan: {formatCurrency(sessionIncome)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => { setSessionIncome(0); setSessionExpense(0); }}
                        >
                          Reset
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Jenis Transaksi</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => { setTxType('income'); setTxCategory('Pemasukan'); }}
                            className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-all ${
                              txType === 'income' ? 'border-success bg-success/10 text-success' : 'border-border hover:bg-accent'
                            }`}
                          >
                            <ArrowUpRight className="h-4 w-4" /> Pemasukan
                          </button>
                          <button
                            type="button"
                            onClick={() => { setTxType('expense'); setTxCategory('Pengeluaran'); }}
                            className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-all ${
                              txType === 'expense' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-accent'
                            }`}
                          >
                            <ArrowDownRight className="h-4 w-4" /> Pengeluaran
                          </button>
                        </div>
                      </div>
                      <div className="sm:w-56">
                        <Label htmlFor="g-quick-nominal" className="mb-1.5 block text-xs font-medium text-muted-foreground">Nominal</Label>
                        <CurrencyInput
                          id="g-quick-nominal"
                          value={txNominal}
                          onValueChange={setTxNominal}
                          placeholder="0"
                          onKeyDown={(e) => { if (e.key === 'Enter' && txNominal > 0) { e.preventDefault(); addTxMutation.mutate(); } }}
                        />
                      </div>
                      <Button
                        onClick={() => addTxMutation.mutate()}
                        disabled={txNominal <= 0 || addTxMutation.isPending}
                        className={`h-9 sm:w-auto ${txType === 'income' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}`}
                      >
                        {addTxMutation.isPending ? 'Menyimpan...' : (
                          <>
                            <Plus className="mr-1.5 h-4 w-4" /> Simpan
                          </>
                        )}
                      </Button>
                    </div>
                    {splitPreview.length > 0 && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Pembagian Proporsional per Anggota</p>
                        <div className="space-y-1">
                          {splitPreview.map((s) => {
                            const m = groupMembers.find((mm) => mm.id === s.memberId);
                            if (!m) return null;
                            return (
                              <div key={s.memberId} className="flex items-center justify-between text-xs sm:text-sm">
                                <span className="font-medium">{m.name}</span>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <span className="text-muted-foreground">{formatPercentage(s.sharePercentage)}</span>
                                  <span className={`font-semibold ${txType === 'income' ? 'text-success' : 'text-destructive'}`}>
                                    {txType === 'income' ? '+' : '-'}{formatCurrency(s.shareAmount)}
                                  </span>
                                  <span className="text-muted-foreground">→ {formatCurrency(s.balanceAfter)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Charts */}
              {chartData.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tren Transaksi Grup</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="grpIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="grpExpense" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
                          <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                          <Area type="monotone" dataKey="nominal" name="Nominal" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grpIncome)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Saldo per Anggota</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={memberBalanceChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} />
                          <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                          <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="modal" name="Modal" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="saldo" name="Saldo" radius={[4, 4, 0, 0]}>
                            {memberBalanceChartData.map((entry, i) => (
                              <Cell key={i} fill={entry.saldo >= entry.modal ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {memberTrendData.length > 1 && (
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-base">Tren Saldo per Anggota</CardTitle>
                        <CardDescription>Perkembangan saldo tiap anggota dari waktu ke waktu</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={memberTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
                            <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {stableMemberOrder(groupMembers).map((m, i) => (
                              <Line
                                key={m.id}
                                type="monotone"
                                dataKey={m.name}
                                name={m.name}
                                stroke={getMemberColor(i)}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {selectedGroup?.show_leaderboard && leaderboard.length > 0 && (
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-base">🏆 Papan Peringkat Anggota</CardTitle>
                        <CardDescription>Diurutkan berdasarkan persentase profit tertinggi</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {leaderboard.map((m, i) => (
                            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                  i === 0 ? 'bg-yellow-500/20 text-yellow-600' : i === 1 ? 'bg-slate-400/20 text-slate-500' : i === 2 ? 'bg-orange-500/20 text-orange-600' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {i + 1}
                                </span>
                                <span className="text-sm font-medium">{m.name}</span>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${m.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {m.profit >= 0 ? '+' : ''}{formatCurrency(m.profit)}
                                </p>
                                <p className="text-xs text-muted-foreground">{formatPercentage(m.profitPercentage)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Transaction table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">Riwayat Transaksi Grup</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Cari transaksi..." value={search} onChange={(e) => setSearch(e.target.value)}
                          className="h-8 w-full pl-8 text-sm sm:w-48" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                        <FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                        <SheetIcon className="mr-1.5 h-3.5 w-3.5" /> Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredTx.length === 0 ? (
                    <EmptyState
                      icon={<Wallet className="h-6 w-6" />}
                      title="Belum ada transaksi grup"
                      description="Tambahkan pemasukan atau pengeluaran grup. Dana akan dibagi proporsional."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Jenis</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">Nominal</TableHead>
                            <TableHead>Dampak Anggota</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTx.map((tx) => {
                            const details = groupDetails.filter((d) => d.group_transaction_id === tx.id);
                            return (
                              <TableRow key={tx.id} className="group">
                                <TableCell className="whitespace-nowrap text-sm">{formatDate(tx.transaction_date)}</TableCell>
                                <TableCell>
                                  {tx.is_capital_adjustment ? (
                                    <Badge variant="outline" className="border-info text-info">
                                      {tx.type === 'income' ? 'Tambah Modal' : 'Penarikan Modal'}
                                    </Badge>
                                  ) : (
                                    <Badge variant={tx.type === 'income' ? 'default' : 'destructive'}
                                      className={tx.type === 'income' ? 'bg-success/10 text-success hover:bg-success/20' : ''}>
                                      {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">{tx.category}</TableCell>
                                <TableCell className={`text-right text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.nominal))}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {details.slice(0, 3).map((d) => {
                                      const m = groupMembers.find((mm) => mm.id === d.member_id);
                                      return m ? (
                                        <span key={d.id} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                                          {m.name} {formatPercentage(Number(d.share_percentage))}
                                        </span>
                                      ) : null;
                                    })}
                                    {details.length > 3 && (
                                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">+{details.length - 3}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive opacity-60 transition-opacity group-hover:opacity-100"
                                    onClick={() => setConfirmDelete({ type: 'tx', id: tx.id })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Group form dialog */}
      <Dialog open={showGroupForm} onOpenChange={setShowGroupForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Grup' : 'Buat Grup Baru'}</DialogTitle>
            <DialogDescription>{editingGroup ? 'Perbarui informasi grup' : 'Buat grup bisnis kelompok baru'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grp-name">Nama Grup</Label>
              <Input id="grp-name" placeholder="Contoh: Bisnis A" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grp-desc">Deskripsi (opsional)</Label>
              <Textarea id="grp-desc" placeholder="Deskripsi grup..." rows={2} value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupForm(false)}>Batal</Button>
            <Button onClick={saveGroup}>{editingGroup ? 'Simpan' : 'Buat Grup'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member form dialog */}
      <Dialog open={showMemberForm} onOpenChange={setShowMemberForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Edit Anggota' : 'Tambah Anggota'}</DialogTitle>
            <DialogDescription>{editingMember ? 'Perbarui data anggota' : 'Tambahkan anggota baru dengan modal awal'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Nama Anggota</Label>
              <Input id="m-name" placeholder="Contoh: Budi" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-phone">Nomor HP (opsional)</Label>
              <Input id="m-phone" placeholder="08xxxxxxxxxx" value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-capital">Modal Awal (Rp)</Label>
              <CurrencyInput id="m-capital" value={memberCapital} onValueChange={setMemberCapital} placeholder="0" />
              {groupSummary && memberCapital > 0 && !editingMember && (
                <p className="text-xs text-muted-foreground">
                  Kepemilikan: {formatPercentage((memberCapital / (groupSummary.totalCapital + memberCapital)) * 100)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMemberForm(false)}>Batal</Button>
            <Button onClick={saveMember}>{editingMember ? 'Simpan' : 'Tambah Anggota'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN management dialog */}
      <Dialog open={!!pinDialogMember} onOpenChange={(o) => !o && setPinDialogMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN Akses Monitoring — {pinDialogMember?.name}</DialogTitle>
            <DialogDescription>
              Bagikan PIN ini ke {pinDialogMember?.name} supaya bisa memantau Keuangan Grup tanpa perlu daftar akun.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {generatedPin ? (
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
                <p className="text-xs text-muted-foreground">PIN Baru (catat sekarang, tidak akan tampil lagi)</p>
                <p className="mt-1 text-3xl font-bold tracking-widest text-success">{generatedPin}</p>
                <Button
                  variant="outline" size="sm" className="mt-3"
                  onClick={() => { navigator.clipboard.writeText(generatedPin); toast.success('PIN disalin'); }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Salin PIN
                </Button>
              </div>
            ) : pinDialogMember?.pin_code_hash ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                PIN aktif untuk anggota ini (tersimpan aman, tidak bisa dilihat ulang). Reset kalau lupa atau ingin ganti.
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Anggota ini belum punya PIN akses monitoring.
              </div>
            )}
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
              Anggota buka <span className="font-mono text-foreground">{window.location.origin}/monitor</span>,
              masukkan PIN di atas untuk melihat Keuangan Grup (read-only).
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {pinDialogMember?.pin_code_hash && (
              <Button
                variant="outline" className="text-destructive"
                onClick={() => pinDialogMember && clearPinMut.mutate(pinDialogMember.id)}
                disabled={clearPinMut.isPending}
              >
                Nonaktifkan PIN
              </Button>
            )}
            <Button
              onClick={() => pinDialogMember && generatePinMut.mutate(pinDialogMember)}
              disabled={generatePinMut.isPending}
            >
              {pinDialogMember?.pin_code_hash ? 'Reset PIN Baru' : 'Buat PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTxDialog} onOpenChange={setShowTxDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{txType === 'income' ? 'Tambah Pemasukan Grup' : 'Tambah Pengeluaran Grup'}</DialogTitle>
            <DialogDescription>
              {txType === 'income' ? 'Dana masuk dibagi proporsional ke semua anggota' : 'Pengeluaran dipotong proporsional dari semua anggota'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setTxType('income'); setTxCategory('Pemasukan'); }}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${txType === 'income' ? 'border-success bg-success/10 text-success' : 'border-border hover:bg-accent'}`}>
                <ArrowUpRight className="h-4 w-4" /> Pemasukan
              </button>
              <button type="button" onClick={() => { setTxType('expense'); setTxCategory('Pengeluaran'); }}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${txType === 'expense' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-accent'}`}>
                <ArrowDownRight className="h-4 w-4" /> Pengeluaran
              </button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gtx-nominal">Nominal</Label>
              <CurrencyInput id="gtx-nominal" value={txNominal} onValueChange={setTxNominal} placeholder="0" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gtx-date">Tanggal</Label>
                <Input id="gtx-date" type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gtx-cat">Kategori</Label>
                <Input id="gtx-cat" value={txCategory} onChange={(e) => setTxCategory(e.target.value)}
                  placeholder={txType === 'income' ? 'Pemasukan' : 'Pengeluaran'} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gtx-desc">Keterangan (opsional)</Label>
              <Textarea id="gtx-desc" value={txDescription} onChange={(e) => setTxDescription(e.target.value)}
                placeholder="Tambahkan keterangan..." rows={2} />
            </div>

            {/* Split preview */}
            {splitPreview.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Pembagian Proporsional per Anggota</p>
                <div className="space-y-1.5">
                  {splitPreview.map((s) => {
                    const m = groupMembers.find((mm) => mm.id === s.memberId);
                    if (!m) return null;
                    return (
                      <div key={s.memberId} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{m.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{formatPercentage(s.sharePercentage)}</span>
                          <span className={`font-semibold ${txType === 'income' ? 'text-success' : 'text-destructive'}`}>
                            {txType === 'income' ? '+' : '-'}{formatCurrency(s.shareAmount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            → {formatCurrency(s.balanceAfter)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxDialog(false)}>Batal</Button>
            <Button onClick={() => addTxMutation.mutate()} disabled={txNominal <= 0 || addTxMutation.isPending}
              className={txType === 'income' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}>
              {addTxMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member detail sheet */}
      <Sheet open={!!detailMember} onOpenChange={(o) => !o && setDetailMember(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetTitle className="sr-only">Detail Anggota</SheetTitle>
          {detailMember && (
            <MemberDetail
              member={detailMember}
              details={groupDetails}
              groupSummary={groupSummary}
              onEdit={() => { openEditMember(detailMember); setDetailMember(null); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmDelete?.type === 'tx'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Transaksi Grup?"
        description="Transaksi dan detail pembagian per anggota akan dihapus. Saldo anggota dihitung ulang."
        confirmText="Hapus" destructive
        onConfirm={() => confirmDelete?.id && deleteTxMutation.mutate(confirmDelete.id)}
      />
      <ConfirmDialog
        open={confirmDelete?.type === 'group'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Grup?"
        description="Semua anggota dan transaksi grup akan ikut terhapus. Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus" destructive
        onConfirm={() => confirmDelete?.id && deleteGroupMutation.mutate(confirmDelete.id)}
      />
      <ConfirmDialog
        open={confirmDelete?.type === 'member'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Anggota?"
        description="Anggota dan detail transaksinya akan dihapus dari grup."
        confirmText="Hapus" destructive
        onConfirm={() => confirmDelete?.id && deleteMemberMutation.mutate(confirmDelete.id)}
      />
      <ConfirmDialog
        open={confirmDelete?.type === 'reset'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Reset Semua Transaksi Grup?"
        description={`Semua transaksi untuk "${selectedGroup?.name}" akan dihapus. Saldo anggota kembali ke modal awal.`}
        confirmText="Reset Sekarang" destructive
        onConfirm={() => resetTxMutation.mutate()}
      />
    </div>
  );
}

// Member detail component
function MemberDetail({
  member,
  details,
  groupSummary,
  onEdit,
}: {
  member: GroupMember;
  details: MemberTransactionDetail[];
  groupSummary: ReturnType<typeof computeGroupSummary> | null;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';

  const summary = computeMemberSummary(member, details);
  const memberDetails = details
    .filter((d) => d.member_id === member.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const chartData = useMemo(() => {
    const sorted = [...memberDetails].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return sorted.map((d) => ({
      label: formatDate(d.created_at, 'dd/MM'),
      saldo: Number(d.balance_after),
    }));
  }, [memberDetails]);

  const sharePct = groupSummary && groupSummary.totalCapital > 0
    ? (Number(member.initial_capital) / groupSummary.totalCapital) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold">{member.name}</h3>
          {member.phone && <p className="text-sm text-muted-foreground">{member.phone}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
        </Button>
      </div>

      <div className="rounded-lg bg-primary/5 p-3 text-center">
        <p className="text-xs text-muted-foreground">Kepemilikan Modal</p>
        <p className="text-xl font-bold text-primary">{formatPercentage(sharePct)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Modal Awal</p>
          <p className="text-sm font-bold">{formatCurrency(Number(member.initial_capital))}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Saldo Saat Ini</p>
          <p className="text-sm font-bold text-primary">{formatCurrency(summary.currentBalance)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Total Pemasukan</p>
          <p className="text-sm font-bold text-success">{formatCurrency(summary.totalIncome)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
          <p className="text-sm font-bold text-destructive">{formatCurrency(summary.totalExpense)}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Profit ({formatPercentage(summary.profitPercentage)})</p>
          <p className={`text-sm font-bold ${summary.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(summary.profit)}
          </p>
          <Progress value={Math.min(Math.abs(summary.profitPercentage), 100)} className={`mt-2 ${summary.profitPercentage < 0 ? 'bg-destructive/20' : ''}`} />
        </div>
      </div>

      {chartData.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Grafik Saldo</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="memberSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisColor }} />
              <YAxis tick={{ fontSize: 10, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#memberSaldo)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">Riwayat Transaksi ({memberDetails.length})</p>
        {memberDetails.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada transaksi</p>
        ) : (
          <div className="space-y-1.5">
            {memberDetails.map((d) => {
              const delta = Number(d.balance_after) - Number(d.balance_before);
              const isIncome = delta > 0;
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md ${isIncome ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {isIncome ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatCurrency(Number(d.share_amount))}</p>
                    <p className="text-xs text-muted-foreground">{formatPercentage(Number(d.share_percentage))} • {formatDate(d.created_at)}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{formatCurrency(Number(d.balance_after))}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
