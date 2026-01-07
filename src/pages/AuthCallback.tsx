import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserAuthService } from "@/lib/user-auth-service";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { Shield } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if this is a password reset callback
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type');
        
        if (type === 'recovery') {
          navigate('/user-reset-password');
          return;
        }
        
        const { user, session, error } = await UserAuthService.handleOAuthCallback();
        
        if (error === 'redirect_to_admin') {
          toast.success(t("welcome_back"));
          navigate("/admin");
          return;
        }
        
        if (error === 'oauth_callback_failed') {
          toast.error(t("oauth_failed"));
          navigate("/user-auth");
          return;
        }
        
        if (error === 'profile_creation_failed') {
          toast.error(t("account_confirmed_setup_failed"));
          navigate("/user-auth");
          return;
        }
        
        if (error) {
          console.error('Auth callback error:', error);
          toast.error(t("auth_failed"));
          navigate("/user-auth");
          return;
        }

        if (user && session) {
          // Check if this is coming from email confirmation
          const isEmailConfirmation = window.location.search.includes('type=signup');
          
          if (isEmailConfirmation) {
            toast.success(t("email_confirmed_welcome"));
          } else {
            toast.success(t("welcome_back"));
          }
          navigate("/user/dashboard");
        } else {
          // Handle case where user confirmed email but profile wasn't created
          // This can happen if the database trigger failed
          toast.success(t("email_confirmed"));
          toast.info(t("please_sign_in_complete_registration"));
          navigate("/user-auth");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error(t("auth_failed"));
        navigate("/user-auth");
      }
    };

    handleCallback();
  }, [navigate, t]);

  return <FullPageLoader title={t("loading") || "Завантаження…"} subtitle={t("auth_processing") || "Завершуємо авторизацію"} icon={Shield} />;
};

export default AuthCallback;
