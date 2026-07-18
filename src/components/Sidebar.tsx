import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  User,
  Users,
  Wallet,
  FileBarChart,
  History,
  Settings,
  ArrowLeftRight,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/personal', label: 'Keuangan Pribadi', icon: User },
  { to: '/group', label: 'Keuangan Grup', icon: Users },
  { to: '/balance', label: 'Manajemen Saldo', icon: ArrowLeftRight },
  { to: '/reports', label: 'Laporan', icon: FileBarChart },
  { to: '/history', label: 'Riwayat Transaksi', icon: History },
  { to: '/join-requests', label: 'Permintaan Bergabung', icon: UserPlus },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: pendingJoinCount = 0 } = useQuery({
    queryKey: ['group_join_requests', 'pending_count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('group_join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? 'U';

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/join-requests' && pendingJoinCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {pendingJoinCount}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const BrandLogo = () => (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
        <Wallet className="h-5 w-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold leading-tight">FinanceHub</span>
        <span className="text-xs font-medium text-primary">Pro</span>
      </div>
    </div>
  );

  const UserFooter = () => (
    <div className="mt-auto border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.full_name || 'Pengguna'}</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <BrandLogo />
        <NavLinks />
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold">FinanceHub Pro</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between pr-4">
                  <BrandLogo />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <NavLinks onNavigate={() => setOpen(false)} />
                <UserFooter />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Desktop top bar */}
      <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-md lg:flex">
        <h1 className="text-lg font-semibold">
          {navItems.find((n) => n.to === location.pathname)?.label ?? 'Dashboard'}
        </h1>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
      </header>
    </>
  );
}
