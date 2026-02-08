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
            ? "flex items-center justify-between gap-2 flex-nowrap"
            : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        )}>
          <h1 className={cn("min-w-0 text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight truncate", hideTitleOnMobile ? "hidden sm:block" : "")}>{title}</h1>
          {actions && (
            <div className={cn(
              "flex items-center gap-2 shrink-0 justify-end",
              mobileActionsInline ? "w-auto" : "w-full sm:w-auto"
            )}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
