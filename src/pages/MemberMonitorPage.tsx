import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, TrendingUp, TrendingDown, Wallet, Users } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { computeGroupSummary, computeMemberSummary } from '@/lib/finance';
import { formatCurrency, formatPercentage, formatDate } from '@/lib/format';
import { getMemberColor, stableMemberOrder } from '@/lib/member-colors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/StatCard';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { EmptyState } from '@/components/EmptyState';
import type { GroupMember, GroupTransaction, MemberTransactionDetail } from '@/types';

const SESSION_KEY = 'financehub_monitor_pin';

interface MonitorPayload {
  success: boolean;
  error?: string;
  member_id: string;
  member_name: string;
  group: { id: string; name: string; description: string | null; show_leaderboard: boolean };
  members: GroupMember[];
  transactions: GroupTransaction[];
  details: MemberTransactionDetail[];
}

async function fetchMonitorData(pin: string): Promise<MonitorPayload> {
  const { data, error } = await supabase.rpc('verify_member_pin', { p_pin: pin });
  if (error) throw error;
  return data as MonitorPayload;
}

export function MemberMonitorPage() {
  const [pinInput, setPinInput] = useState('');
  const [activePin, setActivePin] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [formError, setFormError] = useState('');

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['member-monitor', activePin],
    queryFn: () => fetchMonitorData(activePin!),
    enabled: !!activePin,
    retry: false,
  });

  // Ticker khusus tampilan "X detik lalu" — TIDAK memengaruhi jadwal
  // polling react-query sama sekali, cuma dipakai untuk render ulang teks.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function secondsAgoLabel(updatedAt: number): string {
    if (!updatedAt) return '';
    const secs = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
    if (secs < 3) return 'baru saja';
    if (secs < 60) return `${secs} detik lalu`;
    const mins = Math.floor(secs / 60);
    return `${mins} menit lalu`;
  }

  useEffect(() => {
    if (data && !data.success) {
      sessionStorage.removeItem(SESSION_KEY);
      setActivePin(null);
      setFormError(data.error ?? 'PIN tidak valid');
    }
  }, [data]);

  // PENTING: useMemo ini harus dipanggil di sini (sebelum early return di
  // bawah), bukan setelahnya — supaya urutan pemanggilan hooks selalu
  // konsisten di setiap render, sesuai Rules of Hooks React. Kalau data
  // belum siap/gagal, kembalikan nilai kosong yang aman.
  const derived = useMemo(() => {
    if (!data || !data.success) {
      return {
        groupSummary: null,
        memberSummaries: [] as ReturnType<typeof computeMemberSummary>[],
        orderedMembers: [] as GroupMember[],
        myColorIndex: 0,
        myMemberSummary: undefined as ReturnType<typeof computeMemberSummary> | undefined,
        myTrendData: [] as { t: string; balance: number }[],
        capitalCompositionData: [] as { name: string; value: number; color: string }[],
      };
    }
    const { members, details, member_id } = data;
    const gs = computeGroupSummary(members, details);
    const summaries = members
      .map((m) => computeMemberSummary(m, details))
      .sort((a, b) => b.profit - a.profit);

    // Urutan anggota yang stabil, dipakai supaya warna tiap anggota konsisten
    // di avatar, sparkline, dan donut chart (tidak berubah-ubah antar render).
    const ordered = stableMemberOrder(members);
    const colorIndex = ordered.findIndex((m) => m.id === member_id);
    const mySummary = summaries.find((m) => m.id === member_id);

    // Mini grafik tren saldo pribadi (sparkline): riwayat balance_after
    // milik anggota ini sendiri, urut kronologis.
    const trend = [...details]
      .filter((d) => d.member_id === member_id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((d) => ({ t: d.created_at, balance: Number(d.balance_after) }));

    // Komposisi modal grup (donut chart): porsi modal tiap anggota.
    const capitalComposition = ordered.map((m, i) => ({
      name: m.name,
      value: Number(m.initial_capital),
      color: getMemberColor(i),
    }));

    return { groupSummary: gs, memberSummaries: summaries, orderedMembers: ordered, myColorIndex: colorIndex, myMemberSummary: mySummary, myTrendData: trend, capitalCompositionData: capitalComposition };
  }, [data]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = pinInput.trim();
    if (!/^[0-9]{4,8}$/.test(trimmed)) {
      setFormError('PIN harus 4-8 digit angka');
      return;
    }
    setFormError('');
    sessionStorage.setItem(SESSION_KEY, trimmed);
    setActivePin(trimmed);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setActivePin(null);
    setPinInput('');
  }

  if (!activePin || (data && !data.success)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle>Ruang Anggota FinanceHub</CardTitle>
            <CardDescription>Masukkan PIN yang diberikan admin grup untuk memantau keuangan grup.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pin">PIN Akses</Label>
                <Input
                  id="pin"
                  inputMode="numeric"
                  autoFocus
                  placeholder="******"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-widest"
                  maxLength={8}
                />
                {formError && <p className="text-xs text-destructive">{formError}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Memeriksa...' : 'Masuk'}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Ini bukan halaman login akun. Cuma untuk lihat data grup — hubungi admin grup kalau belum punya PIN.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Memuat data grup...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive">Gagal memuat data. Coba lagi nanti.</p>
            <Button variant="outline" className="mt-4" onClick={handleLogout}>Kembali</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { group, transactions, member_name } = data;

  const { groupSummary, memberSummaries, orderedMembers, myColorIndex, myMemberSummary, myTrendData, capitalCompositionData } = derived;

  if (!groupSummary) {
    // Tidak seharusnya kejadian (data.success sudah dipastikan true di titik
    // ini), tapi dijaga untuk keamanan tipe TypeScript.
    return null;
  }

  function colorFor(memberId: string): string {
    const idx = orderedMembers.findIndex((m) => m.id === memberId);
    return getMemberColor(idx < 0 ? 0 : idx);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Ruang Anggota - Halo, {member_name}</p>
            <h1 className="text-lg font-bold">{group.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-success opacity-75 ${isFetching ? 'animate-ping' : ''}`} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              {isFetching ? 'Memperbarui...' : `Update ${secondsAgoLabel(dataUpdatedAt)}`}
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {myMemberSummary && (
          <Card
            className="animate-slide-up overflow-hidden border-2"
            style={{ borderColor: getMemberColor(myColorIndex), animationFillMode: 'backwards' }}
          >
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                    style={{ backgroundColor: getMemberColor(myColorIndex) }}
                  >
                    {member_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Kamu Saat Ini</p>
                    <p className="text-2xl font-bold sm:text-3xl">
                      <AnimatedNumber value={myMemberSummary.currentBalance} formatter={formatCurrency} />
                    </p>
                    <p className={`text-sm font-medium ${myMemberSummary.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {myMemberSummary.profit >= 0 ? '+' : ''}
                      <AnimatedNumber value={myMemberSummary.profit} formatter={formatCurrency} />
                      {' '}({formatPercentage(myMemberSummary.profitPercentage)})
                    </p>
                  </div>
                </div>

                {myTrendData.length > 1 && (
                  <div className="h-14 w-full sm:w-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={myTrendData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={getMemberColor(myColorIndex)} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={getMemberColor(myColorIndex)} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={getMemberColor(myColorIndex)}
                          strokeWidth={2}
                          fill="url(#sparklineFill)"
                          isAnimationActive={false}
                        />
                        <Tooltip
                          formatter={(v: number) => formatCurrency(v)}
                          labelFormatter={() => ''}
                          contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard style={{ animationDelay: '0ms' }} label="Total Modal" value={<AnimatedNumber value={groupSummary.totalCapital} formatter={formatCurrency} />} icon={Wallet} accent="info" />
          <StatCard style={{ animationDelay: '80ms' }} label="Total Pengeluaran" value={<AnimatedNumber value={groupSummary.totalExpense} formatter={formatCurrency} />} icon={TrendingDown} accent="destructive" />
          <StatCard style={{ animationDelay: '160ms' }} label="Total Pemasukan" value={<AnimatedNumber value={groupSummary.totalIncome} formatter={formatCurrency} />} icon={TrendingUp} accent="success" />
          <StatCard style={{ animationDelay: '240ms' }} label="Profit Grup" value={<AnimatedNumber value={groupSummary.profit} formatter={formatCurrency} />} icon={TrendingUp} accent={groupSummary.profit >= 0 ? 'success' : 'destructive'} />
        </div>

        <Card className="animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Saldo Anggota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {memberSummaries.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex animate-slide-up items-center justify-between rounded-lg border px-3 py-2.5 ${m.name === member_name ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                  style={{ animationDelay: `${Math.min(i * 60, 420)}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: colorFor(m.id) }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{m.name}{m.name === member_name ? ' (kamu)' : ''}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold"><AnimatedNumber value={m.currentBalance} formatter={formatCurrency} /></p>
                    <p className={`text-xs ${m.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {m.profit >= 0 ? '+' : ''}<AnimatedNumber value={m.profit} formatter={formatCurrency} /> ({formatPercentage(m.profitPercentage)})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {capitalCompositionData.length > 1 && (
          <Card className="animate-slide-up" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
            <CardHeader>
              <CardTitle className="text-base">Komposisi Modal Grup</CardTitle>
              <CardDescription>Porsi modal tiap anggota terhadap total modal grup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-56 w-full sm:w-56 sm:shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={capitalCompositionData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={2}
                        isAnimationActive
                      >
                        {capitalCompositionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1.5">
                  {capitalCompositionData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                      </span>
                      <span className="font-medium text-muted-foreground">
                        {groupSummary.totalCapital > 0 ? formatPercentage((entry.value / groupSummary.totalCapital) * 100) : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {group.show_leaderboard && (
          <Card className="animate-slide-up" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
            <CardHeader>
              <CardTitle className="text-base">Papan Peringkat</CardTitle>
              <CardDescription>Diurutkan berdasarkan profit tertinggi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {memberSummaries.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex animate-slide-up items-center justify-between rounded-lg border border-border px-3 py-2.5"
                    style={{ animationDelay: `${Math.min(i * 60, 420)}ms`, animationFillMode: 'backwards' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-500/20 text-yellow-600' : i === 1 ? 'bg-slate-400/20 text-slate-500' : i === 2 ? 'bg-orange-500/20 text-orange-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                    <p className={`text-sm font-bold ${m.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {m.profit >= 0 ? '+' : ''}<AnimatedNumber value={m.profit} formatter={formatCurrency} />
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="animate-slide-up" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Transaksi Grup</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <EmptyState icon={<Wallet className="h-6 w-6" />} title="Belum ada transaksi" description="Riwayat akan muncul di sini." />
            ) : (
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...transactions]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((tx) => (
                        <TableRow key={tx.id}>
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
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Mode lihat-saja - data ini otomatis diperbarui berkala.
        </p>
      </main>
    </div>
  );
}
