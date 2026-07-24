import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // a11y
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition active:scale-[0.95]',
        size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
        'text-ink hover:bg-lavender-50 disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});