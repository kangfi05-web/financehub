import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users2, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">FinanceHub</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pilih cara kamu mengakses aplikasi ini</p>
        </div>

        <Card
          className="animate-slide-up cursor-pointer transition-colors hover:border-primary/50"
          onClick={() => navigate('/auth')}
        >
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Saya Admin</p>
              <p className="text-xs text-muted-foreground">Kelola keuangan pribadi & grup — login akun kamu</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="animate-slide-up cursor-pointer transition-colors hover:border-primary/50"
          style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
          onClick={() => navigate('/join')}
        >
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <Users2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Join Grup</p>
              <p className="text-xs text-muted-foreground">Daftar untuk bergabung sebagai anggota grup investasi</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Sudah punya PIN dari admin? <a href="/monitor" className="font-medium text-primary underline">Buka Ruang Anggota</a>
        </p>
      </div>
    </div>
  );
}
