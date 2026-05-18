import React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "warning" | "error" | "info" | "secondary";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const variantStyles = {
      primary: "bg-primary-100 text-primary-800 border border-primary-300",
      success: "bg-success-100 text-success-800 border border-success-300",
      warning: "bg-warning-100 text-warning-800 border border-warning-300",
      error: "bg-error-100 text-error-800 border border-error-300",
      info: "bg-info-100 text-info-800 border border-info-300",
      secondary: "bg-slate-100 text-slate-800 border border-slate-300",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "pending" | "in-progress" | "completed" | "failed";
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, children, ...props }, ref) => {
    const statusStyles = {
      pending: "bg-slate-100 text-slate-800 border border-slate-300",
      "in-progress": "bg-primary-100 text-primary-800 border border-primary-300 animate-pulse",
      completed: "bg-success-100 text-success-800 border border-success-300",
      failed: "bg-error-100 text-error-800 border border-error-300",
    };

    const statusLabel = {
      pending: "Pending",
      "in-progress": "In Progress",
      completed: "Completed",
      failed: "Failed",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
          statusStyles[status],
          className
        )}
        {...props}
      >
        {children || statusLabel[status]}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
