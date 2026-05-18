import React from "react";
import { cn } from "../../lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "success" | "warning" | "error";
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

const sizeStyles = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

const variantStyles = {
  primary: "bg-primary-600",
  success: "bg-success-600",
  warning: "bg-warning-600",
  error: "bg-error-600",
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = "md",
      variant = "primary",
      label,
      showPercentage = false,
      animated = false,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min((value / max) * 100, 100);

    return (
      <div ref={ref} className="w-full" {...props}>
        {(label || showPercentage) && (
          <div className="flex justify-between items-center mb-2">
            {label && <p className="text-sm font-medium text-slate-900">{label}</p>}
            {showPercentage && (
              <p className="text-sm font-medium text-slate-600">{Math.round(percentage)}%</p>
            )}
          </div>
        )}
        <div
          className={cn(
            "w-full bg-slate-200 rounded-full overflow-hidden",
            sizeStyles[size],
            className
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              variantStyles[variant],
              animated && "animate-pulse"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = "Progress";
