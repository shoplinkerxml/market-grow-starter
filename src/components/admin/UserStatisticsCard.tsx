import { useI18n } from "@/i18n";
import { useUserStatistics } from "@/hooks/useUserStatistics";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Activity } from "lucide-react";
import { ReactNode } from "react";

const UserStatisticsCard = () => {
  const { t } = useI18n();
  const { data: statistics, isLoading: loading, error } = useUserStatistics();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        <Card className="p-4 sm:p-6 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg" />
            <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
          </div>
          <Skeleton className="h-8 sm:h-10 md:h-12 w-12 sm:w-16 mb-2 mx-auto" />
          <Skeleton className="h-3 sm:h-4 w-16 sm:w-20 mx-auto" />
        </Card>
        <Card className="p-4 sm:p-6 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg" />
            <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
          </div>
          <Skeleton className="h-8 sm:h-10 md:h-12 w-12 sm:w-16 mb-2 mx-auto" />
          <Skeleton className="h-3 sm:h-4 w-16 sm:w-20 mx-auto" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-destructive/20 bg-destructive/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-destructive font-medium">{t("error_fetch_users")}</p>
            <p className="text-destructive/70 text-sm">{error.message || String(error)}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6" data-testid="userStatistics_container">
      {/* Total Users Block */}
      <Card className="p-4 sm:p-6 text-center border" data-testid="userStatistics_totalUsers_card">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <h3 className="text-xs sm:text-sm font-medium text-muted-foreground" data-testid="userStatistics_totalUsers_title">
            {t("total_users")}
          </h3>
        </div>
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-1" data-testid="userStatistics_totalUsers_count">
          {statistics?.totalUsers || 0}
        </div>
        
      </Card>

      {/* Active Users Block */}
      <Card className="p-4 sm:p-6 text-center border" data-testid="userStatistics_activeUsers_card">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <h3 className="text-xs sm:text-sm font-medium text-muted-foreground" data-testid="userStatistics_activeUsers_title">
            {t("active_users")}
          </h3>
        </div>
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-1" data-testid="userStatistics_activeUsers_count">
          {statistics?.activeUsers || 0}
        </div>
        
      </Card>
    </div>
  );
};

export default UserStatisticsCard;
