import { useI18n } from "@/i18n";
import UserStatisticsCard from "@/components/admin/UserStatisticsCard";
import TariffStatisticsCard from "@/components/admin/TariffStatisticsCard";
import AddMissingMenuItems from "@/components/admin/AddMissingMenuItems";
import { useUserStatistics } from "@/hooks/useUserStatistics";
import { useTariffStatistics } from "@/hooks/useTariffStatistics";
import { useEffect, useState } from "react";
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { LayoutDashboard } from "lucide-react";

const AdminDashboardContent = () => {
  const { t } = useI18n();
  const { isLoading: usersLoading } = useUserStatistics();
  const { isLoading: tariffsLoading } = useTariffStatistics();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (!usersLoading && !tariffsLoading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [usersLoading, tariffsLoading, isInitialLoad]);

  if (isInitialLoad && (usersLoading || tariffsLoading)) {
    return <FullPageLoader title="Завантаження…" subtitle={t("sidebar_dashboard")} icon={LayoutDashboard} />;
  }
  
  return (
    <div className="p-3 sm:p-4 md:p-6" data-testid="admin-dashboard-content">
      <div className="mb-4 sm:mb-6" data-testid="dashboard-header">
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="dashboard-title">{t("sidebar_dashboard")}</h1>
        <p className="text-sm sm:text-base text-gray-600" data-testid="dashboard-description">{t("menu_dashboard")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6" data-testid="dashboard-widgets">
        <div className="sm:col-span-2 lg:col-span-2" data-testid="user-statistics-widget">
          <UserStatisticsCard />
        </div>
        <div className="sm:col-span-1 lg:col-span-1" data-testid="tariff-statistics-widget">
          <TariffStatisticsCard />
        </div>
        <div className="sm:col-span-1 lg:col-span-1" data-testid="missing-menu-items-widget">
          <AddMissingMenuItems />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardContent;
