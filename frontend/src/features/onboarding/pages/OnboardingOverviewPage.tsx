import { Link, useParams } from "react-router-dom";
import { ProgressCard } from "../../../components/onboarding/ProgressCard";
import { WorkflowStepper } from "../../../components/onboarding/WorkflowStepper";
import { useOnboardingProgressQuery } from "../hooks/useOnboardingQueries";
import { useOnboardingStore } from "../../../store/onboarding.store";
import { useEffect } from "react";
import { workflowStepOrder } from "../constants/workflowSteps";
import { useTranslation } from "react-i18next";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

export default function OnboardingOverviewPage() {
  const { t } = useTranslation();
  const { clientId = "" } = useParams();
  const setSelectedClient = useOnboardingStore((state) => state.setSelectedClient);
  const setActiveStep = useOnboardingStore((state) => state.setActiveStep);
  const { data, isLoading, isError } = useOnboardingProgressQuery(clientId);

  useEffect(() => {
    setSelectedClient(clientId || null);
  }, [clientId, setSelectedClient]);

  useEffect(() => {
    if (data?.currentStep) {
      setActiveStep(data.currentStep);
    }
  }, [data?.currentStep, setActiveStep]);

  if (isLoading) {
    return <LoadingState label={t("onboarding.loadingWorkflow")} />;
  }

  if (isError || !data) {
    return <ErrorState title={t("onboarding.workflowError")} onRetry={() => window.location.reload()} />;
  }

  const currentStepIndex = workflowStepOrder.findIndex((step) => step === data.currentStep);
  const nextStep = workflowStepOrder[Math.max(0, currentStepIndex)];

  return (
    <div className="space-y-6">
      <ProgressCard progress={data} />
      <WorkflowStepper steps={data.steps} />
      <div className="flex flex-wrap gap-3">
        <Link
          to={`/onboarding/${clientId}/step/${nextStep}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {t("onboarding.continueStep")}
        </Link>
        <Link
          to={`/clients/${clientId}`}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {t("onboarding.backToClient")}
        </Link>
      </div>
    </div>
  );
}
