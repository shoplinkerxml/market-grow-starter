import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProfileService } from "@/lib/profile-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, Plug, FileSpreadsheet, Tags, Sparkles, UploadCloud, BarChart3, Shield } from "lucide-react";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

const AdminAuth = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) throw signInError;
      
      if (data.session) {
        // Ensure profile exists and has default avatar if missing
        try {
          const userId = data.session.user.id;
          const profile = await ProfileService.ensureProfile(userId, {
            email: data.session.user.email || '',
            name: data.session.user.user_metadata?.name || ''
          });
          
          if (!profile) {
            toast.error(t("failed_load_user_profile"));
            return;
          }
          
          if (!profile.avatar_url || profile.avatar_url.trim() === '') {
            const defaultUrl = '/placeholder.svg';
            try {
              await ProfileService.updateProfile(userId, { avatar_url: defaultUrl });
            } catch (avatarError) {
              console.error('Failed to set default avatar:', avatarError);
              // Don't block login if avatar update fails
            }
          }
          
          toast.success(t("login_success_admin"));
          navigate("/admin/dashboard");
        } catch (profileError) {
          console.error('Profile handling error:', profileError);
          // Still allow login even if profile operations fail
          navigate("/admin/dashboard");
        }
      }
    } catch (err: any) {
      setError(err.message || t("login_failed"));
      toast.error(err.message || t("login_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex" data-testid="admin-auth-page">
      {/* Language Toggle - Improved hover state */}
      <div className="absolute right-4 top-4 md:right-8 md:top-8 z-10">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => setLang(lang === "uk" ? "en" : "uk")}
          className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
          data-testid="language-toggle"
        >
          {lang === "uk" ? "EN" : "UA"}
        </Button>
      </div>
      <div className="container mx-auto my-auto grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] items-center gap-4 md:gap-8">
      <div className="hidden md:flex flex-col justify-center md:items-end px-6 lg:px-10" data-testid="hero-section">
        <div className="max-w-xl">
          <div className="flex items-center space-x-3 mb-8" data-testid="logo-section">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold" data-testid="brand-name">MarketGrow</span>
          </div>
          <div className="inline-flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-sm mb-4" data-testid="hero-badge">
            <span>↗</span>
            <span>{t("hero_badge")}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="hero-title">{t("hero_title")}</h1>
          <p className="text-muted-foreground mb-8" data-testid="hero-description">{t("hero_desc")}</p>
          <Card className="bg-emerald-50 border-emerald-100" data-testid="features-card">
            <CardHeader>
              <CardTitle className="text-base" data-testid="features-title">{t("features_title")}</CardTitle>
              <CardDescription className="text-emerald-900/80" data-testid="features-subtitle">{t("features_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2 text-sm text-emerald-900/90" data-testid="features-list">
                <li className="flex items-start gap-2"><Plug className="h-4 w-4 mt-0.5" /> {t("feat_integrations")}</li>
                <li className="flex items-start gap-2"><FileSpreadsheet className="h-4 w-4 mt-0.5" /> {t("feat_convert")}</li>
                <li className="flex items-start gap-2"><Tags className="h-4 w-4 mt-0.5" /> {t("feat_mapping")}</li>
                <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5" /> {t("feat_enrichment")}</li>
                <li className="flex items-start gap-2"><UploadCloud className="h-4 w-4 mt-0.5" /> {t("feat_export")}</li>
                <li className="flex items-start gap-2"><BarChart3 className="h-4 w-4 mt-0.5" /> {t("feat_analytics")}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center md:items-start justify-center md:justify-start p-6 md:p-0" data-testid="login-section">
        <Card className="w-full max-w-md shadow-sm" data-testid="login-card">
          <CardHeader className="text-center" data-testid="login-header">
            <div className="mx-auto h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2" data-testid="shield-icon">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-center" data-testid="login-title">{t("login_title")}</CardTitle>
              <CardDescription className="text-center" data-testid="login-description">{t("login_desc")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent data-testid="login-content">
            <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
              <div data-testid="email-field">
                <label className="text-sm font-medium" data-testid="email-label">{t("email")}</label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email-input"
                />
              </div>
              <div data-testid="password-field">
                <label className="text-sm font-medium" data-testid="password-label">{t("password")}</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="password-input"
                />
              </div>
              {error && (
                <div className="text-sm text-destructive" data-testid="error-message">{error}</div>
              )}
              <Button type="submit" disabled={loading} className="w-full" variant="default" data-testid="login-button">
                {loading ? "…" : t("sign_in")}
              </Button>
              <p className="text-center text-sm text-muted-foreground" data-testid="signup-link-text">
                {t("no_account")} <Link className="text-emerald-600 hover:underline" to="#" data-testid="signup-link">{t("sign_up")}</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default AdminAuth;

