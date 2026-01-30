import { SessionValidator } from "@/lib/session-validation";

export async function ensureValidSession(): Promise<void> {
  const validation = await SessionValidator.ensureValidSession();
  if (!validation.isValid) {
    const msg = typeof validation.error === "string" && validation.error.trim() ? validation.error : "Unauthorized";
    throw Object.assign(new Error(msg), { status: 401 });
  }
}
