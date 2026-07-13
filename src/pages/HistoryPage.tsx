import { useState, useMemo } from 'react';
import { History, Search, FileDown, Sheet, FileText, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type ScopeFilter = 'all' | 'personal' | 'group';
type TypeFilter = 'all' | 'income' | 'expense';

export function HistoryPage() {
  const data = useDashboardData();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const allTransactions = useMemo(() => {
    const personal = data.personalTransactions.map((t) => {
      const biz = data.personalBusiness.find((b) => b.id === t.business_id);
      return {
        id: t.id,
        no: t.transaction_no,
        date: t.transaction_date,
        type: t.type,
        category: t.category,
        description: t.description,
        nominal: Number(t.nominal),
        balance: Number(t.balance_after),
        scope: 'personal' as const,
        scopeLabel: biz?.name ?? 'Pribadi',
      };
    });
    const group = data.groupTransactions.map((t) => {
      const grp = data.groups.find((g) => g.id === t.group_id);
      return {
        id: t.id,
        no: t.transaction_no,
        date: t.transaction_date,
        type: t.type,
        category: t.category,
        description: t.description,
        nominal: Number(t.nominal),
        balance: null as number | null,
        scope: 'group' as const,
        scopeLabel: grp?.name ?? 'Grup',
      };
    });
    return [...personal, ...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  const filtered = useMemo(() => {
    let result = allTransactions;
    if (scopeFilter !== 'all') result = result.filter((t) => t.scope === scopeFilter);
    if (typeFilter !== 'all') result = result.filter((t) => t.type === typeFilter);
    if (dateFrom) result = result.filter((t) => t.date >= dateFrom);
    if (dateTo) result = result.filter((t) => t.date <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          t.no.toLowerCase().includes(q) ||
          t.scopeLabel.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allTransactions, scopeFilter, typeFilter, dateFrom, dateTo, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleExport(format: 'csv' | 'excel' | 'pdf') {
    const columns = [
      { header: 'No. Transaksi', key: 'no' },
      { header: 'Tanggal', key: 'date_fmt' },
      { header: 'Jenis', key: 'type' },
      { header: 'Kategori', key: 'category' },
      { header: 'Keterangan', key: 'description' },
      { header: 'Nominal', key: 'nominal_fmt' },
      { header: 'Lingkup', key: 'scopeLabel' },
    ];
    const rows = filtered.map((t) => ({
      no: t.no,
      date_fmt: formatDate(t.date),
      type: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      category: t.category,
      description: t.description ?? '-',
      nominal_fmt: formatCurrency(t.nominal),
      scopeLabel: t.scopeLabel,
    }));
    const fname = `riwayat-transaksi-${todayISO()}`;
    if (format === 'csv') exportToCSV(fname, columns, rows);
    else if (format === 'excel') exportToExcel(fname, columns, rows);
    else exportToPDF(fname, 'Riwayat Transaksi', columns, rows);
    toast.success(`Data berhasil diexport ke ${format.toUpperCase()}`);
  }

  function resetFilters() {
    setScopeFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold tracking-tight">Riwayat Transaksi</h2>
        <p className="mt-1 text-sm text-muted-foreground">Semua transaksi pribadi dan grup dalam satu daftar</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari transaksi..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8" />
            </div>
            <Select value={scopeFilter} onValueChange={(v) => { setScopeFilter(v as ScopeFilter); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[160px]"><Filter className="mr-1.5 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lingkup</SelectItem>
                <SelectItem value="personal">Pribadi</SelectItem>
                <SelectItem value="group">Grup</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as TypeFilter); setPage(1); }}>
              <SelectTrigger className="w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
                <SelectItem value="expense">Pengeluaran</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full lg:w-[150px]" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full lg:w-[150px]" />
            <Button variant="outline" size="sm" onClick={resetFilters}>Reset Filter</Button>
            <div className="flex gap-1 lg:ml-auto">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><FileDown className="mr-1 h-3.5 w-3.5" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Sheet className="mr-1 h-3.5 w-3.5" /> Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><FileText className="mr-1 h-3.5 w-3.5" /> PDF</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filtered.length} Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="Tidak ada transaksi"
              description="Belum ada transaksi yang cocok dengan filter Anda."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Lingkup</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                      {scopeFilter !== 'group' && <TableHead className="text-right">Saldo</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((tx) => (
                      <TableRow key={`${tx.scope}-${tx.id}`} className="group">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{tx.no}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {tx.type === 'income' ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                            )}
                            <span className={`text-xs font-medium ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                              {tx.type === 'income' ? 'Masuk' : 'Keluar'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.scope === 'personal' ? 'secondary' : 'outline'} className="text-xs">
                            {tx.scopeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tx.category}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{tx.description || '-'}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.nominal)}
                        </TableCell>
                        {scopeFilter !== 'group' && (
                          <TableCell className="text-right text-sm font-medium">
                            {tx.balance !== null ? formatCurrency(tx.balance) : '-'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Halaman {page} dari {totalPages} • {filtered.length} transaksi
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Sebelumnya
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
