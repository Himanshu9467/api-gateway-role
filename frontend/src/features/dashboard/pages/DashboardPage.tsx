import { useMemo, useState } from "react";
import { ArrowDownUp, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ActivityTimeline } from "../../../components/dashboard/ActivityTimeline";
import { ClientSummaryCard } from "../../../components/dashboard/ClientSummaryCard";
import { DashboardSummaryCards } from "../../../components/dashboard/DashboardSummaryCards";
import { NewClientModal } from "../../../components/dashboard/NewClientModal";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { Skeleton, SkeletonCard } from "../../../components/ui/skeleton";
import {
  useDashboardActivityQuery,
  useDashboardClientsQuery,
  useCreateClientMutation,
  useDashboardSummaryQuery,
} from "../hooks/useDashboardQueries";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { CreateClientFormValues } from "../createClient.schema";
import type { ClientSummary, OnboardingStatus } from "../../../types/dashboard";

const statusSortOrder: Record<OnboardingStatus, number> = {
  blocked: 0,
  in_progress: 1,
  pending: 2,
  completed: 3,
};

type ClientSort = "updated" | "progress" | "status";

type StatusFilter = "all" | OnboardingStatus;

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<ClientSort>("updated");

  const summaryQuery = useDashboardSummaryQuery();
  const clientsQuery = useDashboardClientsQuery();
  const activityQuery = useDashboardActivityQuery();
  const createClientMutation = useCreateClientMutation();

  const isLoading = summaryQuery.isLoading || clientsQuery.isLoading || activityQuery.isLoading;
  const hasError = summaryQuery.isError || clientsQuery.isError || activityQuery.isError;

  const handleCreateClient = async (values: CreateClientFormValues) => {
    const createdClient = await createClientMutation.mutateAsync(values);
    setIsNewClientModalOpen(false);
    navigate(`/clients/${createdClient.id}`, {
      state: { createdClientName: createdClient.name },
    });
  };

  const filteredClients = useMemo(() => {
    if (!clientsQuery.data) return [];

    const normalizedQuery = query.trim().toLowerCase();

    return [...clientsQuery.data]
      .filter((client) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          client.name.toLowerCase().includes(normalizedQuery) ||
          client.contactEmail.toLowerCase().includes(normalizedQuery) ||
          client.contactPerson.toLowerCase().includes(normalizedQuery);

        const matchesStatus = statusFilter === "all" || client.status === statusFilter;

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => sortClients(a, b, sortBy));
  }, [clientsQuery.data, query, sortBy, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} className="h-[160px]" />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={`client-${index}`} className="h-[250px]" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-6 w-40" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={`activity-${index}`} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasError || !summaryQuery.data || !clientsQuery.data || !activityQuery.data) {
    return (
      <ErrorState
        title={t("dashboard.loadErrorTitle")}
        description={t("dashboard.loadErrorDescription")}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardSummaryCards summary={summaryQuery.data} />

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.clients")}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("dashboard.showingResults", {
                    count: filteredClients.length,
                    total: clientsQuery.data.length,
                    defaultValue: "Showing {{count}} of {{total}} clients",
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  {t("common.refresh")}
                </Button>
                <Button onClick={() => setIsNewClientModalOpen(true)}>{t("dashboard.newClient")}</Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative sm:col-span-2 lg:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder={t("dashboard.searchPlaceholder", { defaultValue: "Search by company, contact, or email" })}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 lg:col-span-3"
              >
                <option value="all">{t("dashboard.allStatuses", { defaultValue: "All statuses" })}</option>
                <option value="pending">{t("status.pending")}</option>
                <option value="in_progress">{t("status.in_progress")}</option>
                <option value="blocked">{t("status.blocked")}</option>
                <option value="completed">{t("status.completed")}</option>
              </select>

              <div className="relative lg:col-span-3">
                <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as ClientSort)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="updated">{t("dashboard.sortUpdated", { defaultValue: "Sort by last updated" })}</option>
                  <option value="progress">{t("dashboard.sortProgress", { defaultValue: "Sort by progress" })}</option>
                  <option value="status">{t("dashboard.sortStatus", { defaultValue: "Sort by status" })}</option>
                </select>
              </div>

              <Button
                variant="ghost"
                className="lg:col-span-1"
                onClick={() => {
                  setQuery("");
                  setSortBy("updated");
                  setStatusFilter("all");
                }}
              >
                {t("dashboard.clearFilters", { defaultValue: "Clear" })}
              </Button>
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <EmptyState
              title={t("dashboard.clients")}
              message={
                clientsQuery.data.length === 0
                  ? t("states.noData")
                  : t("dashboard.noFilterResults", { defaultValue: "No clients match the current filters." })
              }
              action={
                <Button onClick={() => setIsNewClientModalOpen(true)}>{t("dashboard.newClient")}</Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredClients.map((client) => (
                <ClientSummaryCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </section>

        <ActivityTimeline items={activityQuery.data} />
      </div>

      <NewClientModal
        open={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        onSubmit={handleCreateClient}
        isSubmitting={createClientMutation.isPending}
        errorMessage={createClientMutation.error ? (createClientMutation.error as Error).message : undefined}
      />
    </div>
  );
}

function sortClients(a: ClientSummary, b: ClientSummary, sortBy: ClientSort) {
  if (sortBy === "progress") {
    return b.progressPercent - a.progressPercent;
  }

  if (sortBy === "status") {
    return statusSortOrder[a.status] - statusSortOrder[b.status];
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
