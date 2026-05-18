import { CheckCircle2, Circle, CircleAlert, CircleDashed } from "lucide-react";
import type { WorkflowStep } from "../../types/onboarding";
import { cn } from "../../lib/utils";

interface WorkflowStepperProps {
  steps: WorkflowStep[];
}

const iconClassName = "h-4 w-4";

export const WorkflowStepper = ({ steps }: WorkflowStepperProps) => (
  <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    {steps.map((step) => {
      const icon =
        step.status === "completed" ? (
          <CheckCircle2 className={cn(iconClassName, "text-emerald-600")} />
        ) : step.status === "current" ? (
          <Circle className={cn(iconClassName, "fill-blue-600 text-blue-600")} />
        ) : step.status === "blocked" ? (
          <CircleAlert className={cn(iconClassName, "text-amber-600")} />
        ) : (
          <CircleDashed className={cn(iconClassName, "text-slate-400")} />
        );

      return (
        <li key={step.key} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-2">
            {icon}
            <p className="text-sm font-medium text-slate-900">{step.label}</p>
          </div>
          <p className="text-xs text-slate-500">{step.description}</p>
        </li>
      );
    })}
  </ol>
);
