import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      label,
      error,
      hint,
      startIcon,
      endIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5 text-start">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-bold text-steel-700 tracking-wide select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute start-3.5 flex items-center pointer-events-none text-steel-400">
              {startIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full min-h-[44px] bg-white border rounded-xl text-sm text-ink placeholder:text-steel-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:bg-steel-50 disabled:text-steel-400 ${
              startIcon ? 'ps-10' : 'ps-3.5'
            } ${endIcon ? 'pe-10' : 'pe-3.5'} py-2.5 ${
              error
                ? 'border-danger focus-visible:ring-danger'
                : 'border-steel-300 hover:border-steel-400'
            } ${className}`}
            {...props}
          />
          {endIcon && (
            <div className="absolute end-3.5 flex items-center pointer-events-none text-steel-400">
              {endIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs font-medium text-danger mt-0.5">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-steel-500 mt-0.5">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
