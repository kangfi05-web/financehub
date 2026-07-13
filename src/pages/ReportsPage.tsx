import { useState, useMemo } from 'react';
import { Calendar, FileBarChart, FileDown, Sheet, FileText, TrendingUp, TrendingDown, Wallet, Activity, Store, Users } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard';
import { computePersonalSummary, computeGroupSummary, computeMemberSummary } from '@/lib/finance';
import { formatCurrency, formatPercentage } from '@/lib/format';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie,
} from 'recharts';
import { useTheme } from '@/lib/theme';
import { toast } from 'sonner';

type Period = 'weekly' | 'monthly' | 'yearly';

export function ReportsPage() {
  const data = useDashboardData();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [period, setPeriod] = useState<Period>('monthly');

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';

  const allTransactions = useMemo(() => {
    const personal = data.personalTransactions.map((t) => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type,
      nominal: Number(t.nominal),
      category: t.category,
      description: t.description,
      scope: 'Pribadi' as const,
    }));
    const group = data.groupTransactions.map((t) => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type,
      nominal: Number(t.nominal),
      category: t.category,
      description: t.description,
      scope: 'Grup' as const,
    }));
    return [...personal, ...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.personalTransactions, data.groupTransactions]);

  const periodData = useMemo(() => {
    const grouped: Record<string, { label: string; income: number; expense: number; profit: number }> = {};
    const getLabel = (dateStr: string, p: Period) => {
      const d = new Date(dateStr);
      if (p === 'weekly') return `${d.getFullYear()}-W${getWeekNumber(d)}`;
      if (p === 'yearly') return `${d.getFullYear()}`;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const getDisplay = (dateStr: string, p: Period) => {
      const d = new Date(dateStr);
      if (p === 'weekly') return `Minggu ${getWeekNumber(d)}`;
      if (p === 'yearly') return `${d.getFullYear()}`;
      return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    };
    for (const t of allTransactions) {
      const key = getLabel(t.date, period);
      const display = getDisplay(t.date, period);
      if (!grouped[key]) grouped[key] = { label: display, income: 0, expense: 0, profit: 0 };
      if (t.type === 'income') grouped[key].income += t.nominal;
      else grouped[key].expense += t.nominal;
      grouped[key].profit = grouped[key].income - grouped[key].expense;
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [allTransactions, period]);

  const personalSummary = useMemo(() => {
    let totalCapital = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    for (const biz of data.personalBusiness) {
      const s = computePersonalSummary(Number(biz.initial_capital), data.personalTransactions.filter((t) => t.business_id === biz.id));
      totalCapital += s.initialCapital;
      totalIncome += s.totalIncome;
      totalExpense += s.totalExpense;
    }
    return {
      totalCapital,
      totalIncome,
      totalExpense,
      balance: totalCapital + totalIncome - totalExpense,
      profit: totalIncome - totalExpense,
      profitPct: totalCapital > 0 ? ((totalIncome - totalExpense) / totalCapital) * 100 : 0,
    };
  }, [data.personalBusiness, data.personalTransactions]);

  const groupSummary = useMemo(() => {
    const gs = computeGroupSummary(data.groupMembers, data.memberDetails);
    return {
      totalCapital: gs.totalCapital,
      totalIncome: gs.totalIncome,
      totalExpense: gs.totalExpense,
      balance: gs.groupBalance,
      profit: gs.profit,
      profitPct: gs.profitPercentage,
    };
  }, [data.groupMembers, data.memberDetails]);

  const pieData = useMemo(
    () => [
      { name: 'Pemasukan', value: personalSummary.totalIncome + groupSummary.totalIncome, fill: 'hsl(var(--success))' },
      { name: 'Pengeluaran', value: personalSummary.totalExpense + groupSummary.totalExpense, fill: 'hsl(var(--destructive))' },
    ],
    [personalSummary, groupSummary]
  );

  const memberComparison = useMemo(
    () =>
      data.groupMembers.map((m) => {
        const s = computeMemberSummary(m, data.memberDetails);
        return { name: m.name, profit: s.profit, saldo: s.currentBalance };
      }),
    [data.groupMembers, data.memberDetails]
  );

  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { header: 'Periode', key: 'label' },
      { header: 'Pemasukan', key: 'income_fmt' },
      { header: 'Pengeluaran', key: 'expense_fmt' },
      { header: 'Profit', key: 'profit_fmt' },
    ];
    const rows = periodData.map((p) => ({
      label: p.label,
      income_fmt: formatCurrency(p.income),
      expense_fmt: formatCurrency(p.expense),
      profit_fmt: formatCurrency(p.profit),
    }));
    const fname = `laporan-keuangan-${period}`;
    if (format === 'csv') exportToCSV(fname, columns, rows);
    else if (format === 'excel') exportToExcel(fname, columns, rows);
    else exportToPDF(fname, `Laporan Keuangan ${period}`, columns, rows);
    toast.success(`Laporan berhasil diexport ke ${format.toUpperCase()}`);
  }

  const hasData = allTransactions.length > 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold tracking-tight">Laporan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Analisis laporan keuangan Anda berdasarkan periode</p>
      </div>

      {!hasData ? (
        <EmptyState
          icon={<FileBarChart className="h-6 w-6" />}
          title="Belum ada data untuk dilaporkan"
          description="Tambahkan transaksi di keuangan pribadi atau grup untuk melihat laporan di sini."
        />
      ) : (
        <>
          {/* Personal summary */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10 text-info">
                <Store className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-semibold">Keuangan Pribadi</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total Modal" value={formatCurrency(personalSummary.totalCapital)} icon={Wallet} accent="info" />
              <StatCard label="Pengeluaran" value={formatCurrency(personalSummary.totalExpense)} icon={TrendingDown} accent="destructive" />
              <StatCard label="Pemasukan" value={formatCurrency(personalSummary.totalIncome)} icon={TrendingUp} accent="success" />
              <StatCard label="Saldo" value={formatCurrency(personalSummary.balance)} icon={Wallet} accent="primary" />
              <StatCard label="Profit" value={formatCurrency(personalSummary.profit)} icon={Activity} accent={personalSummary.profit >= 0 ? 'success' : 'destructive'} />
              <StatCard label="Persentase" value={formatPercentage(personalSummary.profitPct)} icon={TrendingUp} accent={personalSummary.profitPct >= 0 ? 'success' : 'destructive'} />
            </div>
          </div>

          {/* Group summary */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-semibold">Keuangan Grup</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total Modal" value={formatCurrency(groupSummary.totalCapital)} icon={Wallet} accent="info" />
              <StatCard label="Pengeluaran" value={formatCurrency(groupSummary.totalExpense)} icon={TrendingDown} accent="destructive" />
              <StatCard label="Pemasukan" value={formatCurrency(groupSummary.totalIncome)} icon={TrendingUp} accent="success" />
              <StatCard label="Saldo Grup" value={formatCurrency(groupSummary.balance)} icon={Wallet} accent="primary" />
              <StatCard label="Profit Grup" value={formatCurrency(groupSummary.profit)} icon={Activity} accent={groupSummary.profit >= 0 ? 'success' : 'destructive'} />
              <StatCard label="Persentase" value={formatPercentage(groupSummary.profitPct)} icon={TrendingUp} accent={groupSummary.profitPct >= 0 ? 'success' : 'destructive'} />
            </div>
          </div>

          {/* Period tabs */}
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="weekly"><Calendar className="mr-1.5 h-3.5 w-3.5" /> Mingguan</TabsTrigger>
                <TabsTrigger value="monthly"><Calendar className="mr-1.5 h-3.5 w-3.5" /> Bulanan</TabsTrigger>
                <TabsTrigger value="yearly"><Calendar className="mr-1.5 h-3.5 w-3.5" /> Tahunan</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><FileDown className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Sheet className="mr-1.5 h-3.5 w-3.5" /> Excel</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><FileText className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
              </div>
            </div>

            <TabsContent value={period} className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grafik {period === 'weekly' ? 'Mingguan' : period === 'monthly' ? 'Bulanan' : 'Tahunan'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={periodData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                      <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="income" name="Pemasukan" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Pengeluaran" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Profit line chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tren Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie chart income vs expense */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perbandingan Pemasukan vs Pengeluaran</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Member comparison */}
          {memberComparison.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perbandingan Profit Anggota Grup</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={memberComparison} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axisColor }} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]}>
                      {memberComparison.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Period table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabel Laporan Periode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left font-medium text-muted-foreground">Periode</th>
                      <th className="py-2 text-right font-medium text-muted-foreground">Pemasukan</th>
                      <th className="py-2 text-right font-medium text-muted-foreground">Pengeluaran</th>
                      <th className="py-2 text-right font-medium text-muted-foreground">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodData.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{p.label}</td>
                        <td className="py-2.5 text-right text-success">{formatCurrency(p.income)}</td>
                        <td className="py-2.5 text-right text-destructive">{formatCurrency(p.expense)}</td>
                        <td className={`py-2.5 text-right font-semibold ${p.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
