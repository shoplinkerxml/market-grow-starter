import { supabase } from '@/integrations/supabase/client';
import { SessionValidator } from './session-validation';

/**
 * Получить токен аутентификации из текущей сессии
 * Включает валидацию через SessionValidator для совместимости с существующим кодом
 * @throws {Error} Если токен недоступен или сессия невалидна
 */
export async function getAuthToken(): Promise<string> {
  // КРИТИЧНО: Валидация сессии через SessionValidator (как в оригинальном коде)
  const validation = await SessionValidator.ensureValidSession();
  if (!validation.isValid) {
    const errorMsg = validation.error ?? 'Session validation failed';
    throw new Error(`Invalid session: ${errorMsg}`);
  }
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error(`Session error: ${error.message}`);
  }
  
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }
  
  return session.access_token;
}

/**
 * Получить заголовки для авторизованных запросов
 * Совместимо с оригинальным getAuthHeaders из template-service.ts
 * @throws {Error} Если токен недоступен
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Проверить валидность текущей сессии
 * Использует SessionValidator для консистентности
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    const validation = await SessionValidator.ensureValidSession();
    return validation.isValid;
  } catch {
    return false;
  }
}
