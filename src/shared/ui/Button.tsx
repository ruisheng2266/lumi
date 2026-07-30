import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'ghost' | 'danger' | 'coral';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-lavender-600 text-white hover:bg-lavender-500 disabled:bg-lavender-200 disabled:text-fog',
  ghost: 'bg-transparent text-ink hover:bg-lavender-50',
  danger: 'bg-danger text-white hover:brightness-95 disabled:opacity-50',
  coral: 'bg-coral-600 text-white hover:bg-coral-700 disabled:bg-coral-200 disabled:text-fog',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-5 py-3 text-base rounded-lg',
  lg: 'px-6 py-4 text-lg rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, leftIcon, rightIcon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});