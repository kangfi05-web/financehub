import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Phone, MapPin, IdCard, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import type { GroupJoinRequest, JoinRequestStatus } from '@/types';

const STATUS_LABEL: Record<JoinRequestStatus, string> = {
  pending: 'Baru',
  contacted: 'Sudah Dihubungi',
  approved: 'Diterima',
  rejected: 'Ditolak',
};

const STATUS_COLOR: Record<JoinRequestStatus, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  contacted: 'bg-info/10 text-info border-info/30',
  approved: 'bg-success/10 text-success border-success/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function JoinRequestsPage() {
  const qc = useQueryClient();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['group_join_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_join_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GroupJoinRequest[];
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JoinRequestStatus }) => {
      const { error } = await supabase.from('group_join_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group_join_requests'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('group_join_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Permintaan dihapus');
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ['group_join_requests'] });
    },
    onError: (err) => toast.error(err.message),
  });

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Permintaan Bergabung</h1>
        <p className="text-sm text-muted-foreground">
          Daftar calon anggota yang mendaftar lewat halaman Join Grup publik.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="Belum ada permintaan"
          description="Kalau ada yang mendaftar lewat halaman Join Grup, akan muncul di sini dan kamu dapat notifikasi Telegram."
        />
      ) : (
        <div className="space-y-3">
          {pendingCount > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-warning">{pendingCount}</span> permintaan baru belum ditindaklanjuti
            </p>
          )}
          {requests.map((r) => {
            const revealed = revealedIds.has(r.id);
            return (
              <Card key={r.id} className="animate-slide-up">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{r.full_name}</p>
                        <Badge variant="outline" className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setConfirmDeleteId(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {r.phone}
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {r.address}
                    </p>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IdCard className="h-3.5 w-3.5" />
                      <span className="font-mono">{revealed ? r.nik : '•'.repeat(16)}</span>
                      <button type="button" onClick={() => toggleReveal(r.id)} className="text-primary">
                        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {r.requested_group && (
                      <p className="text-muted-foreground">
                        Minat grup: <span className="font-medium text-foreground">{r.requested_group}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== 'contacted' && (
                      <Button variant="outline" size="sm" onClick={() => updateStatusMut.mutate({ id: r.id, status: 'contacted' })}>
                        Tandai Sudah Dihubungi
                      </Button>
                    )}
                    {r.status !== 'approved' && (
                      <Button variant="outline" size="sm" className="text-success" onClick={() => updateStatusMut.mutate({ id: r.id, status: 'approved' })}>
                        Tandai Diterima
                      </Button>
                    )}
                    {r.status !== 'rejected' && (
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => updateStatusMut.mutate({ id: r.id, status: 'rejected' })}>
                        Tolak
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Langkah selanjutnya setelah "Diterima"</CardTitle>
          <CardDescription>
            Tambahkan orang ini sebagai anggota di grup yang sesuai (Keuangan Grup → Tambah Anggota), lalu generate
            PIN akses monitoring lewat ikon kunci di kartu anggota. Bagikan PIN itu ke mereka via WhatsApp/telepon.
          </CardDescription>
        </CardHeader>
      </Card>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Hapus Permintaan?"
        description="Data pendaftaran ini akan dihapus permanen."
        confirmText="Hapus"
        destructive
        onConfirm={() => confirmDeleteId && deleteMut.mutate(confirmDeleteId)}
      />
    </div>
  );
}
