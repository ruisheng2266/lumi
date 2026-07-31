/**
 * src/shared/ui/Select.tsx
 * 自定义下拉选择组件（替代原生 select 样式差）
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  flag?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition',
          'hover:bg-lavender-50 focus:outline-none focus:ring-2 focus:ring-lavender-300',
          open && 'ring-2 ring-lavender-300',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selected?.flag && <span className="text-xl shrink-0">{selected.flag}</span>}
          <div className="min-w-0">
            <div className="font-medium truncate">{selected?.label || placeholder || '—'}</div>
            {selected?.hint && <div className="text-xs text-fog truncate">{selected.hint}</div>}
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn('text-fog shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-border bg-surface shadow-soft py-1"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition',
                'hover:bg-lavender-50',
                opt.value === value && 'bg-lavender-50',
              )}
            >
              {opt.flag && <span className="text-xl shrink-0">{opt.flag}</span>}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{opt.label}</div>
                {opt.hint && <div className="text-xs text-fog truncate">{opt.hint}</div>}
              </div>
              {opt.value === value && <Check size={16} className="text-lavender-500 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}