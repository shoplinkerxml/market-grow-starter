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

function normalizeRole(role: unknown): UserProfile["role"] {
  return role === "admin" || role === "manager" || role === "user" ? role : "user";
}

function normalizeStatus(status: unknown): UserProfile["status"] {
  return status === "active" || status === "inactive" ? status : "active";
}

function buildLocalProfile(input: Partial<UserProfile> & { id: string }): UserProfile {
  const now = new Date().toISOString();
  return {
    id: String(input.id),
    email: String(input.email || ""),
    name: String(input.name || ""),
    phone: input.phone ?? null,
    role: normalizeRole(input.role),
    status: normalizeStatus(input.status),
    avatar_url: input.avatar_url ?? null,
    created_at: String((input as any).created_at || now),
    updated_at: String((input as any).updated_at || now),
  };
}

const profileByEmailBatch = new BatchProcessor<string, UserProfile | null>(async (emails) => {
  const normalized = (emails || []).map((e) => String(e).toLowerCase());
  return normalized.map(() => null);
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
    logProfileOperation("getProfile", userId, null);
    return null;
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
    for (const email of emails) {
      results.set(email, false);
    }
    return results;
  } catch (error) {
    console.error("Error in checkMultipleUsersExist:", error);
    const results = new Map<string, boolean>();
    emails.forEach((email) => results.set(email, false));
    return results;
  }
}

export async function getProfileFields(userId: string, fields: string[]): Promise<Partial<UserProfile> | null> {
  try {
    const cached = ProfileCache.get(`profile_${userId}`) as UserProfile | null;
    if (!cached) return null;
    const out: Partial<UserProfile> = {};
    for (const f of fields) {
      (out as any)[f] = (cached as any)[f];
    }
    return out;
  } catch (error) {
    console.error("Error in getProfileFields:", error);
    return null;
  }
}

export async function upsertProfile(profileData: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
  try {
    if (!profileData.email || !profileData.name || !profileData.id) {
      throw new Error("Missing required profile fields");
    }
    const built = buildLocalProfile(profileData);
    ProfileCache.set(`profile_${built.id}`, built);
    ProfileCache.set(`profile_email_${String(built.email).toLowerCase()}`, built);
    return built;
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
    const prev = (ProfileCache.get(`profile_${userId}`) as UserProfile | null) ?? null;
    if (!prev) return null;
    const merged = buildLocalProfile({
      ...prev,
      ...updates,
      id: userId,
      updated_at: new Date().toISOString(),
    });
    ProfileCache.set(`profile_${userId}`, merged);
    if ((merged as any).email) {
      ProfileCache.set(`profile_email_${String((merged as any).email).toLowerCase()}`, merged);
    }
    logProfileOperation("updateProfile", userId, merged);
    return merged;
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
    const built = buildLocalProfile(profileData);
    ProfileCache.set(`profile_${built.id}`, built);
    ProfileCache.set(`profile_email_${String(built.email).toLowerCase()}`, built);
    return built;
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
    void pattern;
    void limit;
    return [];
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
    ProfileCache.set(`exists_${email.toLowerCase()}`, false);
    return false;
  } catch (error) {
    console.error("Error checking profile existence by email:", error);
    return false;
  }
}
