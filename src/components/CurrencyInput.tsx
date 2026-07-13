import { forwardRef, useState, useEffect } from 'react';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onValueChange: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, placeholder, ...props }, ref) => {
    const [display, setDisplay] = useState('');

    useEffect(() => {
      if (value > 0) {
        setDisplay(formatCurrencyInput(value));
      } else {
        setDisplay('');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const numeric = parseCurrencyInput(e.target.value);
      onValueChange(numeric);
      setDisplay(numeric > 0 ? formatCurrencyInput(numeric) : '');
    };

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
          Rp
        </span>
        <input
          ref={ref}
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder ?? '0'}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent py-1 pl-9 pr-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';
