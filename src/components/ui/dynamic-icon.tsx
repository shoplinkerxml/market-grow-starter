import React from 'react';
import { Circle, type LucideIcon } from 'lucide-react';
import { MENU_ICONS } from '@/components/ui/dynamic-icon-utils';

export interface DynamicIconProps {
  name?: string | null;
  className?: string;
  size?: number;
  fallback?: LucideIcon;
}

/**
 * Dynamic icon component that renders Lucide icons based on name
 * Falls back to a default icon if the name is not found
 */
export const DynamicIcon: React.FC<DynamicIconProps> = ({
  name,
  className = "w-4 h-4",
  size,
  fallback = Circle,
}) => {
  // Get the icon component from the mapping
  const IconComponent = name ? MENU_ICONS[name] || fallback : fallback;
  
  return (
    <IconComponent 
      className={className} 
      size={size}
      aria-hidden="true"
    />
  );
};
 
