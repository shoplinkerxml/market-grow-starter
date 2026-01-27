import type { ComponentType, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type FieldIcon = ComponentType<{ className?: string }>;

export function FormField({
  label,
  htmlFor,
  icon: Icon,
  children,
}: {
  label: string;
  htmlFor?: string;
  icon?: FieldIcon;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4 text-emerald-600" /> : null}
        {label}
      </Label>
      {children}
    </div>
  );
}

export function SwitchField({
  label,
  icon: Icon,
  checked,
  onCheckedChange,
}: {
  label: string;
  icon?: FieldIcon;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4 text-emerald-600" /> : null}
        <span>{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
