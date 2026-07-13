import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Percent,
  Pencil,
  Trash2,
  RotateCcw,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  FileDown,
  Sheet,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { computePersonalSummary, generateTransactionNo } from '@/lib/finance';
import { formatCurrency, formatPercentage, formatDate, todayISO } from '@/lib/format';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import type { PersonalBusiness, PersonalTransaction } from '@/types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/lib/theme';

const businessSchema = z.object({
  name: z.string().min(2, 'Nama bisnis minimal 2 karakter'),
  business_type: z.string().min(1, 'Jenis bisnis wajib diisi'),
  start_date: z.string().min(1, 'Tanggal mulai wajib diisi'),
  initial_capital: z.number().min(0, 'Modal awal tidak boleh negatif'),
});
type BusinessForm = z.infer<typeof businessSchema>;

const businessTypes = ['Toko', 'Kuliner', 'Jasa', 'Retail', 'Online Shop', 'Manufaktur', 'Lainnya'];

export function PersonalFinancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [showBusinessForm, setShowBusinessForm] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<PersonalBusiness | null>(null);
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null);
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txNominal, setTxNominal] = useState(0);
  const [txCategory, setTxCategory] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(todayISO());
  const [editingTx, setEditingTx] = useState<PersonalTransaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'tx' | 'business' | 'reset'; id?: string } | null>(null);
  const [search, setSearch] = useState('');

  // Queries
  const businessesQ = useQuery({
    queryKey: ['personal_business', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_business')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PersonalBusiness[];
    },
    enabled: !!user,
  });

  const transactionsQ = useQuery({
    queryKey: ['personal_transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PersonalTransaction[];
    },
    enabled: !!user,
  });

  const businesses = businessesQ.data ?? [];
  const allTransactions = transactionsQ.data ?? [];
  const selectedBiz = businesses.find((b) => b.id === selectedBizId) ?? businesses[0] ?? null;
  const bizTransactions = useMemo(
    () => (selectedBiz ? allTransactions.filter((t) => t.business_id === selectedBiz.id) : []),
    [allTransactions, selectedBiz]
  );

  const summary = useMemo(
    () => (selectedBiz ? computePersonalSummary(Number(selectedBiz.initial_capital), bizTransactions) : null),
    [selectedBiz, bizTransactions]
  );

  // Business form
  const businessForm = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: '', business_type: 'Toko', start_date: todayISO(), initial_capital: 0 },
  });

  function openCreateBusiness() {
    setEditingBusiness(null);
    businessForm.reset({ name: '', business_type: 'Toko', start_date: todayISO(), initial_capital: 0 });
    setShowBusinessForm(true);
  }

  function openEditBusiness(biz: PersonalBusiness) {
    setEditingBusiness(biz);
    businessForm.reset({
      name: biz.name,
      business_type: biz.business_type,
      start_date: biz.start_date,
      initial_capital: Number(biz.initial_capital),
    });
    setShowBusinessForm(true);
  }

  const saveBusiness = businessForm.handleSubmit(async (values) => {
    if (editingBusiness) {
      const { error } = await supabase
        .from('personal_business')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', editingBusiness.id);
      if (error) { toast.error('Gagal memperbarui bisnis'); return; }
      await logAudit('update', 'personal_business', editingBusiness.id, { name: values.name });
      toast.success('Bisnis berhasil diperbarui');
    } else {
      const { data, error } = await supabase
        .from('personal_business')
        .insert({ ...values, user_id: user!.id })
        .select()
        .single();
      if (error) { toast.error('Gagal membuat bisnis'); return; }
      await logAudit('create', 'personal_business', data.id, { name: values.name });
      toast.success('Bisnis berhasil dibuat');
      setSelectedBizId(data.id);
    }
    setShowBusinessForm(false);
    qc.invalidateQueries({ queryKey: ['personal_business'] });
  });

  // Transaction mutations
  const addTxMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBiz || txNominal <= 0) throw new Error('Nominal tidak valid');
      const sortedTx = [...bizTransactions].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime() ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastBalance = sortedTx.length > 0
        ? Number(sortedTx[0].balance_after)
        : Number(selectedBiz.initial_capital);
      const balanceBefore = lastBalance;
      const balanceAfter = txType === 'income' ? balanceBefore + txNominal : balanceBefore - txNominal;
      const txNo = generateTransactionNo('PR', allTransactions.length);

      const { data, error } = await supabase
        .from('personal_transactions')
        .insert({
          user_id: user!.id,
          business_id: selectedBiz.id,
          transaction_no: txNo,
          transaction_date: txDate,
          type: txType,
          category: txCategory || (txType === 'income' ? 'Pemasukan' : 'Pengeluaran'),
          description: txDescription || null,
          nominal: txNominal,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        })
        .select()
        .single();
      if (error) throw error;
      await logAudit('create', 'personal_transactions', data.id, { type: txType, nominal: txNominal });
    },
    onSuccess: () => {
      toast.success(txType === 'income' ? 'Pemasukan berhasil ditambahkan' : 'Pengeluaran berhasil ditambahkan');
      resetTxForm();
      setShowTxDialog(false);
      qc.invalidateQueries({ queryKey: ['personal_transactions'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTxMutation = useMutation({
    mutationFn: async () => {
      if (!editingTx || !selectedBiz || txNominal <= 0) throw new Error('Data tidak valid');
      const { error } = await supabase
        .from('personal_transactions')
        .update({
          transaction_date: txDate,
          category: txCategory || (txType === 'income' ? 'Pemasukan' : 'Pengeluaran'),
          description: txDescription || null,
          nominal: txNominal,
        })
        .eq('id', editingTx.id);
      if (error) throw error;
      await logAudit('update', 'personal_transactions', editingTx.id, { nominal: txNominal });
    },
    onSuccess: () => {
      toast.success('Transaksi berhasil diperbarui');
      resetTxForm();
      setShowTxDialog(false);
      setEditingTx(null);
      qc.invalidateQueries({ queryKey: ['personal_transactions'] });
    },
    onError: (err) => toast.error(err.message),
  });

  function openEditTx(tx: PersonalTransaction) {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxNominal(Number(tx.nominal));
    setTxCategory(tx.category);
    setTxDescription(tx.description ?? '');
    setTxDate(tx.transaction_date);
    setShowTxDialog(true);
  }

  function resetTxForm() {
    setTxNominal(0);
    setTxCategory('');
    setTxDescription('');
    setTxDate(todayISO());
  }

  function handleSaveTx() {
    if (editingTx) updateTxMutation.mutate();
    else addTxMutation.mutate();
  }

  // Delete transaction
  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personal_transactions').delete().eq('id', id);
      if (error) throw error;
      await logAudit('delete', 'personal_transactions', id);
    },
    onSuccess: () => {
      toast.success('Transaksi berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['personal_transactions'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete business
  const deleteBusinessMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personal_business').delete().eq('id', id);
      if (error) throw error;
      await logAudit('delete', 'personal_business', id);
    },
    onSuccess: () => {
      toast.success('Bisnis berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['personal_business'] });
      qc.invalidateQueries({ queryKey: ['personal_transactions'] });
      setConfirmDelete(null);
      if (selectedBizId && businesses.length <= 1) setSelectedBizId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Reset all transactions for this business
  const resetTxMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBiz) throw new Error('Pilih bisnis terlebih dahulu');
      const { error } = await supabase
        .from('personal_transactions')
        .delete()
        .eq('business_id', selectedBiz.id);
      if (error) throw error;
      await logAudit('reset', 'personal_transactions', selectedBiz.id, { business: selectedBiz.name });
    },
    onSuccess: () => {
      toast.success('Semua transaksi berhasil direset');
      qc.invalidateQueries({ queryKey: ['personal_transactions'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Filtered transactions
  const filteredTx = useMemo(() => {
    if (!search) return bizTransactions;
    const q = search.toLowerCase();
    return bizTransactions.filter(
      (t) =>
        t.category.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        t.transaction_no.toLowerCase().includes(q)
    );
  }, [bizTransactions, search]);

  // Chart data
  const chartData = useMemo(() => {
    const sorted = [...bizTransactions].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    let running = Number(selectedBiz?.initial_capital ?? 0);
    return sorted.map((t) => {
      running = Number(t.balance_after);
      return {
        date: formatDate(t.transaction_date, 'dd/MM'),
        saldo: running,
        nominal: Number(t.nominal),
      };
    });
  }, [bizTransactions, selectedBiz]);

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';

  // Export handlers
  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { header: 'No. Transaksi', key: 'transaction_no' },
      { header: 'Tanggal', key: 'transaction_date_fmt' },
      { header: 'Jenis', key: 'type' },
      { header: 'Kategori', key: 'category' },
      { header: 'Keterangan', key: 'description' },
      { header: 'Nominal', key: 'nominal_fmt' },
      { header: 'Saldo Sebelum', key: 'balance_before_fmt' },
      { header: 'Saldo Setelah', key: 'balance_after_fmt' },
    ];
    const rows = filteredTx.map((t) => ({
      transaction_no: t.transaction_no,
      transaction_date_fmt: formatDate(t.transaction_date),
      type: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      category: t.category,
      description: t.description ?? '-',
      nominal_fmt: formatCurrency(Number(t.nominal)),
      balance_before_fmt: formatCurrency(Number(t.balance_before)),
      balance_after_fmt: formatCurrency(Number(t.balance_after)),
    }));
    const fname = `keuangan-pribadi-${selectedBiz?.name ?? 'all'}`;
    if (format === 'csv') exportToCSV(fname, columns, rows);
    else if (format === 'excel') exportToExcel(fname, columns, rows);
    else exportToPDF(fname, `Laporan Keuangan Pribadi - ${selectedBiz?.name ?? ''}`, columns, rows);
    toast.success(`Data berhasil diexport ke ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keuangan Pribadi</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kelola keuangan bisnis pribadi Anda</p>
        </div>
        <Button onClick={openCreateBusiness}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Bisnis
        </Button>
      </div>

      {businesses.length === 0 ? (
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="Belum ada bisnis pribadi"
          description="Buat bisnis pribadi pertama Anda untuk mulai mencatat keuangan."
          action={<Button onClick={openCreateBusiness}><Plus className="mr-2 h-4 w-4" /> Buat Bisnis Pribadi</Button>}
        />
      ) : (
        <>
          {/* Business selector */}
          <div className="flex flex-wrap gap-2">
            {businesses.map((biz) => (
              <button
                key={biz.id}
                onClick={() => setSelectedBizId(biz.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                  (selectedBiz?.id === biz.id)
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card hover:bg-accent'
                }`}
              >
                <Store className="mr-1.5 inline h-3.5 w-3.5" />
                {biz.name}
              </button>
            ))}
          </div>

          {selectedBiz && summary && (
            <>
              {/* Business info card */}
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Store className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedBiz.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedBiz.business_type} • Mulai {formatDate(selectedBiz.start_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditBusiness(selectedBiz)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Bisnis
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete({ type: 'business', id: selectedBiz.id })}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete({ type: 'reset' })}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Transaksi
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard label="Modal Awal" value={formatCurrency(summary.initialCapital)} icon={Wallet} accent="info" />
                <StatCard label="Total Pengeluaran" value={formatCurrency(summary.totalExpense)} icon={TrendingDown} accent="destructive" />
                <StatCard label="Total Pemasukan" value={formatCurrency(summary.totalIncome)} icon={TrendingUp} accent="success" />
                <StatCard label="Saldo Saat Ini" value={formatCurrency(summary.currentBalance)} icon={Wallet} accent="primary" />
                <StatCard label="Total Profit" value={formatCurrency(summary.profit)} icon={Activity} accent={summary.profit >= 0 ? 'success' : 'destructive'} />
                <StatCard
                  label="Persentase Profit"
                  value={formatPercentage(summary.profitPercentage)}
                  icon={Percent}
                  accent={summary.profitPercentage >= 0 ? 'success' : 'destructive'}
                />
              </div>

              {/* Profit progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Progress Profit</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Profit = Total Pemasukan - Total Pengeluaran</span>
                    <span className="font-semibold">{formatCurrency(summary.profit)} ({formatPercentage(summary.profitPercentage)})</span>
                  </div>
                  <Progress
                    value={Math.min(Math.abs(summary.profitPercentage), 100)}
                    className={summary.profitPercentage < 0 ? 'bg-destructive/20' : ''}
                  />
                </CardContent>
              </Card>

              {/* Quick transaction entry — inline, no dialog */}
              <Card className="animate-slide-up">
                <CardContent className="p-4 sm:p-5">
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
                      <Label htmlFor="quick-nominal" className="mb-1.5 block text-xs font-medium text-muted-foreground">Nominal</Label>
                      <CurrencyInput
                        id="quick-nominal"
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
                  {selectedBiz && txNominal > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Saldo sebelumnya: <span className="font-medium text-foreground">{formatCurrency(bizTransactions.length > 0 ? Number(bizTransactions[0].balance_after) : Number(selectedBiz.initial_capital))}</span></span>
                      <span className={txType === 'income' ? 'text-success' : 'text-destructive'}>
                        Saldo setelah: <span className="font-bold">{formatCurrency((bizTransactions.length > 0 ? Number(bizTransactions[0].balance_after) : Number(selectedBiz.initial_capital)) + (txType === 'income' ? txNominal : -txNominal))}</span>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Grafik Saldo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#saldoGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Transaction table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">Riwayat Transaksi</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Cari transaksi..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-8 w-full pl-8 text-sm sm:w-48"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                        <FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                        <Sheet className="mr-1.5 h-3.5 w-3.5" /> Excel
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
                      title="Belum ada transaksi"
                      description="Tambahkan pemasukan atau pengeluaran untuk mulai mencatat."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Jenis</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Keterangan</TableHead>
                            <TableHead className="text-right">Nominal</TableHead>
                            <TableHead className="text-right">Saldo Setelah</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTx.map((tx) => (
                            <TableRow key={tx.id} className="group">
                              <TableCell className="whitespace-nowrap text-sm">{formatDate(tx.transaction_date)}</TableCell>
                              <TableCell>
                                <Badge variant={tx.type === 'income' ? 'default' : 'destructive'}
                                  className={tx.type === 'income' ? 'bg-success/10 text-success hover:bg-success/20' : ''}>
                                  {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{tx.category}</TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{tx.description || '-'}</TableCell>
                              <TableCell className={`text-right text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                                {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.nominal))}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(tx.balance_after))}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTx(tx)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setConfirmDelete({ type: 'tx', id: tx.id })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
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

      {/* Business form dialog */}
      <Dialog open={showBusinessForm} onOpenChange={setShowBusinessForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBusiness ? 'Edit Bisnis' : 'Buat Bisnis Baru'}</DialogTitle>
            <DialogDescription>
              {editingBusiness ? 'Perbarui informasi bisnis Anda' : 'Lengkapi data bisnis pribadi Anda'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveBusiness} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="biz-name">Nama Bisnis</Label>
              <Input id="biz-name" placeholder="Contoh: Toko HP" {...businessForm.register('name')} />
              {businessForm.formState.errors.name && (
                <p className="text-xs text-destructive">{businessForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-type">Jenis Bisnis</Label>
              <Input id="biz-type" list="biz-types" placeholder="Pilih atau ketik jenis bisnis" {...businessForm.register('business_type')} />
              <datalist id="biz-types">
                {businessTypes.map((t) => <option key={t} value={t} />)}
              </datalist>
              {businessForm.formState.errors.business_type && (
                <p className="text-xs text-destructive">{businessForm.formState.errors.business_type.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-date">Tanggal Mulai</Label>
              <Input id="biz-date" type="date" {...businessForm.register('start_date')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="biz-capital">Modal Awal (Rp)</Label>
              <CurrencyInput
                id="biz-capital"
                value={businessForm.watch('initial_capital')}
                onValueChange={(v) => businessForm.setValue('initial_capital', v, { shouldValidate: true })}
                placeholder="0"
              />
              {businessForm.formState.errors.initial_capital && (
                <p className="text-xs text-destructive">{businessForm.formState.errors.initial_capital.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Saldo awal otomatis sama dengan modal awal</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBusinessForm(false)}>Batal</Button>
              <Button type="submit">{editingBusiness ? 'Simpan Perubahan' : 'Buat Bisnis'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Simple transaction dialog */}
      <Dialog open={showTxDialog} onOpenChange={(o) => { setShowTxDialog(o); if (!o) { setEditingTx(null); resetTxForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTx ? 'Edit Transaksi' : txType === 'income' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran'}
            </DialogTitle>
            <DialogDescription>
              {editingTx ? 'Perbaruai data transaksi' : `Masukkan nominal ${txType === 'income' ? 'pemasukan' : 'pengeluaran'}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editingTx && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setTxType('income'); setTxCategory('Pemasukan'); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                    txType === 'income' ? 'border-success bg-success/10 text-success' : 'border-border hover:bg-accent'
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" /> Pemasukan
                </button>
                <button
                  type="button"
                  onClick={() => { setTxType('expense'); setTxCategory('Pengeluaran'); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                    txType === 'expense' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-accent'
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" /> Pengeluaran
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="tx-nominal">Nominal</Label>
              <CurrencyInput
                id="tx-nominal"
                value={txNominal}
                onValueChange={setTxNominal}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tx-date">Tanggal</Label>
                <Input id="tx-date" type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-category">Kategori</Label>
                <Input id="tx-category" value={txCategory} onChange={(e) => setTxCategory(e.target.value)}
                  placeholder={txType === 'income' ? 'Pemasukan' : 'Pengeluaran'} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc">Keterangan (opsional)</Label>
              <Textarea id="tx-desc" value={txDescription} onChange={(e) => setTxDescription(e.target.value)}
                placeholder="Tambahkan keterangan..." rows={2} />
            </div>
            {selectedBiz && txNominal > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo sebelumnya</span>
                  <span className="font-medium">
                    {formatCurrency(bizTransactions.length > 0 ? Number(bizTransactions[0].balance_after) : Number(selectedBiz.initial_capital))}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Saldo setelah transaksi</span>
                  <span className={`font-bold ${txType === 'income' ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(
                      (bizTransactions.length > 0 ? Number(bizTransactions[0].balance_after) : Number(selectedBiz.initial_capital)) +
                        (txType === 'income' ? txNominal : -txNominal)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxDialog(false)}>Batal</Button>
            <Button
              onClick={handleSaveTx}
              disabled={txNominal <= 0 || addTxMutation.isPending || updateTxMutation.isPending}
              className={txType === 'income' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}
            >
              {addTxMutation.isPending || updateTxMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmDelete?.type === 'tx'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Transaksi?"
        description="Transaksi yang dihapus tidak dapat dikembalikan. Saldo akan dihitung ulang."
        confirmText="Hapus"
        destructive
        onConfirm={() => confirmDelete?.id && deleteTxMutation.mutate(confirmDelete.id)}
      />
      <ConfirmDialog
        open={confirmDelete?.type === 'business'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Bisnis?"
        description="Semua transaksi terkait bisnis ini akan ikut terhapus. Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        destructive
        onConfirm={() => confirmDelete?.id && deleteBusinessMutation.mutate(confirmDelete.id)}
      />
      <ConfirmDialog
        open={confirmDelete?.type === 'reset'}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Reset Semua Transaksi?"
        description={`Semua transaksi untuk "${selectedBiz?.name}" akan dihapus permanen. Saldo kembali ke modal awal.`}
        confirmText="Reset Sekarang"
        destructive
        onConfirm={() => resetTxMutation.mutate()}
      />
    </div>
  );
}
