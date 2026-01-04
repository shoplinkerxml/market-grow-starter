import { z } from "zod";

const emailSchema = z.string().email("email_invalid");
const passwordSchema = z.string().min(8, "password_min");

export const registrationSchema = z.object({
  name: z.string().min(2, "name_min_length").max(50, "Name must be at most 50 characters"),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, "confirm_password_required"),
  acceptTerms: z.boolean().refine(val => val === true, { message: "terms_required" })
}).refine(data => data.password === data.confirmPassword, { message: "passwords_match", path: ["confirmPassword"] });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password_required")
});

export const resetPasswordSchema = z.object({
  email: emailSchema
});

export const updatePasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, "confirm_password_required")
}).refine(data => data.password === data.confirmPassword, { message: "passwords_match", path: ["confirmPassword"] });

// Type exports for form data
export type RegistrationData = z.infer<typeof registrationSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordData = z.infer<typeof updatePasswordSchema>;

// User profile interface
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Authentication response interface
export interface AuthResponse {
  user: UserProfile | null;
  session: { access_token?: string | null; refresh_token?: string | null } | null;
  error: string | null;
}

// Authentication error types with enhanced messaging for email confirmation flow
export enum UserAuthError {
  REGISTRATION_FAILED = 'registration_failed',
  LOGIN_FAILED = 'login_failed',
  INVALID_CREDENTIALS = 'invalid_credentials',
  EMAIL_EXISTS = 'email_exists',
  WEAK_PASSWORD = 'weak_password',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  PROFILE_CREATION_FAILED = 'profile_creation_failed',
  EMAIL_CONFIRMATION_REQUIRED = 'email_confirmation_required',
  EMAIL_NOT_CONFIRMED = 'email_not_confirmed', // Alias for login errors
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  USER_NOT_FOUND = 'user_not_found',
  AUTHORIZATION_ERROR = 'authorization_error',
  SESSION_EXPIRED = 'session_expired',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  AUTH_TOKEN_INVALID = 'auth_token_invalid',
  EMAIL_PROVIDER_DISABLED = 'email_provider_disabled',
  SESSION_NOT_READY = 'session_not_ready'
}

// Authorization error details interface
export interface AuthorizationError {
  type: 'token_expired' | 'invalid_token' | 'insufficient_permissions' | 'session_not_ready' | 'unknown';
  code: number | string;
  message: string;
  retryable: boolean;
  suggestedAction: string;
  waitTime?: number; // For retryable errors
}

// Session management error types
export enum SessionError {
  SESSION_NOT_FOUND = 'session_not_found',
  SESSION_EXPIRED = 'session_expired',
  SESSION_INVALID = 'session_invalid',
  REFRESH_FAILED = 'refresh_failed',
  TOKEN_MALFORMED = 'token_malformed'
}

// Enhanced registration error interface
export interface RegistrationError {
  type: 'validation' | 'user_exists' | 'network' | 'rate_limit' | 'signup_failed' | 'profile_failed';
  message: string;
  code: string;
  retryable: boolean;
  suggestedAction?: string;
}

// Session context interface for tracking authentication state
export interface SessionContext {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string;
  isReady: boolean;
  expiresAt: number | null;
}

// User existence check result interface
export interface UserExistenceCheck {
  exists: boolean;
  profile?: UserProfile | null;
  authUser?: boolean;
  existenceType?: 'profile_only' | 'auth_only' | 'both' | 'none';
}
