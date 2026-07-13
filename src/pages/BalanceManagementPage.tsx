import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings as SettingsIcon,
  Plus,
  TrendingUp,
  TrendingDown,
  Percent,
  Search,
  FileDown,
  Sheet,
  FileText,
  Trash2,
  User,
  Users,
  Store,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  calculateWithdrawal,
  validateWithdrawal,
  generateTransactionNo,
  getMemberBalance,
} from '@/lib/finance';
import { formatCurrency, formatPercentage, formatDate, todayISO } from '@/lib/format';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import { useBalanceData } from '@/hooks/use-balance';
import { useDashboardData } from '@/hooks/use-dashboard';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

type TabValue = 'overview' | 'topup' | 'withdraw' | 'settings';

export function BalanceManagementPage() {
  const [tab, setTab] = useState<TabValue>('overview');

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold tracking-tight">Manajemen Saldo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Penambahan modal, penarikan dana, dan pengaturan potongan
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">
            <Wallet className="mr-1.5 h-3.5 w-3.5" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger value="topup">
            <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" /> Penambahan Modal
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <ArrowUpFromLine className="mr-1.5 h-3.5 w-3.5" /> Penarikan Dana
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon className="mr-1.5 h-3.5 w-3.5" /> Pengaturan Potongan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab onNavigate={setTab} />
        </TabsContent>
        <TabsContent value="topup" className="mt-4">
          <TopUpTab />
        </TabsContent>
        <TabsContent value="withdraw" className="mt-4">
          <WithdrawTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================
// OVERVIEW TAB
// =============================================================
function OverviewTab({ onNavigate }: { onNavigate: (t: TabValue) => void }) {
  const { capitalAdditions, withdrawals } = useBalanceData();

  const todayStr = todayISO();
  const monthStr = todayStr.slice(0, 7);

  const stats = useMemo(() => {
    const todayWithdrawals = withdrawals.filter((w) => w.transaction_date === todayStr);
    const monthWithdrawals = withdrawals.filter((w) => w.transaction_date.startsWith(monthStr));
    return {
      totalCapitalIn: capitalAdditions.reduce((s, c) => s + Number(c.nominal), 0),
      totalWithdrawals: withdrawals.reduce((s, w) => s + Number(w.withdrawal_amount), 0),
      totalFees: withdrawals.reduce((s, w) => s + Number(w.fee_amount), 0),
      totalNetReceived: withdrawals.reduce((s, w) => s + Number(w.net_received), 0),
      todayWithdrawals: todayWithdrawals.reduce((s, w) => s + Number(w.withdrawal_amount), 0),
      todayFees: todayWithdrawals.reduce((s, w) => s + Number(w.fee_amount), 0),
      monthFees: monthWithdrawals.reduce((s, w) => s + Number(w.fee_amount), 0),
    };
  }, [capitalAdditions, withdrawals, todayStr, monthStr]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Modal Masuk" value={formatCurrency(stats.totalCapitalIn)} icon={TrendingUp} accent="success" />
        <StatCard label="Total Penarikan" value={formatCurrency(stats.totalWithdrawals)} icon={TrendingDown} accent="destructive" />
        <StatCard label="Total Potongan" value={formatCurrency(stats.totalFees)} icon={Percent} accent="warning" />
        <StatCard label="Dana Bersih Diterima" value={formatCurrency(stats.totalNetReceived)} icon={Wallet} accent="info" />
        <StatCard label="Penarikan Hari Ini" value={formatCurrency(stats.todayWithdrawals)} icon={ArrowUpFromLine} accent="primary" />
        <StatCard label="Potongan Bulan Ini" value={formatCurrency(stats.monthFees)} icon={Percent} accent="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownToLine className="h-4 w-4 text-success" /> Penambahan Modal Terbaru
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('topup')}>Lihat Semua</Button>
            </div>
          </CardHeader>
          <CardContent>
            {capitalAdditions.length === 0 ? (
              <EmptyState
                icon={<ArrowDownToLine className="h-6 w-6" />}
                title="Belum ada penambahan modal"
                description="Tambah modal untuk bisnis pribadi atau anggota grup."
                action={<Button size="sm" onClick={() => onNavigate('topup')}><Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Modal</Button>}
              />
            ) : (
              <div className="space-y-1">
                {capitalAdditions.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10 text-success">
                      <ArrowDownToLine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{formatCurrency(Number(c.nominal))}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.transaction_date)} • {c.scope === 'personal' ? 'Pribadi' : 'Grup'}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatCurrency(Number(c.balance_after))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpFromLine className="h-4 w-4 text-destructive" /> Penarikan Terbaru
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('withdraw')}>Lihat Semua</Button>
            </div>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <EmptyState
                icon={<ArrowUpFromLine className="h-6 w-6" />}
                title="Belum ada penarikan"
                description="Tarik dana dari saldo bisnis atau anggota grup."
                action={<Button size="sm" onClick={() => onNavigate('withdraw')}><Plus className="mr-1.5 h-3.5 w-3.5" /> Tarik Dana</Button>}
              />
            ) : (
              <div className="space-y-1">
                {withdrawals.slice(0, 5).map((w) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <ArrowUpFromLine className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{formatCurrency(Number(w.withdrawal_amount))}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(w.transaction_date)} • Pot: {formatCurrency(Number(w.fee_amount))} • Bersih: {formatCurrency(Number(w.net_received))}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{w.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =============================================================
// TOP UP TAB
// =============================================================
function TopUpTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { capitalAdditions } = useBalanceData();
  const dashData = useDashboardData();

  const [scope, setScope] = useState<'personal' | 'group'>('personal');
  const [selectedBizId, setSelectedBizId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [nominal, setNominal] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const businesses = dashData.personalBusiness;
  const groups = dashData.groups;
  const groupMembers = useMemo(
    () => (selectedGroupId ? dashData.groupMembers.filter((m) => m.group_id === selectedGroupId) : []),
    [dashData.groupMembers, selectedGroupId]
  );

  // Compute current balance for selected target
  const currentBalance = useMemo(() => {
    if (scope === 'personal') {
      const biz = businesses.find((b) => b.id === selectedBizId);
      if (!biz) return 0;
      const bizTx = dashData.personalTransactions.filter((t) => t.business_id === biz.id);
      const lastTx = [...bizTx].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      )[0];
      return lastTx ? Number(lastTx.balance_after) : Number(biz.initial_capital);
    } else {
      const member = groupMembers.find((m) => m.id === selectedMemberId);
      if (!member) return 0;
      return getMemberBalance(member, dashData.memberDetails);
    }
  }, [scope, selectedBizId, selectedMemberId, businesses, groupMembers, dashData]);

  const addCapitalMut = useMutation({
    mutationFn: async () => {
      if (nominal <= 0) throw new Error('Nominal harus lebih dari 0.');
      const refId = scope === 'personal' ? selectedBizId : selectedMemberId;
      if (!refId) throw new Error('Pilih target terlebih dahulu.');

      const txNo = generateTransactionNo('TPU', capitalAdditions.length);
      const balanceBefore = currentBalance;
      const balanceAfter = balanceBefore + nominal;

      const { data, error } = await supabase.from('capital_additions').insert({
        user_id: user!.id,
        scope,
        ref_id: refId,
        group_id: scope === 'group' ? selectedGroupId : null,
        transaction_no: txNo,
        transaction_date: date,
        nominal,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: description || null,
      }).select().single();
      if (error) throw error;

      // Update initial_capital on the source record
      if (scope === 'personal') {
        const biz = businesses.find((b) => b.id === refId);
        const newCapital = Number(biz?.initial_capital) + nominal;
        await supabase.from('personal_business').update({ initial_capital: newCapital, updated_at: new Date().toISOString() }).eq('id', refId);
      } else {
        const member = groupMembers.find((m) => m.id === refId);
        const newCapital = Number(member?.initial_capital) + nominal;
        await supabase.from('group_members').update({ initial_capital: newCapital }).eq('id', refId);

        // Insert group_transaction + member_transaction_detail so balance reflects in Group Finance
        const grTxNo = generateTransactionNo('GR', dashData.groupTransactions.length);
        const { data: grTx, error: grErr } = await supabase
          .from('group_transactions')
          .insert({
            user_id: user!.id,
            group_id: selectedGroupId,
            transaction_no: grTxNo,
            transaction_date: date,
            type: 'income',
            category: 'Tambah Modal',
            description: description || 'Penambahan modal anggota',
            nominal,
            is_capital_adjustment: true,
          })
          .select()
          .single();
        if (grErr) throw grErr;

        const { error: detErr } = await supabase.from('member_transaction_details').insert({
          user_id: user!.id,
          group_transaction_id: grTx.id,
          group_id: selectedGroupId,
          member_id: refId,
          share_percentage: 100,
          share_amount: nominal,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          is_capital_adjustment: true,
        });
        if (detErr) throw detErr;
      }

      await logAudit('create', 'capital_additions', data.id, { scope, nominal });
    },
    onSuccess: () => {
      toast.success('Penambahan modal berhasil disimpan');
      setNominal(0);
      setDescription('');
      qc.invalidateQueries({ queryKey: ['capital_additions'] });
      qc.invalidateQueries({ queryKey: ['personal_business'] });
      qc.invalidateQueries({ queryKey: ['group_members'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
      qc.invalidateQueries({ queryKey: ['group_transactions'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCapitalMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('capital_additions').delete().eq('id', id);
      if (error) throw error;
      await logAudit('delete', 'capital_additions', id);
    },
    onSuccess: () => {
      toast.success('Catatan penambahan modal dihapus');
      qc.invalidateQueries({ queryKey: ['capital_additions'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!search) return capitalAdditions;
    const q = search.toLowerCase();
    return capitalAdditions.filter(
      (c) => c.transaction_no.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)
    );
  }, [capitalAdditions, search]);

  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { header: 'No. Transaksi', key: 'transaction_no' },
      { header: 'Tanggal', key: 'date_fmt' },
      { header: 'Lingkup', key: 'scope' },
      { header: 'Nominal', key: 'nominal_fmt' },
      { header: 'Saldo Sebelum', key: 'before_fmt' },
      { header: 'Saldo Sesudah', key: 'after_fmt' },
      { header: 'Keterangan', key: 'description' },
    ];
    const rows = filtered.map((c) => ({
      transaction_no: c.transaction_no,
      date_fmt: formatDate(c.transaction_date),
      scope: c.scope === 'personal' ? 'Pribadi' : 'Grup',
      nominal_fmt: formatCurrency(Number(c.nominal)),
      before_fmt: formatCurrency(Number(c.balance_before)),
      after_fmt: formatCurrency(Number(c.balance_after)),
      description: c.description ?? '-',
    }));
    const fname = `laporan-penambahan-modal-${todayISO()}`;
    if (format === 'csv') exportToCSV(fname, columns, rows);
    else if (format === 'excel') exportToExcel(fname, columns, rows);
    else exportToPDF(fname, 'Laporan Penambahan Modal', columns, rows);
    toast.success(`Data berhasil diexport ke ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-4">
      {/* Top up form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownToLine className="h-4 w-4 text-success" /> Tambah Modal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setScope('personal'); setSelectedBizId(''); setSelectedMemberId(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-all ${
                scope === 'personal' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
              }`}
            >
              <Store className="h-4 w-4" /> Bisnis Pribadi
            </button>
            <button
              type="button"
              onClick={() => { setScope('group'); setSelectedGroupId(''); setSelectedMemberId(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-all ${
                scope === 'group' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
              }`}
            >
              <Users className="h-4 w-4" /> Anggota Grup
            </button>
          </div>

          {scope === 'personal' ? (
            <div className="space-y-1.5">
              <Label>Pilih Bisnis</Label>
              <Select value={selectedBizId} onValueChange={setSelectedBizId}>
                <SelectTrigger><SelectValue placeholder="Pilih bisnis pribadi" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pilih Grup</Label>
                <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setSelectedMemberId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Pilih grup" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pilih Anggota</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId} disabled={!selectedGroupId}>
                  <SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                  <SelectContent>
                    {groupMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} — {formatCurrency(Number(m.initial_capital))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nominal</Label>
              <CurrencyInput value={nominal} onValueChange={setNominal} placeholder="0" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Keterangan (opsional)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tambahkan keterangan..." />
          </div>

          {nominal > 0 && (scope === 'personal' ? selectedBizId : selectedMemberId) && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo saat ini</span>
                <span className="font-medium">{formatCurrency(currentBalance)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Saldo setelah tambah modal</span>
                <span className="font-bold text-success">{formatCurrency(currentBalance + nominal)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={() => addCapitalMut.mutate()}
            disabled={nominal <= 0 || addCapitalMut.isPending || (scope === 'personal' ? !selectedBizId : !selectedMemberId)}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {addCapitalMut.isPending ? 'Menyimpan...' : <><Plus className="mr-1.5 h-4 w-4" /> Simpan Penambahan Modal</>}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Riwayat Penambahan Modal</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full pl-8 text-sm sm:w-40" />
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><FileDown className="mr-1 h-3.5 w-3.5" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Sheet className="mr-1 h-3.5 w-3.5" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><FileText className="mr-1 h-3.5 w-3.5" /> PDF</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState icon={<ArrowDownToLine className="h-6 w-6" />} title="Belum ada penambahan modal" description="Tambahkan modal untuk bisnis atau anggota grup." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Lingkup</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead className="text-right">Saldo Sebelum</TableHead>
                    <TableHead className="text-right">Saldo Sesudah</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="group">
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{c.transaction_no}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(c.transaction_date)}</TableCell>
                      <TableCell><Badge variant={c.scope === 'personal' ? 'secondary' : 'outline'} className="text-xs">{c.scope === 'personal' ? 'Pribadi' : 'Grup'}</Badge></TableCell>
                      <TableCell className="text-right text-sm font-semibold text-success">+{formatCurrency(Number(c.nominal))}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(Number(c.balance_before))}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(c.balance_after))}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">{c.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-60 group-hover:opacity-100" onClick={() => setConfirmDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Catatan Penambahan Modal?"
        description="Catatan ini akan dihapus dari riwayat. Saldo tidak akan dikembalikan otomatis."
        confirmText="Hapus" destructive
        onConfirm={() => confirmDelete && deleteCapitalMut.mutate(confirmDelete)}
      />
    </div>
  );
}

// =============================================================
// WITHDRAW TAB
// =============================================================
function WithdrawTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { withdrawals, withdrawalSettings, memberWithdrawalSettings } = useBalanceData();
  const dashData = useDashboardData();

  const [scope, setScope] = useState<'personal' | 'group'>('personal');
  const [selectedBizId, setSelectedBizId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const businesses = dashData.personalBusiness;
  const groups = dashData.groups;
  const groupMembers = useMemo(
    () => (selectedGroupId ? dashData.groupMembers.filter((m) => m.group_id === selectedGroupId) : []),
    [dashData.groupMembers, selectedGroupId]
  );

  // Compute current balance
  const currentBalance = useMemo(() => {
    if (scope === 'personal') {
      const biz = businesses.find((b) => b.id === selectedBizId);
      if (!biz) return 0;
      const bizTx = dashData.personalTransactions.filter((t) => t.business_id === biz.id);
      const lastTx = [...bizTx].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      )[0];
      return lastTx ? Number(lastTx.balance_after) : Number(biz.initial_capital);
    } else {
      const member = groupMembers.find((m) => m.id === selectedMemberId);
      if (!member) return 0;
      return getMemberBalance(member, dashData.memberDetails);
    }
  }, [scope, selectedBizId, selectedMemberId, businesses, groupMembers, dashData]);

  // Get applicable fee settings
  const feeConfig = useMemo(() => {
    if (scope === 'personal') {
      // For personal: use global settings (group_id = null)
      const global = withdrawalSettings.find((s) => s.group_id === null);
      return {
        feePercentage: global?.fee_percentage ?? 0,
        fixedFee: global?.fixed_fee ?? 0,
        minWithdrawal: global?.min_withdrawal ?? 0,
        maxWithdrawal: global?.max_withdrawal ?? 0,
      };
    } else {
      // For group: check member override first, then group settings
      const memberOverride = memberWithdrawalSettings.find((s) => s.member_id === selectedMemberId);
      if (memberOverride) {
        const groupSettings = withdrawalSettings.find((s) => s.group_id === selectedGroupId);
        return {
          feePercentage: memberOverride.fee_percentage,
          fixedFee: memberOverride.fixed_fee,
          minWithdrawal: groupSettings?.min_withdrawal ?? 0,
          maxWithdrawal: groupSettings?.max_withdrawal ?? 0,
        };
      }
      const groupSettings = withdrawalSettings.find((s) => s.group_id === selectedGroupId);
      return {
        feePercentage: groupSettings?.fee_percentage ?? 0,
        fixedFee: groupSettings?.fixed_fee ?? 0,
        minWithdrawal: groupSettings?.min_withdrawal ?? 0,
        maxWithdrawal: groupSettings?.max_withdrawal ?? 0,
      };
    }
  }, [scope, selectedMemberId, selectedGroupId, withdrawalSettings, memberWithdrawalSettings]);

  const calc = useMemo(() => {
    if (amount <= 0) return null;
    return calculateWithdrawal(currentBalance, amount, feeConfig.feePercentage, feeConfig.fixedFee);
  }, [amount, currentBalance, feeConfig]);

  const validation = useMemo(() => {
    if (amount <= 0) return { valid: false, error: null };
    return validateWithdrawal(currentBalance, amount, feeConfig.minWithdrawal, feeConfig.maxWithdrawal);
  }, [amount, currentBalance, feeConfig]);

  const withdrawMut = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error('Nominal harus lebih dari 0.');
      const refId = scope === 'personal' ? selectedBizId : selectedMemberId;
      if (!refId) throw new Error('Pilih target terlebih dahulu.');
      if (!validation.valid) throw new Error(validation.error ?? 'Validasi gagal');

      const txNo = generateTransactionNo('WDR', withdrawals.length);
      const balanceBefore = currentBalance;
      const wCalc = calculateWithdrawal(currentBalance, amount, feeConfig.feePercentage, feeConfig.fixedFee);

      const { data, error } = await supabase.from('withdrawals').insert({
        user_id: user!.id,
        scope,
        ref_id: refId,
        group_id: scope === 'group' ? selectedGroupId : null,
        member_id: scope === 'group' ? selectedMemberId : null,
        transaction_no: txNo,
        transaction_date: date,
        withdrawal_amount: amount,
        fee_percentage: feeConfig.feePercentage,
        fixed_fee: feeConfig.fixedFee,
        fee_amount: wCalc.feeAmount,
        net_received: wCalc.netReceived,
        balance_before: balanceBefore,
        balance_after: wCalc.balanceAfter,
        status: 'completed',
        reason: reason || null,
      }).select().single();
      if (error) throw error;

      // For group scope: reduce member's capital + insert group_transaction + member_transaction_detail
      if (scope === 'group' && selectedGroupId && selectedMemberId) {
        const member = groupMembers.find((m) => m.id === selectedMemberId);
        const newCapital = Number(member?.initial_capital ?? 0) - amount;
        await supabase.from('group_members').update({ initial_capital: newCapital }).eq('id', selectedMemberId);

        const grTxNo = generateTransactionNo('GR', dashData.groupTransactions.length);
        const { data: grTx, error: grErr } = await supabase
          .from('group_transactions')
          .insert({
            user_id: user!.id,
            group_id: selectedGroupId,
            transaction_no: grTxNo,
            transaction_date: date,
            type: 'expense',
            category: 'Penarikan Dana',
            description: reason || `Penarikan oleh anggota • Potongan: ${formatCurrency(wCalc.feeAmount)}`,
            nominal: amount,
            is_capital_adjustment: true,
          })
          .select()
          .single();
        if (grErr) throw grErr;

        const { error: detErr } = await supabase.from('member_transaction_details').insert({
          user_id: user!.id,
          group_transaction_id: grTx.id,
          group_id: selectedGroupId,
          member_id: selectedMemberId,
          share_percentage: 100,
          share_amount: amount,
          balance_before: balanceBefore,
          balance_after: wCalc.balanceAfter,
          is_capital_adjustment: true,
        });
        if (detErr) throw detErr;
      }

      await logAudit('create', 'withdrawals', data.id, { scope, amount, fee: wCalc.feeAmount });
    },
    onSuccess: () => {
      toast.success('Penarikan dana berhasil diproses');
      setAmount(0);
      setReason('');
      qc.invalidateQueries({ queryKey: ['withdrawals'] });
      qc.invalidateQueries({ queryKey: ['group_transactions'] });
      qc.invalidateQueries({ queryKey: ['member_transaction_details'] });
      qc.invalidateQueries({ queryKey: ['group_members'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteWithdrawMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('withdrawals').delete().eq('id', id);
      if (error) throw error;
      await logAudit('delete', 'withdrawals', id);
    },
    onSuccess: () => {
      toast.success('Catatan penarikan dihapus');
      qc.invalidateQueries({ queryKey: ['withdrawals'] });
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!search) return withdrawals;
    const q = search.toLowerCase();
    return withdrawals.filter(
      (w) => w.transaction_no.toLowerCase().includes(q) || (w.reason ?? '').toLowerCase().includes(q)
    );
  }, [withdrawals, search]);

  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { header: 'No. Transaksi', key: 'transaction_no' },
      { header: 'Tanggal', key: 'date_fmt' },
      { header: 'Lingkup', key: 'scope' },
      { header: 'Nominal Penarikan', key: 'amount_fmt' },
      { header: 'Persentase Potongan', key: 'fee_pct' },
      { header: 'Nominal Potongan', key: 'fee_fmt' },
      { header: 'Dana Bersih', key: 'net_fmt' },
      { header: 'Saldo Sebelum', key: 'before_fmt' },
      { header: 'Saldo Sesudah', key: 'after_fmt' },
      { header: 'Status', key: 'status' },
      { header: 'Keterangan', key: 'reason' },
    ];
    const rows = filtered.map((w) => ({
      transaction_no: w.transaction_no,
      date_fmt: formatDate(w.transaction_date),
      scope: w.scope === 'personal' ? 'Pribadi' : 'Grup',
      amount_fmt: formatCurrency(Number(w.withdrawal_amount)),
      fee_pct: formatPercentage(Number(w.fee_percentage)),
      fee_fmt: formatCurrency(Number(w.fee_amount)),
      net_fmt: formatCurrency(Number(w.net_received)),
      before_fmt: formatCurrency(Number(w.balance_before)),
      after_fmt: formatCurrency(Number(w.balance_after)),
      status: w.status,
      reason: w.reason ?? '-',
    }));
    const fname = `laporan-penarikan-dana-${todayISO()}`;
    if (format === 'csv') exportToCSV(fname, columns, rows);
    else if (format === 'excel') exportToExcel(fname, columns, rows);
    else exportToPDF(fname, 'Laporan Penarikan Dana', columns, rows);
    toast.success(`Data berhasil diexport ke ${format.toUpperCase()}`);
  }

  return (
    <div className="space-y-4">
      {/* Withdraw form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowUpFromLine className="h-4 w-4 text-destructive" /> Tarik Dana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setScope('personal'); setSelectedBizId(''); setSelectedMemberId(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-all ${
                scope === 'personal' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
              }`}
            >
              <Store className="h-4 w-4" /> Bisnis Pribadi
            </button>
            <button
              type="button"
              onClick={() => { setScope('group'); setSelectedGroupId(''); setSelectedMemberId(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-all ${
                scope === 'group' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
              }`}
            >
              <Users className="h-4 w-4" /> Anggota Grup
            </button>
          </div>

          {scope === 'personal' ? (
            <div className="space-y-1.5">
              <Label>Pilih Bisnis</Label>
              <Select value={selectedBizId} onValueChange={setSelectedBizId}>
                <SelectTrigger><SelectValue placeholder="Pilih bisnis pribadi" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pilih Grup</Label>
                <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setSelectedMemberId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Pilih grup" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pilih Anggota</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId} disabled={!selectedGroupId}>
                  <SelectTrigger><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                  <SelectContent>
                    {groupMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} — {formatCurrency(Number(m.initial_capital))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nominal Penarikan</Label>
              <CurrencyInput value={amount} onValueChange={setAmount} placeholder="0" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Alasan (opsional)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan penarikan..." />
          </div>

          {/* Fee info */}
          {amount > 0 && (scope === 'personal' ? selectedBizId : selectedMemberId) && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Saldo saat ini</span>
                <span className="font-medium">{formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Potongan ({formatPercentage(feeConfig.feePercentage)}{feeConfig.fixedFee > 0 ? ` + ${formatCurrency(feeConfig.fixedFee)}` : ''})</span>
                <span className="font-medium text-warning">{formatCurrency(calc?.feeAmount ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dana bersih diterima</span>
                <span className="font-bold text-success">{formatCurrency(calc?.netReceived ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted-foreground">Saldo setelah penarikan</span>
                <span className="font-bold text-destructive">{formatCurrency(calc?.balanceAfter ?? 0)}</span>
              </div>
              {validation.error && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {validation.error}
                </div>
              )}
              {feeConfig.minWithdrawal > 0 && (
                <p className="text-xs text-muted-foreground">Minimal: {formatCurrency(feeConfig.minWithdrawal)}</p>
              )}
              {feeConfig.maxWithdrawal > 0 && (
                <p className="text-xs text-muted-foreground">Maksimal: {formatCurrency(feeConfig.maxWithdrawal)}</p>
              )}
            </div>
          )}

          <Button
            onClick={() => withdrawMut.mutate()}
            disabled={amount <= 0 || withdrawMut.isPending || !validation.valid || (scope === 'personal' ? !selectedBizId : !selectedMemberId)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {withdrawMut.isPending ? 'Memproses...' : <><ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Proses Penarikan</>}
          </Button>
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Riwayat Penarikan</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full pl-8 text-sm sm:w-40" />
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><FileDown className="mr-1 h-3.5 w-3.5" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Sheet className="mr-1 h-3.5 w-3.5" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><FileText className="mr-1 h-3.5 w-3.5" /> PDF</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState icon={<ArrowUpFromLine className="h-6 w-6" />} title="Belum ada penarikan" description="Tarik dana dari saldo bisnis atau anggota grup." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Lingkup</TableHead>
                    <TableHead className="text-right">Penarikan</TableHead>
                    <TableHead className="text-right">Potongan</TableHead>
                    <TableHead className="text-right">Dana Bersih</TableHead>
                    <TableHead className="text-right">Saldo Sisa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w) => (
                    <TableRow key={w.id} className="group">
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{w.transaction_no}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(w.transaction_date)}</TableCell>
                      <TableCell><Badge variant={w.scope === 'personal' ? 'secondary' : 'outline'} className="text-xs">{w.scope === 'personal' ? 'Pribadi' : 'Grup'}</Badge></TableCell>
                      <TableCell className="text-right text-sm font-semibold text-destructive">{formatCurrency(Number(w.withdrawal_amount))}</TableCell>
                      <TableCell className="text-right text-sm text-warning">{formatCurrency(Number(w.fee_amount))}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-success">{formatCurrency(Number(w.net_received))}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(w.balance_after))}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3 text-success" /> {w.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-60 group-hover:opacity-100" onClick={() => setConfirmDelete(w.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Catatan Penarikan?"
        description="Catatan ini akan dihapus dari riwayat. Saldo tidak akan dikembalikan otomatis."
        confirmText="Hapus" destructive
        onConfirm={() => confirmDelete && deleteWithdrawMut.mutate(confirmDelete)}
      />
    </div>
  );
}

// =============================================================
// SETTINGS TAB
// =============================================================
function SettingsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { withdrawalSettings, memberWithdrawalSettings } = useBalanceData();
  const dashData = useDashboardData();

  const groups = dashData.groups;

  // Global settings state (group_id = null)
  const globalSettings = withdrawalSettings.find((s) => s.group_id === null);
  const [globalFeePct, setGlobalFeePct] = useState(String(globalSettings?.fee_percentage ?? 0));
  const [globalFixedFee, setGlobalFixedFee] = useState(Number(globalSettings?.fixed_fee ?? 0));
  const [globalMin, setGlobalMin] = useState(Number(globalSettings?.min_withdrawal ?? 0));
  const [globalMax, setGlobalMax] = useState(Number(globalSettings?.max_withdrawal ?? 0));

  // Selected group for per-group settings
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupFeePct, setGroupFeePct] = useState('');
  const [groupFixedFee, setGroupFixedFee] = useState(0);
  const [groupMin, setGroupMin] = useState(0);
  const [groupMax, setGroupMax] = useState(0);

  // Per-member override
  const groupMembers = useMemo(
    () => (selectedGroupId ? dashData.groupMembers.filter((m) => m.group_id === selectedGroupId) : []),
    [dashData.groupMembers, selectedGroupId]
  );

  // Sync group settings when selection changes
  const syncGroupSettings = (groupId: string) => {
    const s = withdrawalSettings.find((ws) => ws.group_id === groupId);
    setGroupFeePct(String(s?.fee_percentage ?? 0));
    setGroupFixedFee(Number(s?.fixed_fee ?? 0));
    setGroupMin(Number(s?.min_withdrawal ?? 0));
    setGroupMax(Number(s?.max_withdrawal ?? 0));
  };

  const saveGlobalMut = useMutation({
    mutationFn: async () => {
      const existing = withdrawalSettings.find((s) => s.group_id === null);
      if (existing) {
        const { error } = await supabase.from('withdrawal_settings').update({
          fee_percentage: parseFloat(globalFeePct) || 0,
          fixed_fee: globalFixedFee,
          min_withdrawal: globalMin,
          max_withdrawal: globalMax,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('withdrawal_settings').insert({
          user_id: user!.id,
          group_id: null,
          fee_percentage: parseFloat(globalFeePct) || 0,
          fixed_fee: globalFixedFee,
          min_withdrawal: globalMin,
          max_withdrawal: globalMax,
        });
        if (error) throw error;
      }
      await logAudit('update', 'withdrawal_settings', undefined, { scope: 'global' });
    },
    onSuccess: () => {
      toast.success('Pengaturan global berhasil disimpan');
      qc.invalidateQueries({ queryKey: ['withdrawal_settings'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan'),
  });

  const saveGroupMut = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId) throw new Error('Pilih grup terlebih dahulu');
      const existing = withdrawalSettings.find((s) => s.group_id === selectedGroupId);
      if (existing) {
        const { error } = await supabase.from('withdrawal_settings').update({
          fee_percentage: parseFloat(groupFeePct) || 0,
          fixed_fee: groupFixedFee,
          min_withdrawal: groupMin,
          max_withdrawal: groupMax,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('withdrawal_settings').insert({
          user_id: user!.id,
          group_id: selectedGroupId,
          fee_percentage: parseFloat(groupFeePct) || 0,
          fixed_fee: groupFixedFee,
          min_withdrawal: groupMin,
          max_withdrawal: groupMax,
        });
        if (error) throw error;
      }
      await logAudit('update', 'withdrawal_settings', undefined, { group: selectedGroupId });
    },
    onSuccess: () => {
      toast.success('Pengaturan grup berhasil disimpan');
      qc.invalidateQueries({ queryKey: ['withdrawal_settings'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan'),
  });

  const saveMemberOverrideMut = useMutation({
    mutationFn: async ({ memberId, feePct, fixedFee }: { memberId: string; feePct: number; fixedFee: number }) => {
      const existing = memberWithdrawalSettings.find((s) => s.member_id === memberId);
      if (existing) {
        const { error } = await supabase.from('member_withdrawal_settings').update({
          fee_percentage: feePct,
          fixed_fee: fixedFee,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const member = groupMembers.find((m) => m.id === memberId);
        const { error } = await supabase.from('member_withdrawal_settings').insert({
          user_id: user!.id,
          member_id: memberId,
          group_id: selectedGroupId,
          fee_percentage: feePct,
          fixed_fee: fixedFee,
        });
        if (error) throw error;
        void member;
      }
      await logAudit('update', 'member_withdrawal_settings', undefined, { member: memberId });
    },
    onSuccess: () => {
      toast.success('Pengaturan anggota berhasil disimpan');
      qc.invalidateQueries({ queryKey: ['member_withdrawal_settings'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan'),
  });

  const [memberOverrides, setMemberOverrides] = useState<Record<string, { feePct: string; fixedFee: number }>>({});

  return (
    <div className="space-y-4">
      {/* Global settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="h-4 w-4" /> Pengaturan Potongan Global
          </CardTitle>
          <p className="text-sm text-muted-foreground">Berlaku untuk bisnis pribadi dan grup tanpa pengaturan khusus</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Persentase Potongan (%)</Label>
              <div className="relative">
                <Input type="number" step="0.01" value={globalFeePct} onChange={(e) => setGlobalFeePct(e.target.value)} className="pr-8" />
                <Percent className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Potongan Tetap (Rp)</Label>
              <CurrencyInput value={globalFixedFee} onValueChange={setGlobalFixedFee} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Minimal Penarikan</Label>
              <CurrencyInput value={globalMin} onValueChange={setGlobalMin} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Maksimal Penarikan</Label>
              <CurrencyInput value={globalMax} onValueChange={setGlobalMax} placeholder="0" />
            </div>
          </div>
          <Button onClick={() => saveGlobalMut.mutate()} disabled={saveGlobalMut.isPending}>
            {saveGlobalMut.isPending ? 'Menyimpan...' : 'Simpan Pengaturan Global'}
          </Button>
        </CardContent>
      </Card>

      {/* Per-group settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Pengaturan Potongan per Grup
          </CardTitle>
          <p className="text-sm text-muted-foreground">Pengaturan khusus untuk setiap grup, tidak saling memengaruhi</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Pilih Grup</Label>
            <Select
              value={selectedGroupId}
              onValueChange={(v) => { setSelectedGroupId(v); syncGroupSettings(v); }}
            >
              <SelectTrigger><SelectValue placeholder="Pilih grup untuk mengatur potongan" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGroupId && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Persentase Potongan (%)</Label>
                  <div className="relative">
                    <Input type="number" step="0.01" value={groupFeePct} onChange={(e) => setGroupFeePct(e.target.value)} className="pr-8" />
                    <Percent className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Potongan Tetap (Rp)</Label>
                  <CurrencyInput value={groupFixedFee} onValueChange={setGroupFixedFee} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Minimal Penarikan</Label>
                  <CurrencyInput value={groupMin} onValueChange={setGroupMin} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Maksimal Penarikan</Label>
                  <CurrencyInput value={groupMax} onValueChange={setGroupMax} placeholder="0" />
                </div>
              </div>
              <Button onClick={() => saveGroupMut.mutate()} disabled={saveGroupMut.isPending}>
                {saveGroupMut.isPending ? 'Menyimpan...' : `Simpan Pengaturan ${groups.find((g) => g.id === selectedGroupId)?.name ?? ''}`}
              </Button>

              {/* Per-member overrides */}
              <div className="mt-4 border-t border-border pt-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4" /> Pengaturan Potongan per Anggota
                </h4>
                <p className="mb-3 text-xs text-muted-foreground">Kosongkan untuk menggunakan potongan default grup</p>
                <div className="space-y-2">
                  {groupMembers.map((m) => {
                    const existing = memberWithdrawalSettings.find((s) => s.member_id === m.id);
                    const override = memberOverrides[m.id] ?? {
                      feePct: String(existing?.fee_percentage ?? ''),
                      fixedFee: Number(existing?.fixed_fee ?? 0),
                    };
                    return (
                      <div key={m.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">Modal: {formatCurrency(Number(m.initial_capital))}</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-24">
                            <Label className="text-xs">Potongan (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="default"
                              value={override.feePct}
                              onChange={(e) => setMemberOverrides((prev) => ({ ...prev, [m.id]: { ...override, feePct: e.target.value } }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveMemberOverrideMut.mutate({
                              memberId: m.id,
                              feePct: parseFloat(override.feePct) || 0,
                              fixedFee: 0,
                            })}
                          >
                            Simpan
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
