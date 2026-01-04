import React from "react";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";

interface StatusToggleProps {
  userId: string;
  status: "active" | "inactive";
  onToggle: (userId: string, newStatus: "active" | "inactive") => void;
  disabled?: boolean;
}

export function StatusToggle({ userId, status, onToggle, disabled = false }: StatusToggleProps) {
  const { t } = useI18n();

  const handleToggle = (checked: boolean) => {
    const newStatus = checked ? "active" : "inactive";
    onToggle(userId, newStatus);
  };

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={status === "active"}
        onCheckedChange={handleToggle}
        disabled={disabled}
        className="data-[state=checked]:bg-emerald-200 data-[state=unchecked]:bg-input"
      />
      <Badge
        variant={status === "active" ? "default" : "secondary"}
        className={
          status === "active"
            ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/10"
            : "bg-muted/50 text-muted-foreground border-muted hover:bg-muted/50"
        }
      >
        {status === "active" ? t("status_active") : t("status_inactive")}
      </Badge>
    </div>
  );
}
