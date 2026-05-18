import { BarChart3, LogOut } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/auth.store";
import { isDemoModeEnabled } from "../config/runtime";

export default function DashboardLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("layout.platformName")}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h1 className="truncate text-lg font-semibold text-slate-900">{t("layout.dashboard")}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {isDemoModeEnabled ? (
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {t("common.demoMode")}
              </span>
            ) : null}
            <LanguageSwitcher />
            <p className="hidden max-w-[220px] truncate rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 md:block">{user?.email}</p>
            <Button variant="outline" className="gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {t("layout.logout")}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
