import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { Bot, CircleDashed, FileUp, NotebookPen } from "lucide-react";
import type { ActivityItem } from "../../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../common/EmptyState";

interface ActivityTimelineProps {
  items: ActivityItem[];
}

const activityStyleMap: Record<ActivityItem["type"], { icon: ComponentType<{ className?: string }>; classes: string }> = {
  upload: { icon: FileUp, classes: "bg-blue-50 text-blue-700 border-blue-100" },
  status_change: { icon: CircleDashed, classes: "bg-amber-50 text-amber-700 border-amber-100" },
  ai_suggestion: { icon: Bot, classes: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  note: { icon: NotebookPen, classes: "bg-slate-100 text-slate-700 border-slate-200" },
};

export const ActivityTimeline = ({ items }: ActivityTimelineProps) => {
  const { t } = useTranslation();

  return (
    <Card className="h-fit border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{t("dashboard.recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.length === 0 ? (
            <EmptyState
              message={t("dashboard.noRecentActivity")}
              title={t("dashboard.recentActivity", { defaultValue: "Recent Activity" })}
            />
          ) : (
            items.map((item, index) => {
              const style = activityStyleMap[item.type];
              const Icon = style.icon;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="relative pl-11"
                >
                  <span className="absolute left-[15px] top-0 h-full w-px bg-slate-200" />
                  <span className={`absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${style.classes}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    <p className="mt-2 text-xs font-medium text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
