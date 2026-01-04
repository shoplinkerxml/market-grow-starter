import { Card, CardContent } from "@/components/ui/card";
import { PageCardHeader } from "@/components/page-header";

interface ContentPageProps {
  data: any;
  title: string;
}

export const ContentPage = ({ data, title }: ContentPageProps) => {
  const htmlContent = data?.html_content || `<div class="prose max-w-none"><h2>Welcome to ${title}</h2><p>This is a placeholder content page. Configure the content through the admin interface.</p></div>`;

  return (
    <Card>
      <PageCardHeader title={title} />
      <CardContent>
        <div 
          className="prose max-w-none dark:prose-invert" 
          dangerouslySetInnerHTML={{ __html: htmlContent }} 
        />
      </CardContent>
    </Card>
  );
};