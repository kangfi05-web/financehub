import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

const schema = z
  .object({
    password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Link dari email Supabase memuat token di URL, yang otomatis diproses
    // oleh client (detectSessionInUrl: true) menjadi sesi "recovery".
    // Kita tunggu sebentar supaya proses itu selesai sebelum cek sesi.
    supabase.auth.getSession().then(({ data }) => {
      setSessionValid(!!data.session);
      setReady(true);
    });
  }, []);

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      const { error } = await updatePassword(data.password);
      if (error) {
        toast.error(error);
      } else {
        setDone(true);
        toast.success('Kata sandi berhasil diganti!');
      }
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <CardTitle>Atur Ulang Kata Sandi</CardTitle>
          {!done && <CardDescription>Masukkan kata sandi baru untuk akun admin kamu.</CardDescription>}
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-center text-sm text-muted-foreground">Memuat...</p>
          ) : done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
              <p className="text-sm text-muted-foreground">Kata sandi kamu sudah diganti.</p>
              <Button className="mt-4 w-full" onClick={() => navigate('/')}>
                Masuk Sekarang
              </Button>
            </div>
          ) : !sessionValid ? (
            <div className="text-center">
              <p className="text-sm text-destructive">
                Link ini sudah kedaluwarsa atau tidak valid. Minta link baru dari halaman Masuk.
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/auth')}>
                Kembali ke Halaman Masuk
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Kata Sandi Baru</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" {...register('confirmPassword')} />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
