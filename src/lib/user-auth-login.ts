import { supabase } from "@/integrations/supabase/client";
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
      const authMe = await deps.fetchAuthMe();
      if (!authMe.user) {
        return { user: null, session: authData.session, error: UserAuthError.LOGIN_FAILED };
      }
      if (authMe.user.role && authMe.user.role !== "user") {
        return { user: null, session: authData.session, error: "redirect_to_admin" };
      }
      return { user: authMe.user, session: authData.session, error: null };
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

