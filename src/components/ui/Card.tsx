import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  variant?: 'surface' | 'dark' | 'outline';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className = '',
      hoverEffect = false,
      variant = 'surface',
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      surface: 'bg-white text-ink border border-steel-200/80 shadow-soft',
      dark: 'bg-ink text-white border border-steel-800 shadow-soft',
      outline: 'bg-transparent border border-steel-200 text-ink',
    };

    const hoverClass = hoverEffect
      ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated hover:border-steel-300'
      : '';

    return (
      <div
        ref={ref}
        className={`rounded-2xl p-5 sm:p-6 ${variants[variant]} ${hoverClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
