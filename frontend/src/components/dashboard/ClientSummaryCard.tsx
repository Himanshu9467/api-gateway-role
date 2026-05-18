import { motion } from "framer-motion";
import { Building2, CalendarClock, ChevronRight, EllipsisVertical, Mail, UserCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import type { ClientSummary } from "../../types/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { StatusBadge } from "../common/StatusBadge";
import { useTranslation } from "react-i18next";

interface ClientSummaryCardProps {
  client: ClientSummary;
}

const statusProgressTone: Record<ClientSummary["status"], string> = {
  pending: "bg-slate-500",
  in_progress: "bg-blue-600",
  blocked: "bg-amber-500",
  completed: "bg-emerald-600",
};

const statusCardHighlight: Record<ClientSummary["status"], string> = {
  pending: "hover:border-slate-300",
  in_progress: "hover:border-blue-300",
  blocked: "hover:border-amber-300",
  completed: "hover:border-emerald-300",
};

export const ClientSummaryCard = ({ client }: ClientSummaryCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const updatedAt = new Date(client.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.18 }} className="h-full">
      <Card
        className={`relative h-full cursor-pointer border-slate-200 transition-all duration-200 hover:shadow-lg ${statusCardHighlight[client.status]}`}
        onClick={() => navigate(`/clients/${client.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigate(`/clients/${client.id}`);
          }
        }}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate text-lg font-semibold">{client.name}</CardTitle>
                <CardDescription className="mt-1 truncate text-sm text-slate-500">
                  {client.jurisdiction} · {client.serviceTier}
                </CardDescription>
              </div>
            </div>

            <div className="relative">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsActionsOpen((prev) => !prev);
                }}
                aria-label={t("dashboard.quickActions", { defaultValue: "Quick actions" })}
              >
                <EllipsisVertical className="h-4 w-4" />
              </button>

              {isActionsOpen ? (
                <div
                  className="absolute right-0 top-9 z-20 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Link
                    to={`/clients/${client.id}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    {t("dashboard.viewClient")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/onboarding/${client.id}`}
                    className="mt-1 flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    {t("dashboard.continue")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge status={client.status} />
            <p className="text-sm font-medium text-slate-500">{t("client.progressComplete", { value: client.progressPercent })}</p>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className={`h-full rounded-full ${statusProgressTone[client.status]}`}
              initial={{ width: 0 }}
              animate={{ width: `${client.progressPercent}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>

          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <p className="inline-flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5 text-slate-500" />
              {client.contactPerson}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-500" />
              <span className="truncate">{client.contactEmail}</span>
            </p>
            <p className="inline-flex items-center gap-1.5 sm:col-span-2">
              <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
              {t("dashboard.updatedLabel", { date: updatedAt, defaultValue: "Updated {{date}}" })}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1" onClick={(event) => event.stopPropagation()}>
            <Link
              to={`/clients/${client.id}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-blue-700/20 bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
            >
              {t("dashboard.viewClient")}
            </Link>
            <Link
              to={`/onboarding/${client.id}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md"
            >
              {t("dashboard.continue")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
