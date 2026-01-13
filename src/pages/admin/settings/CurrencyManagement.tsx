import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Plus, Edit3, Trash2, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs, usePageInfo } from "@/hooks/useBreadcrumbs";
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { PersistentCacheService } from "@/lib/persistent-cache-service";
import { invalidateTariffsCache } from "@/lib/tariff-cache";

interface Currency {
  id: number;
  code: string;
  name: string;
  rate: number;
  status: boolean | null;
  is_base: boolean | null;
}

const CurrencyManagement = () => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();
  
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    rate: 1,
    status: true,
  });

  const loadCurrencies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('code');

      if (error) {
        console.error("Error loading currencies:", error);
        toast.error(t("failed_load_currencies"));
        return;
      }

      // Sort currencies to show base currency first
      const sortedCurrencies = (data || []).sort((a, b) => {
        // Base currency first
        if (a.is_base && !b.is_base) return -1;
        if (!a.is_base && b.is_base) return 1;
        // Then by code for other currencies
        return a.code.localeCompare(b.code);
      });

      setCurrencies(sortedCurrencies);
    } catch (error) {
      console.error("Error loading currencies:", error);
      toast.error(t("failed_load_currencies"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  const handleCreateCurrency = () => {
    setEditingCurrency(null);
    setFormData({
      code: "",
      name: "",
      rate: 1,
      status: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditCurrency = (currency: Currency) => {
    setEditingCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      rate: currency.rate,
      status: currency.status ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteCurrency = async (currency: Currency) => {
    if (currency.is_base) {
      toast.error(t("cannot_delete_base_currency"));
      return;
    }

    try {
      const { error } = await supabase
        .from('currencies')
        .delete()
        .eq('id', currency.id);

      if (error) {
        console.error("Error deleting currency:", error);
        toast.error(t("failed_delete_currency"));
        return;
      }

      try {
        PersistentCacheService.invalidateCurrencies();
      } catch {
        void 0;
      }
      try {
        PersistentCacheService.invalidateTariffs();
      } catch {
        void 0;
      }
      try {
        invalidateTariffsCache();
      } catch {
        void 0;
      }

      await loadCurrencies();
      toast.success(t("currency_deleted"));
    } catch (error) {
      console.error("Error deleting currency:", error);
      toast.error(t("failed_delete_currency"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCurrency) {
        // Update existing currency
        const { error } = await supabase
          .from('currencies')
          .update({
            code: formData.code,
            name: formData.name,
            rate: formData.rate,
            status: formData.status,
          })
          .eq('id', editingCurrency.id);

        if (error) {
          console.error("Error updating currency:", error);
          if (error.message?.includes('unique')) {
            toast.error(t("currency_code_exists"));
          } else {
            toast.error(t("failed_update_currency"));
          }
          return;
        }

        toast.success(t("currency_updated"));
      } else {
        // Create new currency
        const { error } = await supabase
          .from('currencies')
          .insert({
            code: formData.code,
            name: formData.name,
            rate: formData.rate,
            status: formData.status,
          });

        if (error) {
          console.error("Error creating currency:", error);
          if (error.message?.includes('unique')) {
            toast.error(t("currency_code_exists"));
          } else {
            toast.error(t("failed_create_currency"));
          }
          return;
        }

        toast.success(t("currency_created"));
      }
      
      try {
        PersistentCacheService.invalidateCurrencies();
      } catch {
        void 0;
      }
      try {
        PersistentCacheService.invalidateTariffs();
      } catch {
        void 0;
      }
      try {
        invalidateTariffsCache();
      } catch {
        void 0;
      }

      setIsDialogOpen(false);
      await loadCurrencies();
    } catch (error: any) {
      console.error("Error saving currency:", error);
      toast.error(editingCurrency ? t("failed_update_currency") : t("failed_create_currency"));
    }
  };

  const handleStatusToggle = async (currency: Currency) => {
    try {
      const { error } = await supabase
        .from('currencies')
        .update({ status: !currency.status })
        .eq('id', currency.id);

      if (error) {
        console.error("Error updating currency status:", error);
        toast.error(t("failed_update_currency_status"));
        return;
      }

      try {
        PersistentCacheService.invalidateCurrencies();
      } catch {
        void 0;
      }
      try {
        PersistentCacheService.invalidateTariffs();
      } catch {
        void 0;
      }
      try {
        invalidateTariffsCache();
      } catch {
        void 0;
      }

      await loadCurrencies();
      toast.success(t("currency_status_updated"));
    } catch (error) {
      console.error("Error updating currency status:", error);
      toast.error(t("failed_update_currency_status"));
    }
  };

  if (loading) {
    return (
      <FullPageLoader
        title="Завантаження валют…"
        subtitle={t("currency_management_description")}
        icon={Banknote}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={pageInfo.title}
        description={t('currency_management_description')}
        breadcrumbItems={breadcrumbs}
        actions={
          <Button onClick={handleCreateCurrency}>
            <Plus className="h-4 w-4 mr-2" />
            {t("add_currency")}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("currency_code")}</TableHead>
                <TableHead>{t("currency_name")}</TableHead>
                <TableHead>{t("currency_rate")}</TableHead>
                <TableHead>{t("currency_status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-medium">
                    {currency.code}
                    {currency.is_base && (
                      <Badge variant="secondary" className="ml-2">
                        {t("base_currency")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{currency.name}</TableCell>
                  <TableCell>{currency.rate.toFixed(4)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={currency.status ?? true}
                      onCheckedChange={() => handleStatusToggle(currency)}
                      disabled={!!currency.is_base}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCurrency(currency)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          {t("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteCurrency(currency)}
                          disabled={!!currency.is_base}
                          className={currency.is_base ? "text-muted-foreground cursor-not-allowed" : "text-destructive"}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {currencies.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("no_currencies_found")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent noOverlay>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              {editingCurrency ? t("edit_currency") : t("add_currency")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingCurrency ? t("edit_currency") : t("add_currency")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="code">{t("currency_code")}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder={t("enter_currency_code")}
                maxLength={10}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="name">{t("currency_name")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("enter_currency_name")}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="rate">{t("currency_rate")}</Label>
              <Input
                id="rate"
                type="number"
                step="0.0001"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                placeholder={t("enter_exchange_rate")}
                required
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="status">{t("status_active")}</Label>
              <Switch
                id="status"
                checked={formData.status}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked })}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("btn_cancel")}
              </Button>
              <Button type="submit">
                {editingCurrency ? t("btn_update") : t("btn_create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CurrencyManagement;
