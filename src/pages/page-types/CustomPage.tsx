import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code } from "lucide-react";
import { PageCardHeader } from "@/components/page-header";

interface CustomPageProps {
  component?: string;
  data: any;
  title: string;
}

// This would be expanded to dynamically load custom components
const customComponents: Record<string, React.ComponentType<any>> = {
  // Add custom components here as they are developed
  // 'CustomReport': CustomReportComponent,
  // 'AdvancedChart': AdvancedChartComponent,
};

export const CustomPage = ({ component, data, title }: CustomPageProps) => {
  if (!component) {
    return (
      <Card>
        <PageCardHeader title={title} />
        <CardContent>
          <Alert>
            <Code className="h-4 w-4" />
            <AlertDescription>
              No custom component specified for this page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const CustomComponent = customComponents[component];

  if (!CustomComponent) {
    return (
      <Card>
        <PageCardHeader title={title} />
        <CardContent>
          <Alert>
            <Code className="h-4 w-4" />
            <AlertDescription>
              Custom component "{component}" not found. Available components: {Object.keys(customComponents).join(', ') || 'None'}
            </AlertDescription>
          </Alert>
          
          {data && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Component Data:</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <CustomComponent {...data} title={title} />
    </div>
  );
};