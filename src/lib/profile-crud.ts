import { supabase } from "@/integrations/supabase/client";
import { ProfileOperationError, ProfileErrorCode, validateProfileData, ProfileCache } from "./error-handler";
import { BatchProcessor } from "./cache-utils";
import type { UserProfile } from "./profile-service";

function isPostgRESTEmptyError(error: any): boolean {
  return error?.code === "PGRST116" || error?.message?.includes("The result contains 0 rows");
}

function handlePostgRESTError(error: any): any {
  if (isPostgRESTEmptyError(error)) {
    return null;
  }
  throw error;
}

function logProfileOperation(operation: string, userId: string, result: any): void {
  console.log("[ProfileService] " + operation + ":", {
    userId,
    timestamp: new Date().toISOString(),
    result: result ? "success" : "null/failure",
    context: "RLS-aware operation",
  });
}

const profileByEmailBatch = new BatchProcessor<string, UserProfile | null>(async (emails) => {
  const normalized = (emails || []).map((e) => String(e).toLowerCase());
  const unique = Array.from(new Set(normalized.filter(Boolean)));
  if (unique.length === 0) return normalized.map(() => null);

  const { data, error } = await supabase.from("profiles").select("*").in("email", unique);

  if (error) throw error;

  const byEmail = new Map<string, UserProfile>();
  for (const row of (data || []) as any[]) {
    const email = typeof row?.email === "string" ? row.email.toLowerCase() : "";
    if (!email) continue;
    byEmail.set(email, row as UserProfile);
    ProfileCache.set(`profile_email_${email}`, row);
    if (row?.id) ProfileCache.set(`profile_${String(row.id)}`, row);
  }

  return normalized.map((email) => byEmail.get(email) ?? null);
}, 20);

export async function getProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    const normalizedEmail = String(email).toLowerCase();

    const cached = ProfileCache.get(`profile_email_${normalizedEmail}`);
    if (cached) {
      logProfileOperation("getProfileByEmail (cached)", email, cached);
      return cached as UserProfile;
    }

    const data = await profileByEmailBatch.load(normalizedEmail);
    logProfileOperation("getProfileByEmail", email, data);
    return data as UserProfile | null;
  } catch (error) {
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    console.error("Error in getProfileByEmail:", error);
    const asAny = error as any;
    const maybeNull = handlePostgRESTError(asAny);
    if (maybeNull === null) {
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_NOT_FOUND, error);
    }
    throw new ProfileOperationError(ProfileErrorCode.NETWORK_ERROR, error);
  }
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const cached = ProfileCache.get(`profile_${userId}`);
    if (cached) {
      logProfileOperation("getProfile (cached)", userId, cached);
      return cached as UserProfile;
    }

    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    if (error) {
      console.error("Error fetching user profile:", error);
      const result = handlePostgRESTError(error);
      if (result === null) {
        throw new ProfileOperationError(ProfileErrorCode.PROFILE_NOT_FOUND, error);
      }
      throw new ProfileOperationError(ProfileErrorCode.NETWORK_ERROR, error);
    }

    if (data) {
      ProfileCache.set(`profile_${userId}`, data);
    }

    logProfileOperation("getProfile", userId, data);
    return data as UserProfile | null;
  } catch (error) {
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    console.error("Error in getProfile:", error);
    throw new ProfileOperationError(ProfileErrorCode.NETWORK_ERROR, error);
  }
}

export async function requireProfile(userId: string): Promise<UserProfile> {
  const profile = await getProfile(userId);
  if (!profile) {
    throw new Error("Profile not found");
  }
  return profile;
}

export async function checkMultipleUsersExist(emails: string[]): Promise<Map<string, boolean>> {
  try {
    const results = new Map<string, boolean>();

    const batchSize = 10;
    const batches: string[][] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }

    const settled = await Promise.allSettled(
      batches.map(async (batch) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("email")
          .in(
            "email",
            batch.map((email) => email.toLowerCase()),
          );
        return { batch, data, error };
      }),
    );

    for (const item of settled) {
      if (item.status === "rejected") {
        console.error("Error checking multiple users existence:", item.reason);
        continue;
      }

      const { batch, data, error } = item.value;
      if (error) {
        console.error("Error checking multiple users existence:", error);
        batch.forEach((email) => results.set(email, true));
        continue;
      }

      const existingEmails = new Set((data || []).map((profile: any) => profile.email));
      batch.forEach((email) => {
        results.set(email, existingEmails.has(email.toLowerCase()));
      });
    }

    return results;
  } catch (error) {
    console.error("Error in checkMultipleUsersExist:", error);
    const results = new Map<string, boolean>();
    emails.forEach((email) => results.set(email, true));
    return results;
  }
}

export async function getProfileFields(userId: string, fields: string[]): Promise<Partial<UserProfile> | null> {
  try {
    const { data, error } = await supabase.from("profiles").select(fields.join(",")).eq("id", userId).maybeSingle();

    if (error) {
      console.error("Error fetching user profile fields:", error);
      return handlePostgRESTError(error);
    }

    return data as Partial<UserProfile> | null;
  } catch (error) {
    console.error("Error in getProfileFields:", error);
    return handlePostgRESTError(error);
  }
}

export async function upsertProfile(profileData: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
  try {
    if (!profileData.email || !profileData.name || !profileData.id) {
      throw new Error("Missing required profile fields");
    }

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
      console.error("Error upserting user profile:", error);
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, error);
    }

    if (data) {
      ProfileCache.set(`profile_${data.id}`, data);
      if ((data as any).email) {
        ProfileCache.set(`profile_email_${String((data as any).email).toLowerCase()}`, data);
      }
    }

    return data as UserProfile | null;
  } catch (error) {
    console.error("Error in upsertProfile:", error);
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, error);
  }
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    validateProfileData({ ...updates, id: userId });

    const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().maybeSingle();

    if (error) {
      console.error("Error updating user profile:", error);
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_UPDATE_FAILED, error);
    }

    if (data) {
      ProfileCache.set(`profile_${userId}`, data);
      logProfileOperation("updateProfile", userId, data);
    }

    return data as UserProfile | null;
  } catch (error) {
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    console.error("Error in updateProfile:", error);
    throw new ProfileOperationError(ProfileErrorCode.PROFILE_UPDATE_FAILED, error);
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await getProfileFields(userId, ["role"]);
    if (!profile || !(profile as any).role) {
      console.warn("[ProfileService] No profile or role found for user, assuming non-admin:", userId);
      return false;
    }
    return (profile as any).role === "admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

export async function hasAdminAccess(userId: string): Promise<boolean> {
  try {
    const profile = await getProfileFields(userId, ["role"]);
    return (profile as any)?.role === "admin" || (profile as any)?.role === "manager";
  } catch (error) {
    console.error("Error checking admin access:", error);
    return false;
  }
}

export async function getUserRole(userId: string): Promise<string | null> {
  try {
    const profile = await getProfileFields(userId, ["role"]);
    return ((profile as any)?.role as string | undefined) || null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

export async function ensureProfile(
  userId: string,
  profileData: { email: string; name: string },
): Promise<UserProfile | null> {
  try {
    let profile = await getProfile(userId);

    if (profile) {
      return profile;
    }

    profile = await upsertProfile({
      id: userId,
      email: profileData.email,
      name: profileData.name,
      role: "admin",
      status: "active",
    } as any);

    return profile;
  } catch (error) {
    console.error("Error ensuring profile:", error);
    return null;
  }
}

export async function createProfileWithVerification(
  profileData: Partial<UserProfile> & { id: string },
): Promise<UserProfile> {
  try {
    if (!profileData.email || !profileData.name || !profileData.id) {
      throw new Error("Missing required profile fields");
    }

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

    const { data: upsertedProfile, error: upsertError } = await supabase
      .from("profiles")
      .upsert(upsertData, {
        onConflict: "id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Profile upsert failed:", upsertError);
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, upsertError);
    }

    void upsertedProfile;
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { data: verifiedProfile, error: verifyError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileData.id)
      .single();

    if (verifyError || !verifiedProfile) {
      console.error("Profile verification failed:", verifyError);
      throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, verifyError);
    }

    ProfileCache.set(`profile_${profileData.id}`, verifiedProfile);
    if ((verifiedProfile as any).email) {
      ProfileCache.set(`profile_email_${String((verifiedProfile as any).email).toLowerCase()}`, verifiedProfile);
    }

    return verifiedProfile as UserProfile;
  } catch (error) {
    console.error("Error in createProfileWithVerification:", error);
    if (error instanceof ProfileOperationError) {
      throw error;
    }
    throw new ProfileOperationError(ProfileErrorCode.PROFILE_CREATION_FAILED, error);
  }
}

export async function createProfile(profileData: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
  try {
    return await createProfileWithVerification(profileData);
  } catch (error) {
    console.error("Error in createProfile:", error);
    return null;
  }
}

export async function findProfilesByEmailPattern(pattern: string, limit: number = 10): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase.from("profiles").select("*").ilike("email", `%${pattern}%`).limit(limit);

    if (error) {
      console.error("Error finding profiles by email pattern:", error);
      return [];
    }

    return (data || []) as UserProfile[];
  } catch (error) {
    console.error("Error in findProfilesByEmailPattern:", error);
    return [];
  }
}

export async function profileExistsByEmail(email: string): Promise<boolean> {
  try {
    const cached = ProfileCache.get(`exists_${email.toLowerCase()}`);
    if (cached !== null && typeof cached === "boolean") {
      return cached;
    }

    const { data, error } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();

    if (error) {
      const result = handlePostgRESTError(error);
      if (result === null) {
        ProfileCache.set(`exists_${email.toLowerCase()}`, false);
        return false;
      }
      throw error;
    }

    const exists = !!data;
    ProfileCache.set(`exists_${email.toLowerCase()}`, exists);
    return exists;
  } catch (error) {
    console.error("Error checking profile existence by email:", error);
    return true;
  }
}

