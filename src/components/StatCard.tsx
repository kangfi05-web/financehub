import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  trendPositive?: boolean;
  accent?: 'primary' | 'success' | 'destructive' | 'warning' | 'info';
}

const accentClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, icon: Icon, trend, trendPositive, accent = 'primary', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md animate-slide-up',
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p
                className={cn(
                  'mt-1.5 text-xs font-medium',
                  trendPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
              accentClasses[accent]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }
);
StatCard.displayName = 'StatCard';
