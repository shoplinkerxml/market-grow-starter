import { supabase } from "@/integrations/supabase/client";
import { ProfileErrorCode, ProfileOperationError, validateProfileData } from "./error-handler";
import { SessionValidator } from "./session-validation";
import type { UserProfile } from "./profile-service";

export type PersonalProfileUpdate = {
  name?: string;
  phone?: string | null;
};

export class UserProfileAccountService {
  static async updatePersonalProfile(userId: string, updates: PersonalProfileUpdate): Promise<UserProfile> {
    if (!userId) {
      throw new ProfileOperationError(ProfileErrorCode.VALIDATION_ERROR, undefined, "User ID is required");
    }

    const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
    if (Object.keys(cleanUpdates).length === 0) {
      throw new ProfileOperationError(ProfileErrorCode.VALIDATION_ERROR, undefined, "No fields to update");
    }

    validateProfileData({ id: userId });
    if (typeof cleanUpdates.name === "string") {
      validateProfileData({ id: userId, name: cleanUpdates.name });
    }

    const sessionValidation = await SessionValidator.ensureValidSession();
    if (!sessionValidation.isValid) {
      throw new ProfileOperationError(
        ProfileErrorCode.PERMISSION_DENIED,
        new Error(sessionValidation.error || "Invalid session"),
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(cleanUpdates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_UPDATE_FAILED, error);
    }

    if (!data) {
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_NOT_FOUND);
    }

    return data as UserProfile;
  }
}
