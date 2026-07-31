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
    default: 'bg-surface rounded-lg shadow-card p-4',
    flat: 'bg-surface rounded-lg p-4',
    outlined: 'bg-surface rounded-lg p-4 ring-1 ring-border',
  }[variant];

  return (
    <Tag ref={ref as never} className={cn(base, className)} {...rest}>
      {children}
    </Tag>
  );
});

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  // 作为页面内各区块标题，层级为 h2（页面主标题为 h1），避免跳过 h2 触发 heading-order 违规
  return <h2 className={cn('text-sm font-medium text-fog mb-2', className)}>{children}</h2>;
}