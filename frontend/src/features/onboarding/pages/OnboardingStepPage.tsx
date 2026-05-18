import { Link, Navigate, useParams } from "react-router-dom";
import { ChatbotPanel } from "../../../components/chatbot/ChatbotPanel";
import { DocumentList } from "../../../components/onboarding/DocumentList";
import { DocumentUploadCard } from "../../../components/onboarding/DocumentUploadCard";
import { DocumentUploadProgress } from "../../../components/onboarding/DocumentUploadProgress";
import { OnboardingStepContent } from "../../../components/onboarding/OnboardingStepContent";
import { ValidationAlert } from "../../../components/onboarding/ValidationAlert";
import { ProgressCard } from "../../../components/onboarding/ProgressCard";
import { WorkflowStepper } from "../../../components/onboarding/WorkflowStepper";
import {
  useOnboardingDocumentsQuery,
  useOnboardingProgressQuery,
  useUploadOnboardingDocumentMutation,
} from "../hooks/useOnboardingQueries";
import {
  workflowStepContent,
  workflowStepOrder,
} from "../constants/workflowSteps";
import type { WorkflowStepKey } from "../../../types/onboarding";
import { useOnboardingStore } from "../../../store/onboarding.store";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";

const isWorkflowStepKey = (value: string): value is WorkflowStepKey =>
  workflowStepOrder.includes(value as WorkflowStepKey);

export default function OnboardingStepPage() {
  const { t } = useTranslation();
  const { clientId = "", stepKey = "" } = useParams();
  const validStepKey = isWorkflowStepKey(stepKey);
  const activeStepKey: WorkflowStepKey = validStepKey ? stepKey : "identity";
  const setSelectedClient = useOnboardingStore((state) => state.setSelectedClient);
  const setActiveStep = useOnboardingStore((state) => state.setActiveStep);
  const validationError = useOnboardingStore((state) => state.validationError);
  const { data, isLoading, isError } = useOnboardingProgressQuery(clientId);
  const documentsQuery = useOnboardingDocumentsQuery(clientId, activeStepKey);
  const uploadDocumentMutation = useUploadOnboardingDocumentMutation();

  useEffect(() => {
    setSelectedClient(clientId || null);
  }, [clientId, setSelectedClient]);

  useEffect(() => {
    if (validStepKey) {
      setActiveStep(stepKey);
    } else {
      setActiveStep(null);
    }
  }, [setActiveStep, stepKey, validStepKey]);

  if (!validStepKey) {
    return <Navigate to={`/onboarding/${clientId}`} replace />;
  }

  if (isLoading) {
    return <LoadingState label={t("onboarding.loadingStep")} />;
  }

  if (isError || !data) {
    return <ErrorState title={t("onboarding.stepError")} onRetry={() => window.location.reload()} />;
  }

  const stepIndex = workflowStepOrder.indexOf(stepKey);
  const previousStep = stepIndex > 0 ? workflowStepOrder[stepIndex - 1] : null;
  const nextStep = stepIndex < workflowStepOrder.length - 1 ? workflowStepOrder[stepIndex + 1] : null;
  const content = workflowStepContent[stepKey];

  return (
    <div className="space-y-6">
      <ProgressCard progress={data} />
      <WorkflowStepper steps={data.steps} />
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2">
          <OnboardingStepContent
            title={t(content.titleKey)}
            description={t(content.descriptionKey)}
            checklist={content.checklistKeys.map((key) => t(key))}
          />
          {validationError ? <ValidationAlert message={validationError} /> : null}
          <DocumentUploadCard
            acceptedMimeTypes={[
              "application/pdf",
              "image/png",
              "image/jpeg",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ]}
            maxFileSizeInMB={10}
            onFileSelect={(file) => {
              uploadDocumentMutation.mutate({
                clientId,
                stepKey,
                file,
              });
            }}
          />
          <DocumentUploadProgress />
          {documentsQuery.isLoading ? (
            <LoadingState label={t("onboarding.loadingDocuments")} />
          ) : documentsQuery.isError ? (
            <ErrorState title={t("onboarding.documentError")} />
          ) : (
            <DocumentList documents={documentsQuery.data || []} />
          )}
        </section>
        <aside className="space-y-4">
          <ChatbotPanel clientId={clientId} stepKey={stepKey} />
        </aside>
      </div>
      <div className="flex flex-wrap gap-3">
        {previousStep ? (
          <Link
            to={`/onboarding/${clientId}/step/${previousStep}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {t("onboarding.previousStep")}
          </Link>
        ) : null}
        {nextStep ? (
          <Link
            to={`/onboarding/${clientId}/step/${nextStep}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {t("onboarding.nextStep")}
          </Link>
        ) : (
          <Link
            to={`/onboarding/${clientId}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            {t("onboarding.completeReview")}
          </Link>
        )}
      </div>
    </div>
  );
}
