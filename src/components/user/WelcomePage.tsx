import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PageCardHeader } from "@/components/page-header";

interface WelcomePageProps {
  title: string;
  description: string;
  onEdit: () => void;
}

export const WelcomePage = ({ title, description, onEdit }: WelcomePageProps) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-2xl">
        <PageCardHeader 
          title={`Welcome to ${title}`}
        />
        <CardContent className="text-center space-y-6">
          <div className="space-y-4">
            <p className="text-lg text-muted-foreground">
              {description || "This is a new page that you can customize."}
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
              <h3 className="font-semibold text-emerald-800 mb-2">Getting Started</h3>
              <p className="text-sm text-emerald-700">
                This page is ready for you to add content. You can edit this page to add text, images, forms, and more.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button onClick={onEdit} size="lg">
              Edit Page Content
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};