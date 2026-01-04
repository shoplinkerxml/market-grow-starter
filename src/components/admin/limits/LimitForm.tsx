import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { useI18n } from "@/i18n";
import { type LimitTemplate } from '@/lib/limit-service';
import { FileText, Code, Globe, FileCode } from 'lucide-react';

interface LimitFormProps {
  limit?: LimitTemplate;
  onSave: (data: { name: string; code: string; path?: string; description?: string }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export const LimitForm = ({ limit, onSave, onCancel, saving = false }: LimitFormProps) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: limit?.name || '',
    code: limit?.code || '',
    path: limit?.path || '',
    description: limit?.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (limit) {
      setFormData({
        name: limit.name || '',
        code: limit.code || '',
        path: limit.path || '',
        description: limit.description || '',
      });
    }
  }, [limit]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('limit_name_required');
    }

    if (!formData.code.trim()) {
      newErrors.code = t('limit_code_required');
    } else {
      // Validate snake_case format
      const codeRegex = /^[a-z][a-z0-9_]*$/;
      if (!codeRegex.test(formData.code.trim())) {
        newErrors.code = t('limit_code_format_error');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await onSave({
      name: formData.name.trim(),
      code: formData.code.trim(),
      path: formData.path.trim() || undefined,
      description: formData.description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            {t('limit_name_field')} <span className="text-destructive">*</span>
          </label>
          <InputGroup className={errors.name ? 'border-destructive' : ''}>
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <FileText />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t('limit_name_placeholder')}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              aria-invalid={!!errors.name}
            />
          </InputGroup>
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            {t('limit_code_field')} <span className="text-destructive">*</span>
          </label>
          <InputGroup className={errors.code ? 'border-destructive' : ''}>
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <Code />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t('limit_code_placeholder')}
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value)}
              aria-invalid={!!errors.code}
            />
          </InputGroup>
          {errors.code && (
            <p className="text-sm text-destructive mt-1">{errors.code}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">{t('limit_code_hint')}</p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            {t('limit_path_field')}
          </label>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <Globe />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t('limit_path_placeholder')}
              value={formData.path}
              onChange={(e) => handleChange('path', e.target.value)}
            />
          </InputGroup>
          <p className="text-sm text-muted-foreground mt-1">{t('limit_path_hint')}</p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            {t('limit_description_field')}
          </label>
          <InputGroup>
            <InputGroupAddon align="block-start">
              <InputGroupText>
                <FileCode />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupTextarea
              placeholder={t('limit_description_placeholder')}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </InputGroup>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : limit ? t('save_changes') : t('create')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
};
