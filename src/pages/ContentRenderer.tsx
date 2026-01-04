import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContentPage } from "./page-types/ContentPage";
import { FormPage } from "./page-types/FormPage";
import { DashboardPage } from "./page-types/DashboardPage";
import { ListPage } from "./page-types/ListPage";
import { CustomPage } from "./page-types/CustomPage";

interface MenuItemData {
  id: number;
  title: string;
  path: string;
  page_type: 'content' | 'form' | 'dashboard' | 'list' | 'custom';
  content_data?: any;
  template_name?: string;
  meta_data?: any;
  parent_id?: number | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

interface ContentRendererProps {
  menuItem: MenuItemData;
}

const DefaultContentPage = ({ title }: { title: string }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <Alert>
        <AlertDescription>
          This page type is not yet implemented. Please contact support for assistance.
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
);

export const ContentRenderer = ({ menuItem }: ContentRendererProps) => {
  try {
    switch (menuItem.page_type) {
      case 'content':
        return <ContentPage data={menuItem.content_data} title={menuItem.title} />;
      
      case 'form':
        return (
          <FormPage 
            template={menuItem.template_name} 
            data={menuItem.content_data}
            title={menuItem.title}
          />
        );
      
      case 'dashboard':
        return (
          <DashboardPage 
            widgets={menuItem.content_data?.widgets || []} 
            title={menuItem.title}
            data={menuItem.content_data}
          />
        );
      
      case 'list':
        return (
          <ListPage 
            config={menuItem.content_data} 
            title={menuItem.title}
          />
        );
      
      case 'custom':
        return (
          <CustomPage 
            component={menuItem.template_name} 
            data={menuItem.content_data}
            title={menuItem.title}
          />
        );
      
      default:
        console.warn(`Unknown page type: ${menuItem.page_type}`);
        return <DefaultContentPage title={menuItem.title} />;
    }
  } catch (error) {
    console.error('Page rendering error:', error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>{menuItem.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              This page is currently unavailable due to a rendering error. Please contact support.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
};