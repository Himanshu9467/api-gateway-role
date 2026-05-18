import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle } from "lucide-react";
import type { OnboardingStatus } from "../../types/dashboard";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

interface StatusBadgeProps {
  status: OnboardingStatus;
}

const statusMap: Record<OnboardingStatus, { classes: string; icon: ComponentType<{ className?: string }> }> = {
  pending: {
    classes: "border border-slate-300 bg-slate-100 text-slate-700",
    icon: Clock3,
  },
  in_progress: {
    classes: "border border-blue-200 bg-blue-50 text-blue-700",
    icon: LoaderCircle,
  },
  blocked: {
    classes: "border border-amber-200 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
  },
  completed: {
    classes: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { t } = useTranslation();
  const Icon = statusMap[status].icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide shadow-sm",
        statusMap[status].classes,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "in_progress" && "animate-spin")} />
      {t(`status.${status}`)}
    </span>
  );
};
