import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  message: string;
  title?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const EmptyState = ({ message, title, action, icon, className }: EmptyStateProps) => (
  <div className={cn("rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center", className)}>
    <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
      {icon ?? <Inbox className="h-4 w-4" />}
    </div>
    {title ? <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p> : null}
    <p className="mt-1 text-sm text-slate-600">{message}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);
