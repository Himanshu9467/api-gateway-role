import type { OnboardingDocument } from "../../types/onboarding";
import { StatusBadge } from "../common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../common/EmptyState";

interface DocumentListProps {
  documents: OnboardingDocument[];
}

export const DocumentList = ({ documents }: DocumentListProps) => {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("onboarding.uploadedDocuments")}</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState message={t("onboarding.noUploadedFiles")} />
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{document.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {(document.fileSize / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {new Date(document.uploadedAt).toLocaleString()}
                  </p>
                  {document.rejectionReason ? (
                    <p className="text-xs text-red-600">{document.rejectionReason}</p>
                  ) : null}
                </div>
                <StatusBadge
                  status={
                    document.status === "uploaded"
                      ? "completed"
                      : document.status === "uploading"
                        ? "in_progress"
                        : "blocked"
                  }
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
