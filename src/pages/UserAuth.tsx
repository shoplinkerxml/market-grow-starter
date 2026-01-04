import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, User, CheckCircle2, Chrome, Facebook } from "lucide-react";
import { useI18n } from "@/i18n";
import { UserAuthService } from "@/lib/user-auth-service";
import { ProfileService } from "@/lib/profile-service";
import { 
  loginSchema,
  LoginData
} from "@/lib/user-auth-schemas";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const UserAuth = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [loading, setLoading] = useState(false);

  // Login form
  const {
    register: loginForm,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors }
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema)
  });



  const handleLogin = async (data: LoginData) => {
    setLoading(true);
    try {
      const { user, session, error } = await UserAuthService.login(data);
      
      if (error === 'redirect_to_admin') {
        navigate("/admin");
        return;
      }
      
      if (error === 'email_confirmation_required') {
        toast.error(
          lang === 'uk'
            ? 'Потрібно підтвердити електронну пошту. Перевірте скриньку вхідних повідомлень.'
            : 'Please confirm your email address. Check your inbox for the confirmation link.'
        );
        setTimeout(() => {
          toast.info(
            lang === 'uk'
              ? 'Після підвердження поверніться сюди і увійдіть знову.'
              : 'After confirming, come back here and sign in again.'
          );
        }, 2000);
        return;
      }
      
      if (error === 'invalid_credentials') {
        toast.error(
          lang === 'uk'
            ? 'Невірний email або пароль. Перевірте дані і спробуйте ще раз.'
            : 'Invalid email or password. Please check your credentials and try again.'
        );
        return;
      }
      
      if (error === 'user_not_found') {
        toast.error(
          lang === 'uk'
            ? 'Користувач з таким email не знайдений. Можливо, вам потрібно спочатку зареєструватися?'
            : 'No user found with this email. Do you need to register first?'
        );
        // Automatically redirect to registration page after a short delay
        setTimeout(() => {
          navigate('/user-register');
        }, 3000);
        return;
      }
      
      // Check if user account is inactive
      if (user && user.status === 'inactive') {
        toast.error(
          lang === 'uk'
            ? 'Ваш акаунт заблоковано. Зверніться до адміністратора.'
            : 'Your account has been blocked. Please contact the administrator.'
        );
        // Logout the user since they can't access the system
        await UserAuthService.logout();
        return;
      }
      
      if (error) {
        // Handle other errors with translated messages
        const errorMessages: { [key: string]: { uk: string; en: string } } = {
          'network_error': {
            uk: 'Помилка мережі. Перевірте інтернет з’єднання.',
            en: 'Network error. Please check your internet connection.'
          },
          'rate_limit_exceeded': {
            uk: 'Занадто багато спроб. Спробуйте пізніше.',
            en: 'Too many attempts. Please try again later.'
          },
          'login_failed': {
            uk: 'Помилка входу. Перевірте дані.',
            en: 'Login failed. Please check your credentials.'
          }
        };
        
        const errorMessage = errorMessages[error] || {
          uk: 'Неочікувана помилка. Спробуйте ще раз.',
          en: 'An unexpected error occurred. Please try again.'
        };
        
        toast.error(lang === 'uk' ? errorMessage.uk : errorMessage.en);
        return;
      }

      if (user && session) {
        toast.success(t("login_success"));
        navigate("/user/dashboard");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(
        lang === 'uk'
          ? 'Неочікувана помилка. Спробуйте ще раз.'
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = (provider: 'google' | 'facebook') => {
    toast.info(
      lang === 'uk' 
        ? `Авторизація через ${provider === 'google' ? 'Google' : 'Facebook'} тимчасово недоступна` 
        : `${provider === 'google' ? 'Google' : 'Facebook'} authentication is temporarily disabled`
    );
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

        {/* Right Panel - Login Form */}
        <div className="flex items-center md:items-start justify-center md:justify-start p-6 md:p-0 md:pl-8" data-testid="login-section">
          <Card className="w-full max-w-md shadow-lg" data-testid="login-card">
            <CardHeader className="text-center" data-testid="login-header">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                <User className="h-6 w-6" />
              </div>
              <CardTitle data-testid="login-title">{t("login_title_user")}</CardTitle>
              <CardDescription className="mt-2" data-testid="login-description">
                {t("login_desc_user")}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4" data-testid="login-content">
              {/* Social Auth Buttons - Single Row Layout */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleSocialAuth('google')}
                  disabled={loading}
                >
                  <Chrome className="h-4 w-4 mr-2" />
                  {lang === 'uk' ? 'Google' : 'Google'}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleSocialAuth('facebook')}
                  disabled={loading}
                >
                  <Facebook className="h-4 w-4 mr-2" />
                  {lang === 'uk' ? 'Facebook' : 'Facebook'}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("continue_with_signin")}
                  </span>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit(handleLogin)} className="space-y-4" data-testid="login-form">
                <div className="space-y-2">
                  <Label htmlFor="login-email" data-testid="email-label">{t("email")}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    data-testid="email-input"
                    {...loginForm("email")}
                    placeholder={t("email_placeholder")}
                    className={loginErrors.email ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {loginErrors.email && (
                    <p className="text-sm text-destructive" data-testid="error-message">
                      {t(loginErrors.email.message as any) || loginErrors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" data-testid="password-label">{t("password")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    data-testid="password-input"
                    {...loginForm("password")}
                    placeholder={t("password_placeholder")}
                    className={loginErrors.password ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {loginErrors.password && (
                    <p className="text-sm text-destructive" data-testid="error-message">
                      {t(loginErrors.password.message as any) || loginErrors.password.message}
                    </p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full"
                  variant="default"
                  data-testid="login-button"
                >
                  {loading ? "..." : t("login_button_user")}
                </Button>
              </form>

              <div className="space-y-2 text-center text-sm text-muted-foreground">
                <p>
                  {t("no_account_user")} 
                  <Link
                    to="/user-register"
                    className="text-emerald-600 hover:underline ml-1"
                    data-testid="register-link"
                  >
                    {t("register_button")}
                  </Link>
                </p>
                <p>
                  <Link
                    to="/user-forgot-password"
                    className="text-emerald-600 hover:underline"
                    data-testid="forgot-password-link"
                  >
                    {t("forgot_password")}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserAuth;
