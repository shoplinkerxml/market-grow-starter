import { supabase } from "@/integrations/supabase/client";
import { ProfileOperationError, ProfileErrorCode, ProfileCache } from "./error-handler";
import { SessionValidator, isAuthenticationError } from "./session-validation";
import type { UserProfile } from "./profile-service";
import { createProfileWithVerification } from "./profile-crud";

function isAuthorizationError(error: any): boolean {
  return isAuthenticationError(error);
}

function logProfileOperation(operation: string, userId: string, result: any): void {
  console.log("[ProfileService] " + operation + ":", {
    userId,
    timestamp: new Date().toISOString(),
    result: result ? "success" : "null/failure",
    context: "RLS-aware operation",
  });
}

async function waitForValidSession(userId: string, maxWaitTime: number): Promise<boolean> {
  console.log(`[ProfileService] Waiting for valid session for user ${userId}...`);

  const validation = await SessionValidator.waitForValidSession(userId, maxWaitTime);

  if (validation.isValid) {
    console.log("[ProfileService] Valid session found for profile operations");
    return true;
  }

  console.warn(`[ProfileService] No valid session found within ${maxWaitTime}ms for user ${userId}`, {
    error: validation.error,
    hasSession: !!validation.session,
  });

  return false;
}

export async function createProfileWithAuthContext(
  profileData: Partial<UserProfile> & { id: string },
  options: { waitForAuth?: boolean; maxWaitTime?: number } = {},
): Promise<UserProfile> {
  const { waitForAuth = true, maxWaitTime = 5000 } = options;

  try {
    if (waitForAuth) {
      await waitForValidSession(profileData.id, maxWaitTime);
    }

    return await createProfileWithVerification(profileData);
  } catch (error) {
    console.error("Error in createProfileWithAuthContext:", error);
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, error);
  }
}

export async function createProfileWithAuthRetry(
  profileData: Partial<UserProfile> & { id: string },
  maxRetries: number = 3,
): Promise<UserProfile> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Profile creation attempt ${attempt}/${maxRetries} for user ${profileData.id}`);

      if (attempt > 1) {
        const delay = 500 * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const sessionValid = await waitForValidSession(profileData.id, 2000);

      if (!sessionValid) {
        console.warn(`Session not valid for attempt ${attempt}, proceeding anyway`);
      }

      const profile = await createProfileWithVerification(profileData);
      console.log(`Profile creation succeeded on attempt ${attempt}`);
      return profile;
    } catch (error) {
      lastError = error;
      console.error(`Profile creation attempt ${attempt} failed:`, error);

      if (isAuthorizationError(error)) {
        console.error("Authorization error detected in profile creation");
        if (attempt < maxRetries) {
          console.log("Retrying due to authorization error...");
          continue;
        }
      }

      if (attempt === maxRetries) {
        break;
      }
    }
  }

  console.error(`Profile creation failed after ${maxRetries} attempts`);
  throw lastError || new Error(`Profile creation failed after ${maxRetries} attempts`);
}

export async function createProfileWithAuth(
  profileData: Partial<UserProfile> & { id: string },
  accessToken?: string,
): Promise<UserProfile> {
  try {
    if (!profileData.name || profileData.name.trim() === "") {
      console.warn("[ProfileService] Profile name is missing, using fallback");
      profileData.name = profileData.email?.split("@")[0] || "User";
    }

    console.log("[ProfileService] Creating profile with data:", {
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
    });

    void accessToken;

    const sessionValidation = await SessionValidator.ensureValidSession();

    if (!sessionValidation.isValid) {
      throw new ProfileOperationError(
        ProfileErrorCode.PERMISSION_DENIED,
        new Error(`No valid session for profile creation: ${sessionValidation.error}`),
      );
    }

    if (!profileData.email || !profileData.name || !profileData.id) {
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, new Error("Missing required profile fields"));
    }

    await SessionValidator.logSessionDebugInfo("profile-creation");

    const upsertData: any = {
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
    };

    if (profileData.phone !== undefined) upsertData.phone = profileData.phone;
    if (profileData.role !== undefined) upsertData.role = profileData.role;
    if (profileData.status !== undefined) upsertData.status = profileData.status;
    if (profileData.avatar_url !== undefined) upsertData.avatar_url = profileData.avatar_url;
    if (profileData.created_at !== undefined) upsertData.created_at = profileData.created_at;
    if (profileData.updated_at !== undefined) upsertData.updated_at = profileData.updated_at;

    const { data, error } = await supabase
      .from("profiles")
      .upsert(upsertData, {
        onConflict: "id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[ProfileService] Profile creation failed:", error);

      if (isAuthorizationError(error)) {
        const rlsValidation = await SessionValidator.validateRLSContext();
        console.error("[ProfileService] RLS context validation:", rlsValidation);

        throw new ProfileOperationError(
          ProfileErrorCode.PERMISSION_DENIED,
          new Error(`Authentication error during profile creation: ${error.message}`),
        );
      }

      throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, error);
    }

    if (data) {
      ProfileCache.set(`profile_${(data as any).id}`, data);
      if ((data as any).email) {
        ProfileCache.set(`profile_email_${String((data as any).email).toLowerCase()}`, data);
      }
    }

    logProfileOperation("createProfileWithAuth", profileData.id, data);
    return data as UserProfile;
  } catch (error) {
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    console.error("[ProfileService] Error in createProfileWithAuth:", error);
    throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, error);
  }
}

