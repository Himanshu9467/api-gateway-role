import React from "react";
import { cn } from "../../lib/utils";

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={radioId}
          type="radio"
          className={cn(
            "w-5 h-5 rounded-full border-2 border-slate-300 text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors cursor-pointer",
            "disabled:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300",
            className
          )}
          {...props}
        />
        {label && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor={radioId}
              className="text-sm font-medium text-slate-900 cursor-pointer select-none"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-slate-500">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Radio.displayName = "Radio";
