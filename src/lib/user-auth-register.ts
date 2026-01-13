import { EdgeClient } from "./request-handler";
import type { RegistrationData, AuthResponse } from "./user-auth-schemas";
import { UserAuthError } from "./user-auth-schemas";

export interface RegistrationOptions {
  maxRetries: number;
  sessionTimeout: number;
  profileCreationDelay: number;
  retryDelay: number;
}

type EdgeRegisterResponse =
  | { success: true; user: any; message?: string }
  | { success?: false; error?: string; message?: string };

export async function registerUser(
  data: RegistrationData,
  options: Partial<RegistrationOptions> = {},
  deps: { mapSupabaseError: (error: any) => string; isAuthorizationError: (error: any) => boolean },
): Promise<AuthResponse> {
  try {
    void options;
    const payload = await EdgeClient.invokeWithRetry<EdgeRegisterResponse>(
      "user-register",
      { email: data.email, password: data.password, name: data.name },
      { maxRetries: 0, auth: { type: "none" } },
    );

    if ((payload as any)?.success === true && (payload as any)?.user) {
      return { user: (payload as any).user, session: null, error: null };
    }

    const code = String((payload as any)?.error || "");
    if (code === "email_exists") return { user: null, session: null, error: UserAuthError.EMAIL_EXISTS };
    if (code === "weak_password") return { user: null, session: null, error: UserAuthError.WEAK_PASSWORD };
    if (code === "invalid_input" || code === "invalid_email") return { user: null, session: null, error: UserAuthError.VALIDATION_ERROR };
    if (code === "profile_creation_failed") return { user: null, session: null, error: UserAuthError.PROFILE_CREATION_FAILED };

    return { user: null, session: null, error: UserAuthError.REGISTRATION_FAILED };
  } catch (error) {
    if (deps.isAuthorizationError(error)) {
      return {
        user: null,
        session: null,
        error: UserAuthError.INSUFFICIENT_PERMISSIONS,
      };
    }
    void deps.mapSupabaseError;
    return {
      user: null,
      session: null,
      error: UserAuthError.REGISTRATION_FAILED,
    };
  }
}
