import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Chip({ selected, onClick, icon, children, className }: ChipProps) {
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
        selected
          ? 'bg-lavender-300 text-white ring-2 ring-lavender-200'
          : 'bg-lavender-50 text-lavender-600 hover:bg-lavender-100',
        onClick && 'cursor-pointer active:scale-[0.97]',
        className,
      )}
    >
      {icon}
      {children}
    </Component>
  );
}