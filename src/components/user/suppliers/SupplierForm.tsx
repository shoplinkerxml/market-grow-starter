import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  InputGroup, 
  InputGroupAddon, 
  InputGroupText, 
  InputGroupInput 
} from '@/components/ui/input-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Building2, Globe, Link, Phone, Loader2, AlertTriangle, Download, RefreshCw, CheckCircle2, XCircle, Clock, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from "@/i18n";
import { SupplierService, type Supplier, type CreateSupplierData, type UpdateSupplierData } from '@/lib/supplier-service';
import { XmlImportService, type SupplierImportRun } from '@/lib/xml-import-service';
import { handleImportRunFinish } from '@/lib/xml-import-cache';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';

interface SupplierFormProps {
  supplier?: Supplier | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const SupplierForm = ({ supplier, onSuccess, onCancel }: SupplierFormProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useOutletContext<{ user: { id?: string } | null }>();
  const navigate = useNavigate();
  const uid = user?.id ? String(user.id) : "current";
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastRun, setLastRun] = useState<SupplierImportRun | null>(null);
  const [formData, setFormData] = useState({
    supplier_name: supplier?.supplier_name || '',
    website_url: supplier?.website_url || '',
    xml_feed_url: supplier?.xml_feed_url || '',
    phone: supplier?.phone || '',
    is_active: supplier?.is_active !== false,
    import_enabled: !!supplier?.import_enabled,
    import_frequency_hours: Number(supplier?.import_frequency_hours ?? 0),
    mark_missing_unavailable: !!supplier?.mark_missing_unavailable,
  });

  const [errors, setErrors] = useState({
    supplier_name: '',
    xml_feed_url: '',
  });

  const validateForm = (): boolean => {
    const newErrors = {
      supplier_name: '',
      xml_feed_url: '',
    };

    if (!formData.supplier_name.trim()) {
      newErrors.supplier_name = "Назва постачальника обов'язкова";
    }

    // Поле посилання на прайс НЕобов'язкове; якщо вказано — перевіряємо формат URL
    if (formData.xml_feed_url.trim()) {
      try {
        new URL(formData.xml_feed_url);
      } catch {
        newErrors.xml_feed_url = "Невірний формат URL";
      }
    }

    setErrors(newErrors);
    return !newErrors.supplier_name && !newErrors.xml_feed_url;
  };

  // Load last import run + subscribe to realtime updates
  useEffect(() => {
    if (!supplier?.id) return;
    let cancelled = false;
    void XmlImportService.listRuns(Number(supplier.id), 1)
      .then((runs) => { if (!cancelled) setLastRun(runs[0] ?? null); })
      .catch(() => { /* ignore */ });

    const channel = supabase
      .channel(`supplier-runs-${supplier.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'supplier_import_runs', filter: `supplier_id=eq.${supplier.id}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as SupplierImportRun | null;
          if (!row) return;
          handleImportRunFinish(queryClient, uid, row);
          setLastRun((prev) => {
            if (!prev) return row;
            const prevTs = new Date(prev.created_at).getTime();
            const nextTs = new Date(row.created_at).getTime();
            return nextTs >= prevTs ? row : prev;
          });
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supplier?.id]);

  const handleRunImport = async () => {
    if (!supplier?.id) return;
    if (!formData.xml_feed_url.trim()) {
      toast.error(t('xml_import_no_url'));
      return;
    }
    setImporting(true);
    try {
      await XmlImportService.startImport(Number(supplier.id), 'manual');
      toast.success(t('xml_import_queued'));
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      toast.error(m || t('xml_import_failed_start'));
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      if (supplier?.id) {
        // Оновлення
        const updateData: UpdateSupplierData = {
          supplier_name: formData.supplier_name.trim(),
          website_url: formData.website_url.trim() || undefined,
          xml_feed_url: formData.xml_feed_url.trim() || null,
          phone: formData.phone.trim() || undefined,
          is_active: formData.is_active,
          import_enabled: formData.import_enabled,
          import_frequency_hours: formData.import_frequency_hours,
          mark_missing_unavailable: formData.mark_missing_unavailable,
        };
        const updated = await SupplierService.updateSupplier(supplier.id, updateData);
        queryClient.setQueryData<Supplier[]>(['user', uid, 'suppliers', 'list'], (old) => {
          const list = Array.isArray(old) ? old : [];
          const next = list.map((s) => (Number(s.id) === Number(updated.id) ? updated : s));
          return next.some((s) => Number(s.id) === Number(updated.id)) ? next : [updated, ...next];
        });
        toast.success(t('supplier_updated'));
        // If supplier was deactivated, invalidate products cache
        if (!formData.is_active) {
          try {
            const { ProductService } = await import('@/lib/product-service');
            ProductService.clearAllProductsCaches();
            queryClient.invalidateQueries({ queryKey: ["user", uid, "products"], exact: false, refetchType: "all" });
          } catch { void 0; }
        }
      } else {
        // Створення
        const createData: CreateSupplierData = {
          supplier_name: formData.supplier_name.trim(),
          website_url: formData.website_url.trim() || undefined,
          xml_feed_url: formData.xml_feed_url.trim() || null,
          phone: formData.phone.trim() || undefined,
        };
        const created = await SupplierService.createSupplier(createData);
        queryClient.setQueryData<Supplier[]>(['user', uid, 'suppliers', 'list'], (old) => {
          const list = Array.isArray(old) ? old : [];
          const without = list.filter((s) => Number(s.id) !== Number(created.id));
          return [created, ...without];
        });
        toast.success(t('supplier_created'));
      }
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message || t('failed_save_supplier'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Очищаємо помилку при зміні поля
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>
            {supplier ? t('edit_supplier') : t('create_supplier')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Назва постачальника */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('supplier_name')} <span className="text-destructive">*</span>
            </label>
            <InputGroup className={errors.supplier_name ? 'border-destructive' : ''}>
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <Building2 />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('supplier_name_placeholder')}
                value={formData.supplier_name}
                onChange={(e) => handleChange('supplier_name', e.target.value)}
                aria-invalid={!!errors.supplier_name}
              />
            </InputGroup>
            {errors.supplier_name && (
              <p className="text-sm text-destructive">{errors.supplier_name}</p>
            )}
          </div>

          {/* Сайт */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('website')}
            </label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <Globe />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('website_placeholder')}
                value={formData.website_url}
                onChange={(e) => handleChange('website_url', e.target.value)}
              />
            </InputGroup>
          </div>

          {/* Посилання на прайс */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('xml_feed_url')}
            </label>
            <InputGroup className={errors.xml_feed_url ? 'border-destructive' : ''}>
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <Link />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('xml_feed_url_placeholder')}
                value={formData.xml_feed_url}
                onChange={(e) => handleChange('xml_feed_url', e.target.value)}
                aria-invalid={!!errors.xml_feed_url}
              />
            </InputGroup>
            {errors.xml_feed_url && (
              <p className="text-sm text-destructive">{errors.xml_feed_url}</p>
            )}
          </div>

          {/* Телефон */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('phone')}
            </label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <Phone />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder={t('phone_placeholder')}
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </InputGroup>
          </div>

          {/* Активність постачальника (тільки при редагуванні) */}
          {supplier && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="supplier_is_active"
                  checked={formData.is_active}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, is_active: val }))}
                />
                <Label htmlFor="supplier_is_active">{t('supplier_is_active')}</Label>
              </div>
              {!formData.is_active && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{t('supplier_inactive_warning')}</span>
                </div>
              )}
            </div>
          )}

          {/* XML Auto-Import (тільки при редагуванні) */}
          {supplier?.id && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">{t('xml_import_section')}</h4>
                <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/user/suppliers/${supplier.id}/mapping`)}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  {t('xml_map_edit_link')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRunImport}
                  disabled={importing || !formData.xml_feed_url.trim()}
                  title={!formData.xml_feed_url.trim() ? t('xml_import_no_url') : ''}
                >
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {t('xml_import_run_now')}
                </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="supplier_import_enabled"
                  checked={formData.import_enabled}
                  onCheckedChange={(val) => setFormData(prev => ({
                    ...prev,
                    import_enabled: val,
                    import_frequency_hours: val && prev.import_frequency_hours === 0 ? 24 : prev.import_frequency_hours,
                  }))}
                  disabled={!formData.xml_feed_url.trim()}
                />
                <Label htmlFor="supplier_import_enabled">{t('xml_import_enabled')}</Label>
              </div>

              {formData.import_enabled && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('xml_import_frequency')}</Label>
                  <Select
                    value={String(formData.import_frequency_hours || 24)}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, import_frequency_hours: Number(v) }))}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">{t('xml_import_freq_6h')}</SelectItem>
                      <SelectItem value="12">{t('xml_import_freq_12h')}</SelectItem>
                      <SelectItem value="24">{t('xml_import_freq_24h')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Switch
                  id="supplier_mark_missing"
                  checked={formData.mark_missing_unavailable}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, mark_missing_unavailable: val }))}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor="supplier_mark_missing">{t('xml_import_mark_missing')}</Label>
                  <p className="text-xs text-muted-foreground">{t('xml_import_mark_missing_hint')}</p>
                </div>
              </div>

              {/* Last run indicator */}
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{t('xml_import_last_run')}:</span>
                  {!lastRun && <span>{t('xml_import_never')}</span>}
                  {lastRun && (
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      {lastRun.status === 'succeeded' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {lastRun.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      {(lastRun.status === 'queued' || lastRun.status === 'running') && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                      {t(`xml_import_status_${lastRun.status}` as never) || lastRun.status}
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {new Date(lastRun.started_at || lastRun.created_at).toLocaleString()}
                      </span>
                    </span>
                  )}
                </div>
                {lastRun && (lastRun.created_count != null || lastRun.updated_count != null || lastRun.failed_count != null) && (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {t('xml_import_stats')}: <span className="text-foreground">{lastRun.created_count ?? 0}</span>
                    {' / '}<span className="text-foreground">{lastRun.updated_count ?? 0}</span>
                    {' / '}<span className={lastRun.failed_count ? 'text-destructive' : 'text-foreground'}>{lastRun.failed_count ?? 0}</span>
                  </div>
                )}
                {lastRun?.error && (
                  <div className="mt-1.5 text-xs text-destructive line-clamp-2">{lastRun.error}</div>
                )}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {supplier ? t('save_changes') : t('create')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};
