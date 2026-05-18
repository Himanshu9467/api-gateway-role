import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { StatusBadge } from "../../../components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { useClientDetailQuery } from "../../onboarding/hooks/useOnboardingQueries";
import { useOnboardingStore } from "../../../store/onboarding.store";
import { useEffect } from "react";

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { clientId = "" } = useParams();
  const setSelectedClient = useOnboardingStore((state) => state.setSelectedClient);
  const { data, isLoading, isError } = useClientDetailQuery(clientId);
  const createdClientName = (location.state as { createdClientName?: string } | null)?.createdClientName;

  useEffect(() => {
    setSelectedClient(clientId || null);
  }, [clientId, setSelectedClient]);

  if (isLoading) {
    return <LoadingState label={t("client.loading")} />;
  }

  if (isError || !data) {
    return <ErrorState title={t("client.loadError")} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      {createdClientName ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t("client.createdSuccess", { name: createdClientName })}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-xl">{data.name}</CardTitle>
          <StatusBadge status={data.status} />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <p className="text-xs text-slate-500">{t("client.contactPerson")}</p>
            <p className="text-sm font-medium text-slate-900">{data.contactPerson}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("client.contactEmail")}</p>
            <p className="text-sm font-medium text-slate-900">{data.contactEmail}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("client.jurisdiction")}</p>
            <p className="text-sm font-medium text-slate-900">{data.jurisdiction}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("client.serviceTier")}</p>
            <p className="text-sm font-medium text-slate-900">{data.serviceTier}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("client.clientType")}</p>
            <p className="text-sm font-medium text-slate-900">{data.clientType}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t("client.progress")}</p>
            <p className="text-sm font-medium text-slate-900">
              {t("client.progressComplete", { value: data.progressPercent })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="h-2 w-full rounded bg-slate-200">
        <div className="h-full rounded bg-blue-600" style={{ width: `${data.progressPercent}%` }} />
      </div>

      <Link
        to={`/onboarding/${data.id}`}
        className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        {t("client.openWorkflow")}
      </Link>
    </div>
  );
}
