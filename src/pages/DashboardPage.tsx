import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Users,
  User,
  Store,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useDashboardData } from '@/hooks/use-dashboard';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { computePersonalSummary, computeGroupSummary } from '@/lib/finance';
import { formatCurrency, formatPercentage, formatDate, formatDateTime, todayISO } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export function DashboardPage() {
  const data = useDashboardData();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const personalSummary = useMemo(() => {
    let totalCapital = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    for (const biz of data.personalBusiness) {
      const bizTx = data.personalTransactions.filter((t) => t.business_id === biz.id);
      const s = computePersonalSummary(Number(biz.initial_capital), bizTx);
      totalCapital += s.initialCapital;
      totalIncome += s.totalIncome;
      totalExpense += s.totalExpense;
    }

    const currentBalance = totalCapital + totalIncome - totalExpense;
    const profit = totalIncome - totalExpense;
    const profitPercentage = totalCapital > 0 ? (profit / totalCapital) * 100 : 0;

    return { totalCapital, totalIncome, totalExpense, currentBalance, profit, profitPercentage };
  }, [data.personalBusiness, data.personalTransactions]);

  const groupSummary = useMemo(() => {
    return computeGroupSummary(data.groupMembers, data.memberDetails);
  }, [data.groupMembers, data.memberDetails]);

  const personalChart = useMemo(() => {
    const byMonth: Record<string, { month: string; income: number; expense: number; profit: number }> = {};
    const addToMonth = (dateStr: string, income: number, expense: number) => {
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      if (!byMonth[key]) byMonth[key] = { month: label, income: 0, expense: 0, profit: 0 };
      byMonth[key].income += income;
      byMonth[key].expense += expense;
      byMonth[key].profit += income - expense;
    };
    for (const t of data.personalTransactions) {
      if (t.type === 'income') addToMonth(t.transaction_date, Number(t.nominal), 0);
      else addToMonth(t.transaction_date, 0, Number(t.nominal));
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v);
  }, [data.personalTransactions]);

  const groupChart = useMemo(() => {
    const byMonth: Record<string, { month: string; income: number; expense: number; profit: number }> = {};
    const addToMonth = (dateStr: string, income: number, expense: number) => {
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      if (!byMonth[key]) byMonth[key] = { month: label, income: 0, expense: 0, profit: 0 };
      byMonth[key].income += income;
      byMonth[key].expense += expense;
      byMonth[key].profit += income - expense;
    };
    for (const t of data.groupTransactions) {
      const income = t.type === 'income' ? Number(t.nominal) : 0;
      const expense = t.type === 'expense' ? Number(t.nominal) : 0;
      addToMonth(t.transaction_date, income, expense);
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => v);
  }, [data.groupTransactions]);

  const recentActivity = useMemo(() => {
    const personal = data.personalTransactions.slice(0, 5).map((t) => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type,
      description: t.description || t.category,
      nominal: Number(t.nominal),
      scope: 'Pribadi' as const,
    }));
    const group = data.groupTransactions.slice(0, 5).map((t) => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type,
      description: t.description || t.category,
      nominal: Number(t.nominal),
      scope: 'Grup' as const,
    }));
    return [...personal, ...group]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [data.personalTransactions, data.groupTransactions]);

  const hasData =
    data.personalBusiness.length > 0 ||
    data.groups.length > 0 ||
    data.personalTransactions.length > 0 ||
    data.groupTransactions.length > 0;

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold tracking-tight">Ringkasan Keuangan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gambaran umum keuangan bisnis pribadi dan grup Anda
        </p>
      </div>

      {!hasData ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Selamat datang di FinanceHub Pro"
          description="Mulai dengan membuat bisnis pribadi atau grup bisnis untuk mengelola keuangan Anda."
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/personal"><User className="mr-1.5 h-4 w-4" /> Buat Bisnis Pribadi</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/group"><Users className="mr-1.5 h-4 w-4" /> Buat Grup Bisnis</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Personal Finance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                <Store className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold">Keuangan Pribadi</h3>
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link to="/personal">Lihat Detail</Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total Modal" value={formatCurrency(personalSummary.totalCapital)} icon={Wallet} accent="info" />
              <StatCard label="Pengeluaran" value={formatCurrency(personalSummary.totalExpense)} icon={TrendingDown} accent="destructive" />
              <StatCard label="Pemasukan" value={formatCurrency(personalSummary.totalIncome)} icon={TrendingUp} accent="success" />
              <StatCard label="Saldo Saat Ini" value={formatCurrency(personalSummary.currentBalance)} icon={DollarSign} accent="primary" />
              <StatCard label="Profit" value={formatCurrency(personalSummary.profit)} icon={Activity} accent={personalSummary.profit >= 0 ? 'success' : 'destructive'} />
              <StatCard
                label="Persentase"
                value={formatPercentage(personalSummary.profitPercentage)}
                icon={Percent}
                accent={personalSummary.profitPercentage >= 0 ? 'success' : 'destructive'}
              />
            </div>

            {personalChart.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="animate-slide-up">
                  <CardHeader>
                    <CardTitle className="text-base">Pemasukan & Pengeluaran Pribadi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={personalChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="pExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Area type="monotone" dataKey="income" name="Pemasukan" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#pIncomeGrad)" />
                        <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#pExpenseGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="animate-slide-up">
                  <CardHeader>
                    <CardTitle className="text-base">Profit Pribadi Bulanan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={personalChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]}>
                          {personalChart.map((entry, i) => (
                            <Cell key={i} fill={entry.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Balance Management Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold">Manajemen Saldo</h3>
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link to="/balance">Lihat Detail</Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Modal Masuk" value={formatCurrency(data.capitalAdditions.reduce((s, c) => s + Number(c.nominal), 0))} icon={ArrowDownToLine} accent="success" />
              <StatCard label="Penarikan Hari Ini" value={formatCurrency(data.withdrawals.filter((w) => w.transaction_date === todayISO()).reduce((s, w) => s + Number(w.withdrawal_amount), 0))} icon={ArrowUpFromLine} accent="destructive" />
              <StatCard label="Potongan Hari Ini" value={formatCurrency(data.withdrawals.filter((w) => w.transaction_date === todayISO()).reduce((s, w) => s + Number(w.fee_amount), 0))} icon={Percent} accent="warning" />
              <StatCard label="Potongan Bulan Ini" value={formatCurrency(data.withdrawals.filter((w) => w.transaction_date.startsWith(todayISO().slice(0, 7))).reduce((s, w) => s + Number(w.fee_amount), 0))} icon={Percent} accent="warning" />
              <StatCard label="Dana Bersih Diterima" value={formatCurrency(data.withdrawals.reduce((s, w) => s + Number(w.net_received), 0))} icon={Wallet} accent="info" />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Group Finance Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold">Keuangan Grup</h3>
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link to="/group">Lihat Detail</Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total Modal" value={formatCurrency(groupSummary.totalCapital)} icon={Wallet} accent="info" />
              <StatCard label="Pengeluaran" value={formatCurrency(groupSummary.totalExpense)} icon={TrendingDown} accent="destructive" />
              <StatCard label="Pemasukan" value={formatCurrency(groupSummary.totalIncome)} icon={TrendingUp} accent="success" />
              <StatCard label="Saldo Grup" value={formatCurrency(groupSummary.groupBalance)} icon={DollarSign} accent="primary" />
              <StatCard label="Profit Grup" value={formatCurrency(groupSummary.profit)} icon={Activity} accent={groupSummary.profit >= 0 ? 'success' : 'destructive'} />
              <StatCard
                label="Persentase"
                value={formatPercentage(groupSummary.profitPercentage)}
                icon={Percent}
                accent={groupSummary.profitPercentage >= 0 ? 'success' : 'destructive'}
              />
            </div>

            {groupChart.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="animate-slide-up">
                  <CardHeader>
                    <CardTitle className="text-base">Pemasukan & Pengeluaran Grup</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={groupChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Area type="monotone" dataKey="income" name="Pemasukan" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gIncomeGrad)" />
                        <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gExpenseGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="animate-slide-up">
                  <CardHeader>
                    <CardTitle className="text-base">Profit Grup Bulanan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={groupChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]}>
                          {groupChart.map((entry, i) => (
                            <Cell key={i} fill={entry.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle className="text-base">Aktivitas Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-1">
                  {recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          act.type === 'income' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {act.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{act.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(act.date)} • {act.scope}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold ${act.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {act.type === 'income' ? '+' : '-'}
                        {formatCurrency(act.nominal)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Activity className="h-6 w-6" />}
                  title="Belum ada aktivitas"
                  description="Mulai catat transaksi untuk melihat aktivitas terbaru di sini."
                  action={
                    <div className="flex gap-2">
                      <Button asChild size="sm">
                        <Link to="/personal"><User className="mr-1.5 h-4 w-4" /> Keuangan Pribadi</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/group"><Users className="mr-1.5 h-4 w-4" /> Keuangan Grup</Link>
                      </Button>
                    </div>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Audit log preview */}
          {data.auditLogs.length > 0 && (
            <Card className="animate-slide-up">
              <CardHeader>
                <CardTitle className="text-base">Log Audit Terbaru</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {data.auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {log.action}
                        </span>
                        <span>{log.entity}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
