import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  let errorMessage: string;
  let errorTitle = "Oops! Something went wrong";

  if (isRouteErrorResponse(error)) {
    // error is type `ErrorResponse`
    errorTitle = `${error.status} ${error.statusText}`;
    errorMessage = error.data?.message || error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = 'Unknown error';
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {errorTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {errorMessage || "Sorry, an unexpected error has occurred."}
          </p>
          {import.meta.env.DEV && error instanceof Error && (
            <pre className="mt-4 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
              {error.stack}
            </pre>
          )}
        </CardContent>
        <CardFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
