import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, CheckCircle2, Lock, Shield } from "lucide-react";
import { useI18n } from "@/i18n";
import { UserAuthService } from "@/lib/user-auth-service";
import { 
  updatePasswordSchema,
  UpdatePasswordData
} from "@/lib/user-auth-schemas";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { FullPageLoader } from "@/components/LoadingSkeletons";

const UserResetPassword = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  // Password update form
  const {
    register: passwordForm,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors }
  } = useForm<UpdatePasswordData>({
    resolver: zodResolver(updatePasswordSchema)
  });

  // Check for valid reset session on component mount
  useEffect(() => {
    const checkResetSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error(t("session_expired") || "Session expired. Please request a new password reset.");
          navigate("/user-forgot-password");
          return;
        }

        // If we have a session, we can proceed with password reset
        setSessionValid(true);
      } catch (error) {
        console.error('Error checking session:', error);
        setSessionValid(false);
        toast.error(t("session_invalid") || "Invalid session. Please request a new password reset.");
        navigate("/user-forgot-password");
      }
    };

    checkResetSession();
  }, [navigate, t]);

  const handlePasswordUpdate = async (data: UpdatePasswordData) => {
    if (!sessionValid) {
      toast.error(t("session_invalid") || "Invalid session. Please request a new password reset.");
      navigate("/user-forgot-password");
      return;
    }

    setLoading(true);
    try {
      const { success, error } = await UserAuthService.updatePassword(data.password);
      
      if (error) {
        toast.error(t(error as any) || "Failed to update password");
        return;
      }

      if (success) {
        setResetSuccess(true);
        toast.success(t("password_updated") || "Password updated successfully");
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate("/user-auth");
        }, 2000);
      }
    } catch (error) {
      console.error("Password update error:", error);
      toast.error(t("network_error") || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (sessionValid === null) {
    return (
      <FullPageLoader
        title={t("validating_session") || "Validating session..."}
        subtitle={t("loading") || "Завантаження…"}
        icon={Shield}
      />
    );
  }

  return (
    <div className="relative min-h-screen flex">
      {/* Language Toggle - Improved hover state */}
      <div className="absolute right-4 top-4 md:right-8 md:top-8 z-10">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => setLang(lang === "uk" ? "en" : "uk")}
          className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
        >
          {lang === "uk" ? "EN" : "UA"}
        </Button>
      </div>

      <div className="container mx-auto my-auto grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] items-center gap-4 md:gap-8">
        
        {/* Left Panel - Marketing Content */}
        <div className="hidden md:flex flex-col justify-center md:items-end px-6 lg:px-10">
          <div className="max-w-xl">
            {/* Brand Header */}
            <div className="flex items-center space-x-3 mb-8">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold">MarketGrow</span>
            </div>

            {/* Hero Badge */}
            <div className="inline-flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-sm mb-4">
              <span>↗</span>
              <span>{t("hero_badge")}</span>
            </div>

            {/* Hero Content */}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {t("hero_title")}
            </h1>
            <p className="text-muted-foreground mb-8">
              {t("hero_desc")}
            </p>

            {/* Security Features Card */}
            <Card className="bg-emerald-50 border-emerald-100">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  {t("security_features_title") || "Secure Reset"}
                </CardTitle>
                <CardDescription className="text-emerald-900/80">
                  {t("security_features_subtitle") || "Your account security is our priority"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-emerald-900/90">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_secure_reset") || "Secure password reset process"}
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_token_validation") || "Token-based validation"}
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_session_timeout") || "Automatic session timeout"}
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_password_requirements") || "Strong password requirements"}
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Panel - Password Reset Form */}
        <div className="flex items-center md:items-start justify-center md:justify-start p-6 md:p-0 md:pl-8">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                <Lock className="h-6 w-6" />
              </div>
              <CardTitle>{t("reset_password_title") || "Reset Your Password"}</CardTitle>
              <CardDescription className="mt-2">
                {t("reset_password_desc") || "Enter your new password below"}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {resetSuccess ? (
                <div className="text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">
                      {t("password_updated") || "Password Updated Successfully"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'uk' 
                        ? 'Ваш пароль було успішно оновлено. Перенаправляємо на сторінку входу...' 
                        : 'Your password has been updated successfully. Redirecting to login page...'
                      }
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => navigate("/user-auth")}
                    className="w-full"
                  >
                    {t("continue_to_login") || "Continue to Login"}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit(handlePasswordUpdate)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{t("new_password") || "New Password"}</Label>
                    <Input
                      id="new-password"
                      type="password"
                      {...passwordForm("password")}
                      placeholder={t("password_placeholder")}
                      className={passwordErrors.password ? "border-destructive" : ""}
                      disabled={loading}
                    />
                    {passwordErrors.password && (
                      <p className="text-sm text-destructive">
                        {t(passwordErrors.password.message as any) || passwordErrors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">{t("confirm_new_password") || "Confirm New Password"}</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      {...passwordForm("confirmPassword")}
                      placeholder={t("password_placeholder")}
                      className={passwordErrors.confirmPassword ? "border-destructive" : ""}
                      disabled={loading}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {t(passwordErrors.confirmPassword.message as any) || passwordErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {loading ? "..." : t("update_password_button") || "Update Password"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    <Link
                      to="/user-forgot-password"
                      className="text-emerald-600 hover:underline"
                    >
                      {t("request_new_reset") || "Request new reset link"}
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserResetPassword;
