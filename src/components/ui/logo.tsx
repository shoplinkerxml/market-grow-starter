import React from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ collapsed = false, className }) => {
  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
        <TrendingUp className="h-5 w-5 text-white" />
      </div>
      {!collapsed && <span className="text-2xl font-bold">MarketGrow</span>}
    </div>
  );
};

export default Logo;