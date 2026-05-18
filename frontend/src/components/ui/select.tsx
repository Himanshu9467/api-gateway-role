import React from "react";
import { cn } from "../../lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-900 mb-2">
            {label}
            {props.required && <span className="text-error-600 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full px-4 py-2 rounded-md border border-slate-300 text-slate-900 bg-white",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 focus:border-primary-500",
            "transition-colors duration-200",
            "disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed",
            error && "border-error-500 focus:ring-error-500 focus:border-error-500",
            className
          )}
          {...props}
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs font-medium text-error-600 mt-1">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-slate-500 mt-1">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
