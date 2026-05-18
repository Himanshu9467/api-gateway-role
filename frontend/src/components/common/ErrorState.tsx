import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorState = ({ title, description, onRetry }: ErrorStateProps) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-red-700">
        <AlertTriangle className="h-4 w-4" />
        <p className="font-medium">{title}</p>
      </div>
      {description ? <p className="mb-3 text-sm text-red-700">{description}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
        >
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
};
