import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs, usePageInfo } from "@/hooks/useBreadcrumbs";
import { useI18n } from "@/i18n";

const FormValidation = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={pageInfo.title}
        description={pageInfo.description}
        breadcrumbItems={breadcrumbs}
      />
      
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="text-muted-foreground">{t("form_validation_description")}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormValidation;
