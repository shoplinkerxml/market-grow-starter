/**
 * Centralized Error Handling for Profile Operations
 * 
 * This module provides standardized error handling patterns and user feedback
 * for profile-related operations across the application.
 */

import { CACHE_TTL, UnifiedCacheManager } from "./cache-utils";

export type AppErrorContext = Record<string, unknown>;

export class AppError extends Error {
  code: string;
  status: number;
  retryable: boolean;
  context?: AppErrorContext;
  cause?: unknown;

  constructor(
    code: string,
    message: string,
    opts?: { status?: number; retryable?: boolean; context?: AppErrorContext; cause?: unknown; name?: string },
  ) {
    super(message);
    this.name = opts?.name ?? "AppError";
    this.code = code;
    this.status = typeof opts?.status === "number" ? opts.status : 500;
    this.retryable = typeof opts?.retryable === "boolean" ? opts.retryable : this.status >= 500;
    this.context = opts?.context;
    this.cause = opts?.cause;
    if (opts?.cause !== undefined) {
      (this as any).cause = opts.cause;
    }
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string, opts?: { status?: number; retryable?: boolean; context?: AppErrorContext; cause?: unknown }) {
    super(code, message, {
      status: opts?.status ?? 401,
      retryable: opts?.retryable ?? true,
      context: opts?.context,
      cause: opts?.cause,
      name: "AuthError",
    });
  }
}

export class ValidationError extends AppError {
  constructor(
    code: string,
    message: string,
    opts?: { status?: number; retryable?: boolean; context?: AppErrorContext; cause?: unknown },
  ) {
    super(code, message, {
      status: opts?.status ?? 422,
      retryable: opts?.retryable ?? false,
      context: opts?.context,
      cause: opts?.cause,
      name: "ValidationError",
    });
  }
}

export class NetworkError extends AppError {
  constructor(code: string, message: string, opts?: { status?: number; retryable?: boolean; context?: AppErrorContext; cause?: unknown }) {
    super(code, message, {
      status: opts?.status ?? 503,
      retryable: opts?.retryable ?? true,
      context: opts?.context,
      cause: opts?.cause,
      name: "NetworkError",
    });
  }
}

function extractStatus(error: unknown): number | undefined {
  const e = error as { status?: number; statusCode?: number; context?: { status?: number } } | null;
  const status = e?.context?.status ?? e?.status ?? e?.statusCode;
  return typeof status === "number" ? status : undefined;
}

function extractMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  const e = error as { message?: unknown; error?: unknown; name?: unknown } | null;
  const message = typeof e?.message === "string" ? e.message : undefined;
  if (message && message.trim()) return message;
  const errField = typeof e?.error === "string" ? e.error : undefined;
  if (errField && errField.trim()) return errField;
  const name = typeof e?.name === "string" ? e.name : undefined;
  if (name && name.trim()) return name;
  return undefined;
}

function isNetworkLike(error: unknown): boolean {
  const status = extractStatus(error);
  if (status === 0) return true;
  const msg = (extractMessage(error) || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout") || msg.includes("connection");
}

export function mapError(
  error: unknown,
  fallback?: { code?: string; status?: number; retryable?: boolean; context?: AppErrorContext },
): AppError {
  if (error instanceof AppError) return error;

  const status = extractStatus(error) ?? fallback?.status;
  const message = extractMessage(error) ?? "Unexpected error";

  const asAny = error as { code?: unknown; name?: unknown; details?: unknown } | null;
  const code =
    (typeof asAny?.code === "string" && asAny.code.trim() ? asAny.code : undefined) ??
    (typeof asAny?.name === "string" && asAny.name.trim() ? asAny.name : undefined) ??
    fallback?.code ??
    "unknown_error";

  const context: AppErrorContext | undefined =
    fallback?.context || (asAny && typeof asAny === "object" && "details" in asAny ? { details: asAny.details } : undefined);

  if (isNetworkLike(error)) {
    return new NetworkError(code, message, { status: status ?? 503, retryable: fallback?.retryable, context, cause: error });
  }

  if (status === 401 || status === 403) {
    return new AuthError(code, message, { status, retryable: fallback?.retryable, context, cause: error });
  }

  if (status === 400 || status === 422) {
    return new ValidationError(code, message, { status, retryable: fallback?.retryable, context, cause: error });
  }

  const effectiveStatus = status ?? 500;
  return new AppError(code, message, {
    status: effectiveStatus,
    retryable: typeof fallback?.retryable === "boolean" ? fallback.retryable : effectiveStatus >= 500,
    context,
    cause: error,
  });
}


/**
 * Profile operation error types
 */
export enum ProfileErrorCode {
  PROFILE_NOT_FOUND = 'profile_not_found',
  PROFILE_CREATION_FAILED = 'profile_creation_failed',
  PROFILE_UPDATE_FAILED = 'profile_update_failed',
  AVATAR_UPLOAD_FAILED = 'avatar_upload_failed',
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_DENIED = 'permission_denied',
  NETWORK_ERROR = 'network_error',
  USER_EXISTS = 'user_exists',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * User-friendly error messages
 */
export const errorMessages: Record<ProfileErrorCode, string> = {
  [ProfileErrorCode.PROFILE_NOT_FOUND]: 'User profile not found. Please refresh and try again.',
  [ProfileErrorCode.PROFILE_CREATION_FAILED]: 'Failed to create user profile. Please try again.',
  [ProfileErrorCode.PROFILE_UPDATE_FAILED]: 'Failed to update profile. Please try again.',
  [ProfileErrorCode.AVATAR_UPLOAD_FAILED]: 'Failed to upload avatar. Please try again.',
  [ProfileErrorCode.VALIDATION_ERROR]: 'Invalid data provided. Please check your input.',
  [ProfileErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
  [ProfileErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ProfileErrorCode.USER_EXISTS]: 'An account with this email already exists. Please sign in instead.',
  [ProfileErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many attempts. Please try again in a few minutes.',
  [ProfileErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
};

/**
 * Success messages for profile operations
 */
export const SUCCESS_MESSAGES = {
  PROFILE_CREATED: 'Profile created successfully',
  PROFILE_UPDATED: 'Profile updated successfully', 
  AVATAR_UPDATED: 'Avatar updated successfully',
  PROFILE_LOADED: 'Profile loaded successfully',
  REGISTRATION_SUCCESS: 'Account created successfully! Please check your email for confirmation.',
  LOGIN_SUCCESS: 'Welcome back!',
  PASSWORD_RESET_SENT: 'Password reset email sent. Please check your inbox.'
} as const;

/**
 * Enhanced error class for profile operations
 */
export class ProfileOperationError extends AppError {
  declare code: ProfileErrorCode;
  originalError?: Error | unknown;

  constructor(
    code: ProfileErrorCode,
    originalError?: Error | unknown,
    message?: string
  ) {
    const msg = message || errorMessages[code];
    const status =
      code === ProfileErrorCode.PROFILE_NOT_FOUND
        ? 404
        : code === ProfileErrorCode.VALIDATION_ERROR
          ? 422
          : code === ProfileErrorCode.PERMISSION_DENIED
            ? 403
            : 500;
    const retryable = code === ProfileErrorCode.NETWORK_ERROR;
    super(code, msg, { status, retryable, context: { domain: "profile" }, cause: originalError, name: "ProfileOperationError" });
    this.originalError = originalError;
  }
}

export type ServiceErrorCode =
  | 'auth_error'
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'network_error'
  | 'unknown_error';

export class ServiceError extends AppError {
  declare code: ServiceErrorCode;
  traceId?: string;
  originalError?: unknown;

  constructor(code: ServiceErrorCode, message: string, opts?: { status?: number; traceId?: string; originalError?: unknown }) {
    const status = typeof opts?.status === "number" ? opts.status : 500;
    const retryable = code === "network_error" || status >= 500;
    super(code, message, { status, retryable, context: opts?.traceId ? { traceId: opts.traceId } : undefined, cause: opts?.originalError, name: "ServiceError" });
    this.traceId = opts?.traceId;
    this.originalError = opts?.originalError;
  }
}

export function toServiceError(error: unknown, fallbackCode: ServiceErrorCode = 'unknown_error'): ServiceError {
  if (error instanceof ServiceError) return error;

  const e = error as { status?: number; statusCode?: number; message?: string; code?: string | number } | null;
  const status = (e?.status ?? e?.statusCode) as number | undefined;
  const message = typeof e?.message === 'string' && e.message.trim() ? e.message : 'Unexpected error';

  if (status === 401 || status === 403) {
    return new ServiceError('auth_error', message, { status, originalError: error });
  }
  if (status === 404) {
    return new ServiceError('not_found', message, { status, originalError: error });
  }
  if (status === 409) {
    return new ServiceError('conflict', message, { status, originalError: error });
  }
  if (status === 422) {
    return new ServiceError('validation_error', message, { status, originalError: error });
  }
  if (status === 429) {
    return new ServiceError('rate_limited', message, { status, originalError: error });
  }

  const msgLower = message.toLowerCase();
  if (msgLower.includes('failed to fetch') || msgLower.includes('network') || msgLower.includes('timeout')) {
    return new ServiceError('network_error', message, { status, originalError: error });
  }

  return new ServiceError(fallbackCode, message, { status, originalError: error });
}

import { 
  UserAuthError, 
  AuthorizationError, 
  SessionError 
} from "./user-auth-schemas";

/**
 * Enhanced authorization error handler
 */
export class AuthorizationErrorHandler {
  /**
   * Analyze and categorize authorization errors
   */
  static analyzeAuthorizationError(error: unknown): AuthorizationError {
    const e = (error as { status?: number; statusCode?: number; message?: string; code?: number | string }) || {};
    const status = e.status ?? e.statusCode ?? 0;
    const message = (e.message || '').toLowerCase();
    const code = e.code ?? status;
    
    // 401 Unauthorized errors
    if (status === 401 || message.includes('unauthorized')) {
      if (message.includes('jwt') || message.includes('token')) {
        return {
          type: 'invalid_token',
          code,
          message: 'Authentication token is invalid or expired',
          retryable: true,
          suggestedAction: 'Please sign in again',
          waitTime: 1000
        };
      }
      
      if (message.includes('session') || message.includes('expired')) {
        return {
          type: 'token_expired',
          code,
          message: 'Your session has expired',
          retryable: true,
          suggestedAction: 'Session will be refreshed automatically',
          waitTime: 2000
        };
      }
      
      return {
        type: 'session_not_ready',
        code,
        message: 'Authentication session is not ready',
        retryable: true,
        suggestedAction: 'Waiting for session establishment',
        waitTime: 1500
      };
    }
    
    // 403 Forbidden errors
    if (status === 403 || message.includes('forbidden') || message.includes('permission')) {
      return {
        type: 'insufficient_permissions',
        code,
        message: 'Insufficient permissions for this operation',
        retryable: false,
        suggestedAction: 'Contact support if this persists'
      };
    }
    
    // Unknown authorization error
    return {
      type: 'unknown',
      code,
      message: 'Unknown authorization error occurred',
      retryable: true,
      suggestedAction: 'Please try again',
      waitTime: 1000
    };
  }
  
  /**
   * Get user-friendly error message for authorization errors
   */
  static getUserFriendlyMessage(authError: AuthorizationError, lang: string = 'en'): string {
    const messages = {
      en: {
        invalid_token: 'Your session is invalid. Please sign in again.',
        token_expired: 'Your session has expired. Please wait while we refresh it.',
        session_not_ready: 'Setting up your account. Please wait a moment.',
        insufficient_permissions: 'You do not have permission for this action.',
        unknown: 'Authentication error. Please try again.'
      },
      uk: {
        invalid_token: 'Ваша сесія недійсна. Будь ласка, увійдіть знову.',
        token_expired: 'Ваша сесія закінчилася. Зачекайте, поки ми її оновимо.',
        session_not_ready: 'Налаштовуємо ваш акаунт. Зачекайте хвилинку.',
        insufficient_permissions: 'У вас немає дозволу на цю дію.',
        unknown: 'Помилка автентифікації. Спробуйте ще раз.'
      }
    };
    
    return messages[lang as keyof typeof messages]?.[authError.type] || 
           messages.en[authError.type] || 
           authError.message;
  }
  
  /**
   * Determine if an error should trigger a retry
   */
  static shouldRetry(authError: AuthorizationError, attemptCount: number, maxAttempts: number = 3): boolean {
    if (!authError.retryable || attemptCount >= maxAttempts) {
      return false;
    }
    
    // Special retry logic for different error types
    switch (authError.type) {
      case 'session_not_ready':
        return attemptCount <= 5; // Allow more retries for session issues
      case 'token_expired':
        return attemptCount <= 2; // Limited retries for expired tokens
      case 'invalid_token':
        return attemptCount <= 1; // Only one retry for invalid tokens
      default:
        return attemptCount < maxAttempts;
    }
  }
  
  /**
   * Get recommended wait time before retry
   */
  static getRetryWaitTime(authError: AuthorizationError, attemptCount: number): number {
    const baseWaitTime = authError.waitTime || 1000;
    const exponentialBackoff = Math.pow(2, attemptCount - 1);
    return Math.min(baseWaitTime * exponentialBackoff, 10000); // Max 10 seconds
  }
}

/**
 * Enhanced error handling for authentication and registration operations
 */
export function handleAuthError(error: unknown, operation: string = 'operation'): string {
  console.error(`Auth ${operation} error:`, error);
  
  if (error && typeof error === 'object' && 'message' in error) {
    const errorObj = error as { message?: string };
    const errorMessage = (errorObj.message || '').toLowerCase();
    
    // Enhanced error detection patterns
    if (errorMessage.includes('user already registered') || 
        errorMessage.includes('email already registered') ||
        errorMessage.includes('email already exists')) {
      return errorMessages[ProfileErrorCode.USER_EXISTS];
    }
    
    if (errorMessage.includes('too many') || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429')) {
      return errorMessages[ProfileErrorCode.RATE_LIMIT_EXCEEDED];
    }
    
    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout')) {
      return errorMessages[ProfileErrorCode.NETWORK_ERROR];
    }
    
    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid') ||
        errorMessage.includes('format')) {
      return errorMessages[ProfileErrorCode.VALIDATION_ERROR];
    }
    
    if (errorMessage.includes('permission') || 
        errorMessage.includes('access') ||
        errorMessage.includes('unauthorized')) {
      return errorMessages[ProfileErrorCode.PERMISSION_DENIED];
    }
  }
  
  // Fallback to generic error
  return errorMessages[ProfileErrorCode.UNKNOWN_ERROR];
}

export type ProfileErrorResponse = {
  code: ProfileErrorCode;
  message: string;
  operation: string;
  original?: unknown;
};

export function createProfileError(error: unknown, operation: string = 'operation'): ProfileErrorResponse {
  if (error instanceof ProfileOperationError) {
    return {
      code: error.code,
      message: error.message,
      operation,
      original: error.originalError
    };
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    const msg: string = String((error as { message?: string }).message || '');
    const lower = msg.toLowerCase();
    if (lower.includes('permission') || lower.includes('access')) {
      return { code: ProfileErrorCode.PERMISSION_DENIED, message: errorMessages[ProfileErrorCode.PERMISSION_DENIED], operation, original: error };
    }
    if (lower.includes('network') || lower.includes('connection')) {
      return { code: ProfileErrorCode.NETWORK_ERROR, message: errorMessages[ProfileErrorCode.NETWORK_ERROR], operation, original: error };
    }
    if (lower.includes('validation') || lower.includes('invalid')) {
      return { code: ProfileErrorCode.VALIDATION_ERROR, message: errorMessages[ProfileErrorCode.VALIDATION_ERROR], operation, original: error };
    }
  }
  return { code: ProfileErrorCode.UNKNOWN_ERROR, message: errorMessages[ProfileErrorCode.UNKNOWN_ERROR], operation, original: error };
}

/**
 * Show success message for profile operations
 */
export function formatSuccess(message: string): { message: string } {
  return { message };
}

/**
 * Wrapper for profile operations with standardized error handling
 */
export async function withProfileErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  successMessage?: string
): Promise<{ data: T | null; error?: ProfileErrorResponse; success?: { message: string } }> {
  try {
    const result = await operation();
    const success = successMessage ? formatSuccess(successMessage) : undefined;
    return { data: result, success };
  } catch (error) {
    const err = createProfileError(error, operationName);
    return { data: null, error: err };
  }
}

/**
 * Validate profile data before operations
 */
export function validateProfileData(data: { email?: string; name?: string; id?: string }): void {
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new ProfileOperationError(
      ProfileErrorCode.VALIDATION_ERROR,
      undefined,
      'Invalid email format'
    );
  }
  
  if (data.name && data.name.trim().length < 1) {
    throw new ProfileOperationError(
      ProfileErrorCode.VALIDATION_ERROR,
      undefined,
      'Name is required'
    );
  }
  
  if (data.id && !data.id.trim()) {
    throw new ProfileOperationError(
      ProfileErrorCode.VALIDATION_ERROR,
      undefined,
      'User ID is required'
    );
  }
}

/**
 * Enhanced cache for profile operations to reduce repeated requests
 * Provides better cache management with different TTL settings
 */
class ProfileCache {
  private static readonly CACHE_NAMESPACE = "profile";
  private static readonly MAX_SIZE = 500;
  private static cache = UnifiedCacheManager.create(ProfileCache.CACHE_NAMESPACE, {
    mode: "memory",
    defaultTtlMs: CACHE_TTL.profilesDefault,
    maxSize: ProfileCache.MAX_SIZE,
  });
  
  static get(key: string): unknown | null {
    return this.cache.get<unknown>(key) ?? null;
  }
  
  static set(key: string, data: unknown, customTtl?: number): void {
    const ttl =
      customTtl ??
      (key.startsWith("user_existence_") || key.startsWith("exists_") ? CACHE_TTL.profilesExistence : CACHE_TTL.profilesDefault);
    this.cache.set(key, data, ttl);
  }
  
  static clear(): void {
    this.cache.clearAll();
  }
  
  /**
   * Clear all cache entries for a specific user
   */
  static clearUser(userId: string): void {
    this.cache.clearWhere((key) => key.includes(userId));
  }
  
  /**
   * Clear cache entries by pattern
   */
  static clearPattern(pattern: string): void {
    this.cache.clearWhere((key) => key.includes(pattern));
  }
  
  /**
   * Get cache statistics for monitoring
   */
  static getStats(): { size: number; keys: string[] } {
    const m = UnifiedCacheManager.getMetrics();
    const inst = m.instances.find((i) => i.namespace === ProfileCache.CACHE_NAMESPACE && i.mode === "memory");
    return {
      size: inst?.size ?? 0,
      keys: []
    };
  }
  
  /**
   * Clean expired entries
   */
  static cleanup(): void {
    void 0;
  }
}

export { ProfileCache };
