import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { SessionValidator } from './session-validation';

export type TemplateServiceErrorCode = 'unauthorized' | 'validation_failed' | 'delete_failed';

export class TemplateServiceError extends Error {
  code: TemplateServiceErrorCode;
  details?: unknown;
  constructor(code: TemplateServiceErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const validation = await SessionValidator.ensureValidSession();
  if (!validation.isValid) {
    throw new TemplateServiceError('unauthorized', 'Invalid session', validation.error);
  }
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new TemplateServiceError('unauthorized', 'No authentication token available');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export class TemplateService {
  private static async getAccessToken(): Promise<string> {
    const validation = await SessionValidator.ensureValidSession();
    if (!validation.isValid) {
      throw new TemplateServiceError('unauthorized', 'Invalid session', validation.error);
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new TemplateServiceError('unauthorized', 'No authentication token available');
    }
    return token;
  }

  static async deleteTemplate(id: string): Promise<{ success: boolean }> {
    if (!id) {
      throw new TemplateServiceError('validation_failed', 'Template ID is required');
    }

    await this.getAccessToken();

    const { error } = await supabase
      .from('store_templates')
      .delete()
      .eq('id', id);

    if (error) {
      throw new TemplateServiceError('delete_failed', error.message || 'Failed to delete template', { code: (error as unknown as { code?: string }).code });
    }

    return { success: true };
  }
}
