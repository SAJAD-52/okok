import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // 44px minimum touch targets on mobile for touch accessibility
    const baseStyles =
      'relative inline-flex items-center justify-center font-semibold select-none transition-all duration-150 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 whitespace-nowrap min-h-[44px] cursor-pointer';

    const variants = {
      primary:
        'bg-primary text-ink font-bold shadow-sm hover:bg-primary-hover hover:shadow focus-visible:ring-ink active:bg-[#D49500]',
      dark:
        'bg-ink text-white shadow-sm hover:bg-steel-800 border border-steel/20 active:bg-steel-900',
      outline:
        'bg-white text-ink border border-steel-300 hover:bg-steel-50 hover:border-steel-400 active:bg-steel-100',
      ghost:
        'bg-transparent text-steel-700 hover:bg-steel-100 hover:text-ink active:bg-steel-200',
      danger:
        'bg-danger text-white shadow-sm hover:bg-red-700 active:bg-red-800',
    };

    const sizes = {
      sm: 'px-3.5 py-1.5 text-xs gap-1.5 min-h-[44px]',
      md: 'px-5 py-2.5 text-sm gap-2 min-h-[44px]',
      lg: 'px-6 py-3.5 text-base gap-2.5 min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 me-1.5" aria-hidden="true" />
        )}
        {!isLoading && leftIcon && (
          <span className="shrink-0 me-1.5" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 ms-1.5" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
