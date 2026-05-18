import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LoadingStateProps {
  label?: string;
}

export const LoadingState = ({ label }: LoadingStateProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label || t("common.loading")}</span>
    </div>
  );
};
