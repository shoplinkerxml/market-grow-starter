import { useI18n } from "@/i18n";
import { useTariffStatistics } from "@/hooks/useTariffStatistics";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

const TariffStatisticsCard = () => {
  const { t } = useI18n();
  const { data: statistics, isLoading: loading, error } = useTariffStatistics();

  if (loading) {
    return (
      <Card className="p-4 sm:p-6 text-center">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <Skeleton className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg" />
          <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
        </div>
        <Skeleton className="h-8 sm:h-10 md:h-12 w-12 sm:w-16 mb-2 mx-auto" />
        <Skeleton className="h-3 sm:h-4 w-16 sm:w-20 mx-auto" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-destructive/20 bg-destructive/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-destructive font-medium">{t("error_fetch_tariffs") || "Error fetching tariffs"}</p>
            <p className="text-destructive/70 text-sm">{error.message || String(error)}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    /* Active Tariffs Block */
    <Card className="p-4 sm:p-6 text-center border">
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
          {t("active_tariffs") || "Active Tariffs"}
        </h3>
      </div>
      <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-1">
        {statistics?.activeTariffs || 0}
      </div>
     
    </Card>
  );
};

export default TariffStatisticsCard;
