import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth, className, ...props }, ref) => {
    return (
      <div className={clsx('flex flex-col', { 'w-full': fullWidth })}>
        {label && (
          <label className="text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            'px-4 py-2 border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'transition-colors duration-200',
            {
              'border-gray-300': !error,
              'border-error': error,
              'w-full': fullWidth,
            },
            className
          )}
          {...props}
        />
        {error && <span className="text-sm text-error mt-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

