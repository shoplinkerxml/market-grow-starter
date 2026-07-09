import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { XmlMappingService } from "@/lib/xml-mapping-service";
import {
  DEFAULT_YML_MAPPING,
  type XmlMapping,
} from "@/lib/xml-mapping-defaults";

export default function SupplierMapping() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<XmlMapping>(DEFAULT_YML_MAPPING);
  const [advancedText, setAdvancedText] = useState<string>("");
  const [advancedError, setAdvancedError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(supplierId)) return;
    let cancelled = false;
    setLoading(true);
    XmlMappingService.getActive(supplierId)
      .then((row) => {
        if (cancelled) return;
        const m = XmlMappingService.toMapping(row);
        setMapping(m);
        setAdvancedText(JSON.stringify(m, null, 2));
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supplierId]);

  const fieldRows = useMemo(
    () => [
      { key: "name", label: t("xml_map_field_name") },
      { key: "name_ua", label: t("xml_map_field_name_ua") },
      { key: "description", label: t("xml_map_field_description") },
      { key: "price", label: t("xml_map_field_price") },
      { key: "price_old", label: t("xml_map_field_price_old") },
      { key: "currency_code", label: t("xml_map_field_currency_code") },
      { key: "vendor", label: t("xml_map_field_vendor") },
      { key: "article", label: t("xml_map_field_article") },
      { key: "category_external_id", label: t("xml_map_field_category") },
      { key: "stock_quantity", label: t("xml_map_field_stock") },
    ] as const,
    [t],
  );

  const fieldValueToString = (v: unknown): string => {
    if (!v) return "";
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  };

  const stringToFieldValue = (s: string) => {
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return parts;
  };

  const updateField = (key: string, value: string) => {
    setMapping((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: stringToFieldValue(value) },
    }));
  };

  const syncAdvanced = () => {
    setAdvancedText(JSON.stringify(mapping, null, 2));
    setAdvancedError(null);
  };

  const applyAdvanced = () => {
    try {
      const parsed = JSON.parse(advancedText) as XmlMapping;
      if (!parsed.xpath_item || !parsed.fields) {
        throw new Error("xpath_item and fields are required");
      }
      setMapping(parsed);
      setAdvancedError(null);
      toast.success(t("xml_map_advanced_applied"));
    } catch (e) {
      setAdvancedError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReset = () => {
    setMapping(DEFAULT_YML_MAPPING);
    setAdvancedText(JSON.stringify(DEFAULT_YML_MAPPING, null, 2));
    setAdvancedError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await XmlMappingService.saveMapping(supplierId, mapping);
      toast.success(t("xml_map_saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!Number.isFinite(supplierId)) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{t("xml_map_invalid_supplier")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/user/suppliers")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("back")}
        </Button>
        <h1 className="text-2xl font-semibold">{t("xml_map_title")}</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("xml_map_root_section")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("xml_map_item_tag")}</Label>
                  <Input
                    value={mapping.xpath_item}
                    onChange={(e) => setMapping({ ...mapping, xpath_item: e.target.value })}
                    placeholder="offer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("xml_map_default_currency")}</Label>
                  <Input
                    value={mapping.currency ?? ""}
                    onChange={(e) => setMapping({ ...mapping, currency: e.target.value || null })}
                    placeholder="UAH"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("xml_map_fields_section")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("xml_map_fields_hint")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldRows.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <Label className="text-sm">{row.label}</Label>
                    <Input
                      value={fieldValueToString((mapping.fields as Record<string, unknown>)[row.key])}
                      onChange={(e) => updateField(row.key, e.target.value)}
                      placeholder={row.key}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("xml_map_images_params_section")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("xml_map_image_tag")}</Label>
                <Input
                  value={mapping.images.tag}
                  onChange={(e) =>
                    setMapping({ ...mapping, images: { ...mapping.images, tag: e.target.value } })
                  }
                  placeholder="picture"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xml_map_param_tag")}</Label>
                <Input
                  value={mapping.params.tag}
                  onChange={(e) =>
                    setMapping({ ...mapping, params: { ...mapping.params, tag: e.target.value } })
                  }
                  placeholder="param"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xml_map_param_name_attr")}</Label>
                <Input
                  value={mapping.params.name_attr}
                  onChange={(e) =>
                    setMapping({ ...mapping, params: { ...mapping.params, name_attr: e.target.value } })
                  }
                  placeholder="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xml_map_param_unit_attr")}</Label>
                <Input
                  value={mapping.params.unit_attr ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, params: { ...mapping.params, unit_attr: e.target.value } })
                  }
                  placeholder="unit"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{t("xml_map_advanced_section")}</span>
                <Button type="button" variant="ghost" size="sm" onClick={syncAdvanced}>
                  {t("xml_map_sync_from_form")}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={advancedText}
                onChange={(e) => setAdvancedText(e.target.value)}
                className="font-mono text-xs min-h-[240px]"
              />
              {advancedError && (
                <p className="text-sm text-destructive">{advancedError}</p>
              )}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={applyAdvanced}>
                  {t("xml_map_apply_json")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("xml_map_reset")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t("save")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
