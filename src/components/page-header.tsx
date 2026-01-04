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
    <div className={cn("mb-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">
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