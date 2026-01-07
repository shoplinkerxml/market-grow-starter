import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  cardClassName?: string;
}

export const PageHeader = ({ 
  title, 
  description, 
  actions, 
  className,
  cardClassName
}: PageHeaderProps) => {
  
  return (
    <div
      className={cn(
        "mb-4 rounded-md bg-emerald-50/80 px-4 py-2 dark:bg-emerald-950/20",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

interface PageCardHeaderProps {
  title: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageCardHeader = ({ 
  title, 
  actions,
  className
}: PageCardHeaderProps) => {
  return (
    <CardHeader className={className}>
      <div className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </CardHeader>
  );
};

interface ActionButtonProps extends ButtonProps {
  icon?: React.ReactNode;
  label: string;
}

export const ActionButton = ({ 
  icon, 
  label, 
  ...props 
}: ActionButtonProps) => {
  return (
    <Button {...props}>
      {icon && <span className="mr-2 h-4 w-4">{icon}</span>}
      {label}
    </Button>
  );
};
