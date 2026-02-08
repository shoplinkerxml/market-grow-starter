import React from "react";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbItems: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
  hideTitleOnMobile?: boolean;
  mobileActionsInline?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbItems,
  actions,
  className,
  hideTitleOnMobile,
  mobileActionsInline = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "space-y-2",
        className
      )}
    >
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />
      
      {/* Title row with inline actions, description below */}
      <div className="space-y-1">
        <div className={cn(
          mobileActionsInline
            ? "flex items-center justify-between gap-2"
            : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        )}>
          <h1 className={cn("text-xl xs:text-2xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate", hideTitleOnMobile ? "hidden sm:block" : "")}>{title}</h1>
          {actions && (
            <div className="flex items-center gap-2 shrink-0 w-full justify-end sm:w-auto sm:justify-end">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
