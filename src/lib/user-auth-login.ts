import { supabase } from "@/integrations/supabase/client";
import { SessionValidator } from "@/lib/session-validation";
import type { AuthResponse, LoginData, ResetPasswordData, UserProfile } from "./user-auth-schemas";
import { UserAuthError } from "./user-auth-schemas";

export async function loginUser(
  data: LoginData,
  deps: {
    mapSupabaseError: (error: any) => string;
    clearAuthMeCache: () => void;
    fetchAuthMe: () => Promise<{ user: UserProfile | null }>;
  },
): Promise<AuthResponse> {
  try {
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError) {
      console.error("Login error:", signInError);
      return {
        user: null,
        session: null,
        error: deps.mapSupabaseError(signInError),
      };
    }

    if (authData.user && authData.session) {
      deps.clearAuthMeCache();

      try {
        SessionValidator.clearCache();
      } catch {
        void 0;
      }

      const expectedUserId = String(authData.user.id);
      await SessionValidator.waitForValidSession(expectedUserId, 5_000);

      let authMe = await deps.fetchAuthMe();
      for (let i = 0; i < 6 && !authMe.user; i++) {
        const delay = Math.round(250 * Math.pow(1.5, i));
        await new Promise((resolve) => setTimeout(resolve, delay));
        deps.clearAuthMeCache();
        authMe = await deps.fetchAuthMe();
      }

      if (authMe.user) {
        if (authMe.user.role && authMe.user.role !== "user") {
          return { user: null, session: authData.session, error: "redirect_to_admin" };
        }
      }
      try {
        void import("@/lib/prefetch-service").then(({ PrefetchService }) => PrefetchService.prefetchEssentialData());
      } catch {
        void 0;
      }
      if (authMe.user) {
        return { user: authMe.user, session: authData.session, error: null };
      }

      return { user: null, session: authData.session, error: UserAuthError.LOGIN_FAILED };
    }

    return {
      user: null,
      session: null,
      error: UserAuthError.LOGIN_FAILED,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      user: null,
      session: null,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}

export async function resetPassword(
  data: ResetPasswordData,
  deps: { mapSupabaseError: (error: any) => string },
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/user-reset-password`,
    });

    if (error) {
      return {
        success: false,
        error: deps.mapSupabaseError(error),
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}

export async function updatePassword(
  password: string,
  deps: { mapSupabaseError: (error: any) => string },
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      return {
        success: false,
        error: deps.mapSupabaseError(error),
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Password update error:", error);
    return {
      success: false,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}

export async function logout(deps: { mapSupabaseError: (error: any) => string }): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: deps.mapSupabaseError(error),
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      success: false,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}
