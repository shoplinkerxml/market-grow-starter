import React from "react";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbItems: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbItems,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />
      
      {/* Title row with inline actions, description below */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate">{title}</h1>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
