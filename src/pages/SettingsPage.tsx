import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Moon, Sun, Bell, User, Database, Upload, Download, Trash2, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { logAudit } from '@/lib/audit';
import { exportToCSV } from '@/lib/export';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { formatDate } from '@/lib/format';
import { APP_VERSION, CHANGELOG } from '@/lib/version';
import { InstallAppButton } from '@/components/InstallAppBanner';

export function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [notifications, setNotifications] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const settingsQ = useQuery({
    queryKey: ['settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (settingsQ.data) {
      setNotifications(settingsQ.data.notifications_enabled);
      if (settingsQ.data.theme) setTheme(settingsQ.data.theme);
    }
  }, [settingsQ.data, setTheme]);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile]);

  const updateProfileMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', user!.id);
      if (error) throw error;
      await logAudit('update', 'profiles', user!.id, { full_name: fullName });
    },
    onSuccess: () => {
      toast.success('Profil berhasil diperbarui');
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: () => toast.error('Gagal memperbarui profil'),
  });

  const updateSettingsMut = useMutation({
    mutationFn: async (updates: { theme?: string; notifications_enabled?: boolean }) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ user_id: user!.id, ...updates }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
    onError: () => toast.error('Gagal menyimpan pengaturan'),
  });

  function handleThemeChange(newTheme: 'light' | 'dark') {
    setTheme(newTheme);
    updateSettingsMut.mutate({ theme: newTheme });
  }

  function handleNotifChange(val: boolean) {
    setNotifications(val);
    updateSettingsMut.mutate({ notifications_enabled: val });
  }

  // Backup: export all data
  const backupMut = useMutation({
    mutationFn: async () => {
      const tables = ['personal_business', 'personal_transactions', 'groups', 'group_members', 'group_transactions', 'member_transaction_details', 'reports', 'audit_logs'];
      const backup: Record<string, unknown[]> = {};
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*').eq('user_id', user!.id);
        backup[table] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financehub-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await logAudit('backup', 'database', undefined, { tables });
    },
    onSuccess: () => toast.success('Backup database berhasil diunduh'),
    onError: () => toast.error('Gagal membuat backup'),
  });

  // Export audit logs
  function handleExportAudit() {
    exportToCSV('audit-logs', [
      { header: 'Aksi', key: 'action' },
      { header: 'Entitas', key: 'entity' },
      { header: 'ID Entitas', key: 'entity_id' },
      { header: 'Detail', key: 'details' },
      { header: 'Waktu', key: 'created_at' },
    ], auditLogsData);
    toast.success('Audit log berhasil diexport');
  }

  const auditLogsQ = useQuery({
    queryKey: ['audit_logs_all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  const auditLogsData = auditLogsQ.data ?? [];

  // Delete all data
  const deleteAllMut = useMutation({
    mutationFn: async () => {
      const tables = ['personal_transactions', 'personal_business', 'member_transaction_details', 'group_transactions', 'group_members', 'groups', 'reports', 'audit_logs'];
      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', user!.id);
        if (error) throw error;
      }
      await logAudit('delete_all', 'database');
    },
    onSuccess: () => {
      toast.success('Semua data berhasil dihapus');
      setShowDeleteConfirm(false);
      qc.invalidateQueries();
    },
    onError: () => toast.error('Gagal menghapus data'),
  });

  // CSV import
  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) { toast.error('File CSV kosong atau tidak valid'); return; }
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          return headers.reduce((obj, h, i) => { obj[h] = values[i]; return obj; }, {} as Record<string, string>);
        });
        // Import as personal transactions for the first business (or create one)
        let bizId: string | null = null;
        const { data: existingBiz } = await supabase.from('personal_business').select('id').eq('user_id', user!.id).limit(1).maybeSingle();
        if (existingBiz) bizId = existingBiz.id;
        else {
          const { data: newBiz } = await supabase.from('personal_business').insert({ user_id: user!.id, name: 'Imported Business', business_type: 'Lainnya', initial_capital: 0 }).select().single();
          bizId = newBiz?.id ?? null;
        }
        if (!bizId) { toast.error('Gagal membuat bisnis untuk import'); return; }
        let imported = 0;
        for (const row of rows) {
          const type = (row['Jenis'] || row['type'] || '').toLowerCase().includes('pengeluaran') ? 'expense' : 'income';
          const nominal = parseFloat((row['Nominal'] || '0').replace(/[^\d]/g, '')) || 0;
          if (nominal <= 0) continue;
          await supabase.from('personal_transactions').insert({
            user_id: user!.id,
            business_id: bizId,
            transaction_no: `IMP-${Date.now()}-${imported}`,
            transaction_date: row['Tanggal'] || new Date().toISOString().split('T')[0],
            type,
            category: row['Kategori'] || (type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
            description: row['Keterangan'] || null,
            nominal,
            balance_before: 0,
            balance_after: 0,
          });
          imported++;
        }
        await logAudit('import', 'personal_transactions', undefined, { count: imported });
        toast.success(`${imported} transaksi berhasil diimport`);
        qc.invalidateQueries();
      } catch {
        toast.error('Gagal mengimport file CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold tracking-tight">Pengaturan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Kelola profil, preferensi, dan data Anda</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Profil</CardTitle>
          <CardDescription>Informasi akun Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullname">Nama Lengkap</Label>
            <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" />
          </div>
          <Button onClick={() => updateProfileMut.mutate()} disabled={updateProfileMut.isPending}>
            Simpan Profil
          </Button>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><SettingsIcon className="h-4 w-4" /> Tampilan</CardTitle>
          <CardDescription>Sesuaikan tampilan aplikasi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-xs text-muted-foreground">Pilih mode terang atau gelap</p>
            </div>
            <div className="flex gap-2">
              <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('light')}>
                <Sun className="mr-1.5 h-3.5 w-3.5" /> Terang
              </Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => handleThemeChange('dark')}>
                <Moon className="mr-1.5 h-3.5 w-3.5" /> Gelap
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Notifikasi</p>
                <p className="text-xs text-muted-foreground">Tampilkan notifikasi sukses/gagal</p>
              </div>
            </div>
            <Switch checked={notifications} onCheckedChange={handleNotifChange} />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Manajemen Data</CardTitle>
          <CardDescription>Backup, import, dan kelola data Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Backup Database</p>
              <p className="text-xs text-muted-foreground">Unduh semua data dalam format JSON</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => backupMut.mutate()} disabled={backupMut.isPending}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Backup
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <p className="text-sm font-medium">Import Data CSV</p>
              <p className="text-xs text-muted-foreground">Import transaksi dari file CSV</p>
            </div>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV</span>
              </Button>
              <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            </label>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <p className="text-sm font-medium text-destructive">Hapus Semua Data</p>
              <p className="text-xs text-muted-foreground">Hapus seluruh data keuangan Anda permanen</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Semua
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Log Audit</CardTitle>
              <CardDescription>Riwayat perubahan data terbaru</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportAudit}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {auditLogsData.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada log audit</p>
          ) : (
            <div className="space-y-1">
              {auditLogsData.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{log.action}</span>
                    <span>{log.entity}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(log.created_at, 'dd MMM yyyy, HH:mm')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Install as app */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Install Aplikasi</CardTitle>
          <CardDescription>Pasang FinanceHub di HP atau laptop kamu, akses langsung tanpa buka browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstallAppButton />
        </CardContent>
      </Card>

      {/* App version & changelog */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Tentang Aplikasi</CardTitle>
              <CardDescription>Versi saat ini dan riwayat perbaikan/update</CardDescription>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              v{APP_VERSION}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="border-l-2 border-border pl-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">v{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {entry.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="p-4">
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Keluar dari Akun
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Hapus Semua Data?"
        description="SEMUA data keuangan Anda (bisnis pribadi, grup, anggota, transaksi) akan dihapus permanen. Tindakan ini TIDAK DAPAT dibatalkan."
        confirmText="Hapus Semua"
        destructive
        onConfirm={() => deleteAllMut.mutate()}
      />
    </div>
  );
}
