import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Users2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface JoinForm {
  full_name: string;
  address: string;
  nik: string;
  phone: string;
  requested_group: string;
}

const EMPTY_FORM: JoinForm = { full_name: '', address: '', nik: '', phone: '', requested_group: '' };

export function JoinGroupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<JoinForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof JoinForm, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const submitMut = useMutation({
    mutationFn: async () => {
      // Generate id di sisi client supaya tidak perlu SELECT balik ke
      // database setelah insert (anon sengaja tidak diberi izin baca data
      // pendaftar orang lain — hanya admin yang login yang boleh).
      const requestId = crypto.randomUUID();
      const { error } = await supabase.from('group_join_requests').insert({
        id: requestId,
        full_name: form.full_name.trim(),
        address: form.address.trim(),
        nik: form.nik.trim(),
        phone: form.phone.trim(),
        requested_group: form.requested_group.trim() || null,
      });
      if (error) throw error;

      // Kirim notifikasi Telegram ke admin — kalau gagal, tidak menggagalkan
      // pendaftaran (data sudah aman tersimpan).
      try {
        await supabase.functions.invoke('notify-join-request', {
          body: { request_id: requestId },
        });
      } catch {
        // diamkan, tidak kritikal untuk UX pendaftar
      }
      return requestId;
    },
    onSuccess: () => setSubmitted(true),
  });

  function validate(): boolean {
    const e: Partial<Record<keyof JoinForm, string>> = {};
    if (form.full_name.trim().length < 3) e.full_name = 'Nama minimal 3 karakter';
    if (form.address.trim().length < 5) e.address = 'Alamat wajib diisi';
    if (!/^\d{16}$/.test(form.nik.trim())) e.nik = 'NIK harus 16 digit angka';
    if (!/^\d{9,15}$/.test(form.phone.trim().replace(/\D/g, ''))) e.phone = 'No HP tidak valid';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    submitMut.mutate();
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold">Pendaftaran Terkirim!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Data kamu sudah diterima admin. Kamu akan dihubungi lewat WhatsApp/telepon untuk diberikan PIN akses
              memantau grup.
            </p>
            <Button variant="outline" className="mt-5 w-full" onClick={() => navigate('/welcome')}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <button
            type="button"
            onClick={() => navigate('/welcome')}
            className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali
          </button>
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            <CardTitle>Daftar Join Grup</CardTitle>
          </div>
          <CardDescription>Isi data diri kamu untuk didaftarkan oleh admin sebagai anggota grup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Sesuai KTP"
              />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Alamat</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Alamat lengkap sesuai domisili"
                rows={2}
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nik">NIK</Label>
              <Input
                id="nik"
                inputMode="numeric"
                value={form.nik}
                onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, '') })}
                placeholder="16 digit sesuai KTP"
                maxLength={16}
              />
              {errors.nik && <p className="text-xs text-destructive">{errors.nik}</p>}
              <p className="text-xs text-muted-foreground">Data NIK hanya bisa dilihat admin, tidak dipublikasikan.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">No HP Aktif</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, '') })}
                placeholder="08xxxxxxxxxx"
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="requested_group">Grup yang Diminati (opsional)</Label>
              <Input
                id="requested_group"
                value={form.requested_group}
                onChange={(e) => setForm({ ...form, requested_group: e.target.value })}
                placeholder="Nama grup, kalau sudah tahu"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitMut.isPending}>
              {submitMut.isPending ? 'Mengirim...' : 'Daftar Join'}
            </Button>
            {submitMut.isError && (
              <p className="text-center text-xs text-destructive">Gagal mengirim, coba lagi.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
