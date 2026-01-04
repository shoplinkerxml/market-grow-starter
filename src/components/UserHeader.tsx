import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Bell, 
  Search, 
  Menu,
  User,
  Settings,
  LogOut,
  Globe,
  Home
} from "lucide-react";
import { UserProfile } from "@/lib/user-auth-schemas";
import { UserAuthService } from "@/lib/user-auth-service";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

interface UserHeaderProps {
  user: UserProfile;
  onMenuToggle: () => void;
}

export const UserHeader = ({ user, onMenuToggle }: UserHeaderProps) => {
  const navigate = useNavigate();
  const { lang, setLang, t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { success, error } = await UserAuthService.logout();
      
      if (error) {
        toast.error(t("failed_logout"));
        return;
      }

      if (success) {
        toast.success(t("logged_out_successfully"));
        navigate("/user-auth");
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(t("failed_logout"));
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuToggle}
          className="md:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={() => navigate('/user/dashboard')} className="hidden md:flex">
          <Home className="h-4 w-4" />
          <span className="hidden md:inline ml-2">Dashboard</span>
        </Button>
        
        <div className="hidden md:block">
          <h1 className="text-xl font-semibold text-gray-900">
            Welcome back, {user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your dashboard and personal settings
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <Button variant="ghost" size="sm" className="hidden md:flex">
          <Search className="h-4 w-4" />
        </Button>

        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLang(lang === "uk" ? "en" : "uk")}
          className="hidden md:flex"
        >
          <Globe className="h-4 w-4 mr-1" />
          {lang === "uk" ? "EN" : "UA"}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
          >
            3
          </Badge>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar_url || ""} alt={user.name} />
                <AvatarFallback className="bg-emerald-100 text-emerald-600">
                  {getUserInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/user/dashboard')}>
              <Home className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/user/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/user/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              disabled={loading}
              className="focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{loading ? "Logging out..." : "Log out"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
