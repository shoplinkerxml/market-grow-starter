import { supabase } from "@/integrations/supabase/client";
import { ProfileService } from "./profile-service";
import type { AuthResponse } from "./user-auth-schemas";
import { UserAuthError } from "./user-auth-schemas";

export async function signInWithGoogle(deps: { mapSupabaseError: (error: any) => string }): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return {
        user: null,
        session: null,
        error: deps.mapSupabaseError(error),
      };
    }

    void data;
    return { user: null, session: null, error: null };
  } catch (error) {
    console.error("Google sign-in error:", error);
    return {
      user: null,
      session: null,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}

export async function signInWithFacebook(deps: { mapSupabaseError: (error: any) => string }): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return {
        user: null,
        session: null,
        error: deps.mapSupabaseError(error),
      };
    }

    void data;
    return { user: null, session: null, error: null };
  } catch (error) {
    console.error("Facebook sign-in error:", error);
    return {
      user: null,
      session: null,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}

export async function handleOAuthCallback(): Promise<AuthResponse> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        user: null,
        session: null,
        error: "oauth_callback_failed",
      };
    }

    let profile = await ProfileService.getProfile(session.user.id);

    if (!profile) {
      console.log("Creating profile for authenticated user:", session.user.id);
      const userName =
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split("@")[0] ||
        "User";

      try {
        profile = await ProfileService.createProfileWithAuth(
          {
            id: session.user.id,
            email: session.user.email || "",
            name: userName,
          },
          session.access_token,
        );

        console.log("Profile created successfully for authenticated user");
      } catch (profileError) {
        console.error("Profile creation in callback failed:", profileError);
        return {
          user: null,
          session: null,
          error: UserAuthError.PROFILE_CREATION_FAILED,
        };
      }
    }

    if (profile && profile.role !== "user") {
      return {
        user: null,
        session: session,
        error: "redirect_to_admin",
      };
    }

    return {
      user: profile,
      session: session,
      error: null,
    };
  } catch (error) {
    console.error("OAuth callback error:", error);
    return {
      user: null,
      session: null,
      error: UserAuthError.NETWORK_ERROR,
    };
  }
}

