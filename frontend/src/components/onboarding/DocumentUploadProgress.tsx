import { useOnboardingStore } from "../../store/onboarding.store";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useTranslation } from "react-i18next";

export const DocumentUploadProgress = () => {
  const { t } = useTranslation();
  const uploadProgress = useOnboardingStore((state) => state.uploadProgress);

  if (!uploadProgress) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("onboarding.uploading", { fileName: uploadProgress.fileName })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2 w-full rounded bg-slate-200">
          <div
            className="h-full rounded bg-blue-600 transition-all"
            style={{ width: `${uploadProgress.progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">{uploadProgress.progressPercent}%</p>
      </CardContent>
    </Card>
  );
};
