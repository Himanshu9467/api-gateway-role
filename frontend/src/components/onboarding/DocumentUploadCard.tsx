import { UploadCloud } from "lucide-react";
import { useState, type DragEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useOnboardingStore } from "../../store/onboarding.store";
import { useTranslation } from "react-i18next";

interface DocumentUploadCardProps {
  onFileSelect: (file: File) => void;
  acceptedMimeTypes: string[];
  maxFileSizeInMB: number;
}

export const DocumentUploadCard = ({
  onFileSelect,
  acceptedMimeTypes,
  maxFileSizeInMB,
}: DocumentUploadCardProps) => {
  const { t } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const setValidationError = useOnboardingStore((state) => state.setValidationError);

  const validateFile = (file: File) => {
    const maxFileSizeInBytes = maxFileSizeInMB * 1024 * 1024;
    if (!acceptedMimeTypes.includes(file.type)) {
      setValidationError(t("onboarding.unsupportedFormat"));
      return false;
    }
    if (file.size > maxFileSizeInBytes) {
      setValidationError(t("onboarding.fileTooLarge", { size: maxFileSizeInMB }));
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (validateFile(file)) onFileSelect(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("onboarding.uploadTitle")}</CardTitle>
        <CardDescription>{t("onboarding.uploadDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
          }`}
        >
          <UploadCloud className="mx-auto mb-3 h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-600">{t("onboarding.uploadHint")}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t("onboarding.uploadMeta", { size: maxFileSizeInMB })}
          </p>
          <input
            type="file"
            className="mt-4 text-sm"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>
      </CardContent>
    </Card>
  );
};
