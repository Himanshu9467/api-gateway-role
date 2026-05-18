import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, CircleDashed, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { DashboardSummary } from "../../types/dashboard";
import { useTranslation } from "react-i18next";

interface DashboardSummaryCardsProps {
  summary: DashboardSummary;
}

export const DashboardSummaryCards = ({ summary }: DashboardSummaryCardsProps) => {
  const { t } = useTranslation();
  const total = summary.totalClients || 1;

  const items = [
    {
      label: t("dashboard.totalClients"),
      value: summary.totalClients,
      tone: "text-blue-700 bg-blue-50 border-blue-100",
      icon: Users,
      trend: t("dashboard.growthTrend", { value: Math.round((summary.inProgressOnboarding / total) * 100), defaultValue: "{{value}}% active" }),
    },
    {
      label: t("dashboard.completed"),
      value: summary.completedOnboarding,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
      icon: CheckCircle2,
      trend: t("dashboard.growthTrend", { value: Math.round((summary.completedOnboarding / total) * 100), defaultValue: "{{value}}% active" }),
    },
    {
      label: t("dashboard.inProgress"),
      value: summary.inProgressOnboarding,
      tone: "text-indigo-700 bg-indigo-50 border-indigo-100",
      icon: CircleDashed,
      trend: t("dashboard.growthTrend", { value: Math.round((summary.inProgressOnboarding / total) * 100), defaultValue: "{{value}}% active" }),
    },
    {
      label: t("dashboard.blocked"),
      value: summary.blockedOnboarding,
      tone: "text-amber-700 bg-amber-50 border-amber-100",
      icon: AlertTriangle,
      trend: t("dashboard.growthTrend", { value: Math.round((summary.blockedOnboarding / total) * 100), defaultValue: "{{value}}% active" }),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.04 }}
            whileHover={{ y: -3 }}
          >
            <Card className="h-full border-slate-200 transition-shadow duration-200 hover:shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm font-medium text-slate-600">{item.label}</CardTitle>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">{item.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
