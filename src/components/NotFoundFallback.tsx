import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, ArrowLeft, Search } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { PageCardHeader } from "@/components/page-header";

interface NotFoundFallbackProps {
  title?: string;
  description?: string;
  suggestions?: string[];
}

export const NotFoundFallback = ({ 
  title = "Page Not Found", 
  description,
  suggestions 
}: NotFoundFallbackProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const defaultDescription = `The page "${location.pathname}" could not be found. This might be because:`;
  const defaultSuggestions = [
    "The page URL was typed incorrectly",
    "The page has been moved or deleted",
    "You don't have permission to access this page",
    "The menu item hasn't been configured yet"
  ];

  return (
    <div className="p-4 md:p-6">
      <Card>
        <PageCardHeader 
          title={title}
          actions={<Search className="h-6 w-6 text-muted-foreground" />}
        />
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              {description || defaultDescription}
            </AlertDescription>
          </Alert>

          {(suggestions || defaultSuggestions).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Possible reasons:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                {(suggestions || defaultSuggestions).map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={() => navigate(-1)} 
              variant="outline" 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button 
              onClick={() => navigate('/admin/dashboard')} 
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
          </div>

          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p>If you believe this is an error, please contact your administrator.</p>
            <p className="mt-1">Request path: <code className="bg-muted px-1 rounded">{location.pathname}</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};