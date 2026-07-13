import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const signInSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter'),
});

const signUpSchema = signInSchema.extend({
  full_name: z.string().min(2, 'Nama minimal 2 karakter'),
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignInForm & Partial<SignUpForm>>({
    resolver: zodResolver(mode === 'login' ? signInSchema : signUpSchema),
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(data.email, data.password);
        if (error) toast.error(error);
        else toast.success('Berhasil masuk!');
      } else {
        const { error } = await signUp(data.email, data.password, data.full_name!);
        if (error) toast.error(error);
        else toast.success('Akun berhasil dibuat! Selamat datang.');
      }
    } finally {
      setLoading(false);
    }
  });

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    reset();
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-emerald-700 p-12 text-primary-foreground lg:flex">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute right-10 bottom-40 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">FinanceHub Pro</h2>
            <p className="text-sm text-primary-foreground/80">Sistem Manajemen Keuangan</p>
          </div>
        </div>
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="mb-4 text-4xl font-bold leading-tight">
              Kelola keuangan bisnis<br />dengan cerdas & adil
            </h1>
            <p className="max-w-md text-primary-foreground/80">
              Catat pemasukan, pengeluaran, dan hitung profit secara otomatis — baik untuk
              bisnis pribadi maupun bisnis kelompok dengan pembagian proporsional.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <TrendingUp className="mb-2 h-6 w-6" />
              <p className="text-sm font-semibold">Profit Otomatis</p>
              <p className="text-xs text-primary-foreground/70">Hitung keuntungan & persentase</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <Users className="mb-2 h-6 w-6" />
              <p className="text-sm font-semibold">Bisnis Grup</p>
              <p className="text-xs text-primary-foreground/70">Pembagian modal proporsional</p>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-sm text-primary-foreground/60">
          &copy; 2026 FinanceHub Pro
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">FinanceHub Pro</h2>
              <p className="text-xs text-muted-foreground">Sistem Manajemen Keuangan</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'login' ? 'Selamat datang kembali' : 'Buat akun baru'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Masuk untuk mengelola keuangan Anda'
              : 'Daftar untuk mulai mengelola keuangan bisnis Anda'}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nama Lengkap</Label>
                <Input id="full_name" placeholder="John Doe" {...register('full_name')} />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="email@contoh.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Kata Sandi</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="font-semibold text-primary hover:underline"
            >
              {mode === 'login' ? 'Daftar di sini' : 'Masuk di sini'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
