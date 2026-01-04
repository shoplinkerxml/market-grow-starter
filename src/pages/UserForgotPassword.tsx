import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, User, CheckCircle2, Mail } from "lucide-react";
import { useI18n } from "@/i18n";
import { UserAuthService } from "@/lib/user-auth-service";
import { 
  resetPasswordSchema,
  ResetPasswordData
} from "@/lib/user-auth-schemas";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const UserForgotPassword = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Reset password form
  const {
    register: resetForm,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors }
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema)
  });

  const handlePasswordReset = async (data: ResetPasswordData) => {
    setLoading(true);
    try {
      const { success, error } = await UserAuthService.resetPassword(data);
      
      if (error) {
        toast.error(t(error as any) || t("failed_send_reset_email"));
        return;
      }

      if (success) {
        setResetSuccess(true);
        toast.success(t("reset_success"));
      }
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error(t("failed_send_reset_email"));
    } finally {
      setLoading(false);
    }
  };

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

            {/* Features Card */}
            <Card className="bg-emerald-50 border-emerald-100">
              <CardHeader>
                <CardTitle className="text-base">{t("features_title")}</CardTitle>
                <CardDescription className="text-emerald-900/80">
                  {t("features_subtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-emerald-900/90">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_integrations")}
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_convert")}
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_mapping")}
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    {t("feat_enrichment")}
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
                <Mail className="h-6 w-6" />
              </div>
              <CardTitle>{t("reset_title")}</CardTitle>
              <CardDescription className="mt-2">
                {t("reset_desc")}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {resetSuccess ? (
                <div className="text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">{t("reset_success")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'uk' 
                        ? 'Перевірте пошту для отримання посилання на скидання паролю' 
                        : 'Check your email for the reset link'
                      }
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => navigate("/user-auth")}
                    className="w-full"
                  >
                    {t("back_to_login")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetSubmit(handlePasswordReset)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">{t("email")}</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      {...resetForm("email")}
                      placeholder={t("reset_email_placeholder")}
                      className={resetErrors.email ? "border-destructive" : ""}
                      disabled={loading}
                    />
                    {resetErrors.email && (
                      <p className="text-sm text-destructive">
                        {t(resetErrors.email.message as any) || resetErrors.email.message}
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full"
                    variant="default"
                  >
                    {loading ? "..." : t("reset_button")}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    <Link
                      to="/user-auth"
                      className="text-emerald-600 hover:underline"
                    >
                      {t("back_to_login")}
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

export default UserForgotPassword;
