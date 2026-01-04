import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, User, CheckCircle2, Chrome, Facebook, Mail } from "lucide-react";
import { useI18n } from "@/i18n";
import { 
  registrationSchema, 
  RegistrationData
} from "@/lib/user-auth-schemas";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

const UserRegister = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [loading, setLoading] = useState(false);

  // Registration form
  const {
    register: registerForm,
    handleSubmit: handleRegisterSubmit,
    control,
    formState: { errors: registerErrors }
  } = useForm<RegistrationData>({
    resolver: zodResolver(registrationSchema)
  });

  const handleRegistration = async (data: RegistrationData) => {
    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/user-register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
        }),
      });

      const responseData: { success?: boolean; error?: string; message?: string } | null =
        await response.json().catch(() => null);

      if (!response.ok || !responseData || responseData.success !== true) {
        const errorCode = responseData?.error || "registration_failed";

        if (errorCode === "email_exists") {
          toast.error(
            lang === "uk"
              ? "Акаунт з цією електронною поштою вже існує. Будь ласка, увійдіть в систему."
              : "An account with this email already exists. Please sign in instead."
          );
          setTimeout(() => {
            navigate("/user-auth");
          }, 3000);
          return;
        }

        if (errorCode === "invalid_input") {
          toast.error(
            lang === "uk"
              ? "Неправильні дані реєстрації. Перевірте введену інформацію."
              : "Invalid registration data. Please check your input."
          );
          return;
        }

        toast.error(
          lang === "uk"
            ? "Реєстрація не вдалася. Спробуйте ще раз або зверніться до підтримки."
            : "Registration failed. Please try again or contact support."
        );
        return;
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(
        lang === 'uk'
          ? 'Неочікувана помилка. Спробуйте ще раз або зверніться до підтримки.'
          : 'Unexpected error. Please try again or contact support.'
      );
      return;
    }

    toast.success(
      lang === "uk"
        ? "Реєстрація успішна! Тепер ви можете увійти в систему."
        : "Registration successful! You can now sign in."
    );
    navigate("/user-auth");
    try {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
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
      {/* Language Toggle */}
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

        {/* Right Panel - Registration Form */}
        <div className="flex items-center md:items-start justify-center md:justify-start p-6 md:p-0 md:pl-8">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                <User className="h-6 w-6" />
              </div>
              <CardTitle>{t("register_title")}</CardTitle>
              <CardDescription className="mt-2">
                {t("register_desc")}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Social Auth Buttons - Disabled for now */}
              <div className="space-y-2 md:space-y-0 md:flex md:gap-2">
                <Button 
                  variant="outline" 
                  className="w-full md:flex-1" 
                  onClick={() => handleSocialAuth('google')}
                  disabled={true}
                >
                  <Chrome className="h-4 w-4 mr-2" />
                  {t("google_signup")}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full md:flex-1" 
                  onClick={() => handleSocialAuth('facebook')}
                  disabled={true}
                >
                  <Facebook className="h-4 w-4 mr-2" />
                  {t("facebook_signup")}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("or_sign_in_with")}
                  </span>
                </div>
              </div>

              <form onSubmit={handleRegisterSubmit(handleRegistration)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("full_name")}</Label>
                  <Input
                    id="name"
                    data-testid="userRegister_name_input"
                    {...registerForm("name")}
                    placeholder={t("name_placeholder")}
                    className={registerErrors.name ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {registerErrors.name && (
                    <p className="text-sm text-destructive" data-testid="userRegister_name_error">
                      {t(registerErrors.name.message as any) || registerErrors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="userRegister_email_input"
                    {...registerForm("email")}
                    placeholder={t("email_placeholder")}
                    className={registerErrors.email ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {registerErrors.email && (
                    <p className="text-sm text-destructive" data-testid="userRegister_email_error">
                      {t(registerErrors.email.message as any) || registerErrors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    data-testid="userRegister_password_input"
                    {...registerForm("password")}
                    placeholder={t("password_placeholder")}
                    className={registerErrors.password ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {registerErrors.password && (
                    <p className="text-sm text-destructive" data-testid="userRegister_password_error">
                      {t(registerErrors.password.message as any) || registerErrors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("confirm_password")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    data-testid="userRegister_confirmPassword_input"
                    {...registerForm("confirmPassword")}
                    placeholder={t("password_placeholder")}
                    className={registerErrors.confirmPassword ? "border-destructive" : ""}
                    disabled={loading}
                  />
                  {registerErrors.confirmPassword && (
                    <p className="text-sm text-destructive" data-testid="userRegister_confirmPassword_error">
                      {t(registerErrors.confirmPassword.message as any) || registerErrors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Controller
                    name="acceptTerms"
                    control={control}
                    defaultValue={false}
                    render={({ field }) => (
                      <Checkbox 
                        id="terms" 
                        data-testid="userRegister_terms_checkbox"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={loading}
                      />
                    )}
                  />
                  <Label 
                    htmlFor="terms" 
                    className="text-xs font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground/70"
                  >
                    {lang === 'uk' 
                      ? 'Я погоджуюся з умовами політики конфіденційності' 
                      : 'I agree to the terms of use and privacy policy'
                    }
                  </Label>
                </div>
                {registerErrors.acceptTerms && (
                  <p className="text-sm text-destructive" data-testid="userRegister_terms_error">
                    {lang === 'uk' ? 'Необхідно прийняти умови' : 'You must accept the terms'}
                  </p>
                )}

                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full"
                  variant="default"
                  data-testid="userRegister_submit_button"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2"></div>
                      {lang === 'uk' ? 'Реєстрація...' : 'Registering...'}
                    </div>
                  ) : (
                    t("register_button")
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground pt-2">
                <Mail className="inline h-4 w-4 mr-1" />
                {lang === 'uk' 
                  ? 'Після реєстрації перевірте електронну пошту для підтвердження' 
                  : 'Check your email for confirmation after registration'}
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {t("already_account")} 
                <Link
                  to="/user-auth"
                  className="text-emerald-600 hover:underline ml-1"
                >
                  {t("sign_in")}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserRegister;
