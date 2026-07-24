import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'outlined';
  as?: 'div' | 'section' | 'article';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', as = 'div', className, children, ...rest },
  ref,
) {
  const Tag = as;
  const base = {
    default: 'bg-white rounded-lg shadow-card p-4',
    flat: 'bg-lavender-50 rounded-lg p-4',
    outlined: 'bg-white rounded-lg p-4 ring-1 ring-lavender-100',
  }[variant];

  return (
    <Tag ref={ref as never} className={cn(base, className)} {...rest}>
      {children}
    </Tag>
  );
});

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-medium text-fog mb-2', className)}>{children}</h3>;
}