import { supabase } from "@/integrations/supabase/client";
import { ProfileService } from "./profile-service";
import { UserExistenceService } from "./user-existence-service";
import type { RegistrationData, AuthResponse } from "./user-auth-schemas";
import { UserAuthError } from "./user-auth-schemas";

export interface RegistrationOptions {
  maxRetries: number;
  sessionTimeout: number;
  profileCreationDelay: number;
  retryDelay: number;
}

interface RegistrationMetrics {
  startTime: number;
  steps: { [key: string]: { startTime: number; endTime?: number; duration?: number; success?: boolean; error?: any } };
  totalDuration?: number;
  success: boolean;
  finalError?: any;
}

class RegistrationLogger {
  private static metrics: Map<string, RegistrationMetrics> = new Map();

  static startRegistration(email: string): RegistrationMetrics {
    const metrics: RegistrationMetrics = {
      startTime: Date.now(),
      steps: {},
      success: false,
    };

    this.metrics.set(email, metrics);
    console.log(`🚀 Registration started for ${email}`, {
      timestamp: new Date().toISOString(),
      email,
    });

    return metrics;
  }

  static logStep(email: string, stepName: string, data?: any): void {
    const metrics = this.metrics.get(email);
    if (!metrics) return;

    if (!metrics.steps[stepName]) {
      metrics.steps[stepName] = { startTime: Date.now() };
      console.log(`📝 Registration step started: ${stepName}`, {
        email,
        step: stepName,
        timestamp: new Date().toISOString(),
        data,
      });
    } else {
      metrics.steps[stepName].endTime = Date.now();
      metrics.steps[stepName].duration = metrics.steps[stepName].endTime! - metrics.steps[stepName].startTime;
      metrics.steps[stepName].success = !data?.error;
      if (data?.error) {
        metrics.steps[stepName].error = data.error;
      }

      console.log(`✅ Registration step completed: ${stepName}`, {
        email,
        step: stepName,
        duration: metrics.steps[stepName].duration,
        success: metrics.steps[stepName].success,
        timestamp: new Date().toISOString(),
        data,
      });
    }
  }

  static finishRegistration(email: string, success: boolean, error?: any): void {
    const metrics = this.metrics.get(email);
    if (!metrics) return;

    metrics.totalDuration = Date.now() - metrics.startTime;
    metrics.success = success;
    if (error) {
      metrics.finalError = error;
    }

    console.log(`🏁 Registration completed for ${email}`, {
      email,
      success,
      totalDuration: metrics.totalDuration,
      steps: Object.keys(metrics.steps).length,
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(metrics),
    });

    setTimeout(() => this.metrics.delete(email), 300000);
  }

  static logError(email: string, stepName: string, error: any, context?: any): void {
    console.error(`❌ Registration error in ${stepName}`, {
      email,
      step: stepName,
      error: {
        message: error.message,
        code: error.code,
        status: error.status || error.statusCode,
        stack: error.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    });

    this.logStep(email, stepName, { error });
  }

  static logWarning(email: string, stepName: string, message: string, data?: any): void {
    console.warn(`⚠️ Registration warning in ${stepName}`, {
      email,
      step: stepName,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  private static generateSummary(metrics: RegistrationMetrics): any {
    const stepSummary = Object.entries(metrics.steps).map(([name, step]) => ({
      name,
      duration: step.duration || 0,
      success: step.success !== false,
    }));

    return {
      totalSteps: stepSummary.length,
      successfulSteps: stepSummary.filter((s) => s.success).length,
      longestStep: stepSummary.reduce(
        (prev, current) => ((prev.duration > current.duration ? prev : current) as any),
        { name: "", duration: 0 } as any,
      ),
    };
  }

  static getMetrics(email: string): RegistrationMetrics | undefined {
    return this.metrics.get(email);
  }
}

const DEFAULT_REGISTRATION_OPTIONS: RegistrationOptions = {
  maxRetries: 3,
  sessionTimeout: 10000,
  profileCreationDelay: 1000,
  retryDelay: 500,
};

export async function registerUser(
  data: RegistrationData,
  options: Partial<RegistrationOptions> = {},
  deps: { mapSupabaseError: (error: any) => string; isAuthorizationError: (error: any) => boolean },
): Promise<AuthResponse> {
  const config = { ...DEFAULT_REGISTRATION_OPTIONS, ...options };
  const metrics = RegistrationLogger.startRegistration(data.email);

  try {
    RegistrationLogger.logStep(data.email, "validation");
    console.log("Starting user registration for:", data.email);
    RegistrationLogger.logStep(data.email, "validation", { completed: true });

    RegistrationLogger.logStep(data.email, "existence_check");
    const existingProfile = await ProfileService.getProfileByEmail(data.email);

    if (existingProfile) {
      RegistrationLogger.logStep(data.email, "existence_check", { exists: true, profile: existingProfile.id });
      RegistrationLogger.finishRegistration(data.email, false, UserAuthError.EMAIL_EXISTS);
      console.log("User profile already exists:", data.email);
      return {
        user: null,
        session: null,
        error: UserAuthError.EMAIL_EXISTS,
      };
    }

    RegistrationLogger.logStep(data.email, "existence_check", { exists: false });
    console.log("User does not exist, proceeding with registration");

    RegistrationLogger.logStep(data.email, "auth_signup");
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name: data.name,
          full_name: data.name,
        },
      },
    });

    if (signUpError || !authData.user) {
      RegistrationLogger.logError(data.email, "auth_signup", signUpError || "No user data returned");
      RegistrationLogger.finishRegistration(data.email, false, signUpError);
      console.error("Registration signup error:", signUpError);
      return {
        user: null,
        session: null,
        error: deps.mapSupabaseError(signUpError),
      };
    }

    RegistrationLogger.logStep(data.email, "auth_signup", {
      userId: authData.user.id,
      hasSession: !!authData.session,
      emailConfirmed: authData.user.email_confirmed_at !== null,
    });
    console.log("User created in auth:", {
      userId: authData.user.id,
      emailConfirmed: authData.user.email_confirmed_at !== null,
      hasSession: !!authData.session,
    });

    if (!authData.session && !authData.user.email_confirmed_at) {
      RegistrationLogger.finishRegistration(data.email, true, "Email confirmation required");
      console.log("Registration successful, email confirmation required before login");

      UserExistenceService.clearExistenceCache(data.email);

      return {
        user: null,
        session: null,
        error: UserAuthError.EMAIL_CONFIRMATION_REQUIRED,
      };
    }

    if (authData.session) {
      RegistrationLogger.logStep(data.email, "profile_creation_immediate");

      try {
        const profile = await ProfileService.createProfileWithAuth(
          {
            id: authData.user.id,
            email: data.email,
            name: data.name,
          },
          authData.session.access_token,
        );

        RegistrationLogger.logStep(data.email, "profile_creation_immediate", {
          profileId: profile.id,
        });
        console.log("Profile created immediately (email confirmation disabled)");

        UserExistenceService.clearExistenceCache(data.email);
        RegistrationLogger.finishRegistration(data.email, true);

        return {
          user: profile,
          session: authData.session,
          error: null,
        };
      } catch (profileError) {
        console.error("Profile creation failed:", profileError);
        RegistrationLogger.finishRegistration(data.email, false, profileError);
        return {
          user: null,
          session: null,
          error: UserAuthError.PROFILE_CREATION_FAILED,
        };
      }
    }

    UserExistenceService.clearExistenceCache(data.email);
    RegistrationLogger.finishRegistration(data.email, true);

    return {
      user: null,
      session: null,
      error: UserAuthError.EMAIL_CONFIRMATION_REQUIRED,
    };
  } catch (error) {
    RegistrationLogger.logError(data.email, "general", error);
    RegistrationLogger.finishRegistration(data.email, false, error);
    console.error("Registration error:", error);

    if (deps.isAuthorizationError(error)) {
      return {
        user: null,
        session: null,
        error: UserAuthError.INSUFFICIENT_PERMISSIONS,
      };
    }

    return {
      user: null,
      session: null,
      error: UserAuthError.REGISTRATION_FAILED,
    };
  } finally {
    void metrics;
    void config;
  }
}

