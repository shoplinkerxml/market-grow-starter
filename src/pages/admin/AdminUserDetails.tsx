import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Crown, CreditCard, AlertCircle, MoreHorizontal, Plus, Trash2, XCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { TariffService, type TariffWithDetails } from "@/lib/tariff-service";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { FullPageLoader } from "@/components/LoadingSkeletons";
interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  status: string;
  created_at: string;
  avatar_url?: string;
}
interface Subscription {
  id: number;
  tariff_id: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  tariffs: {
    name: string;
    new_price: number | null;
    is_lifetime: boolean;
    duration_days: number | null;
    currency_data: {
      code: string;
      symbol: string;
    };
  };
}
interface Tariff {
  id: number;
  name: string;
  new_price: number | null;
  duration_days: number | null;
  is_lifetime: boolean;
  is_popular: boolean;
  currency: {
    code: string;
    symbol: string;
  };
}
const AdminUserDetails = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const {
    t
  } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<Subscription[]>([]);
  const [availableTariffs, setAvailableTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const breadcrumbs: BreadcrumbItem[] = [{
    label: t('menu_main') || 'Головна',
    href: '/admin/dashboard'
  }, {
    label: t('menu_users') || 'Користувачі',
    href: '/admin/users'
  }, {
    label: user?.name || '...',
    current: true
  }];
  
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);

      // Load user profile
      const {
        data: profile,
        error: profileError
      } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (profileError) throw profileError;
      setUser(profile);

      // Load active subscription
      // Load active subscription
      const { data: activeSub, error: activeSubError } = await supabase
        .from('user_subscriptions')
        .select('id,user_id,tariff_id,start_date,end_date,is_active,tariffs(id,name,new_price,is_lifetime,duration_days,currency_id)')
        .eq('user_id', id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (activeSubError) {
        console.error('Active subscription error:', activeSubError);
      }
      
      // Load currency for active subscription
      if (activeSub?.tariffs) {
        const tariffData = activeSub.tariffs as any;
        if (tariffData.currency_id) {
          const { data: currency, error: currencyError } = await supabase
            .from('currencies')
            .select('code')
            .eq('id', tariffData.currency_id)
            .single();
          
          if (!currencyError && currency) {
            const symbolMap: Record<string, string> = {
              'USD': '$',
              'EUR': '€',
              'GBP': '£',
              'UAH': '₴'
            };
            tariffData.currency_data = {
              code: currency.code,
              symbol: symbolMap[currency.code] || currency.code
            };
          } else {
            console.error('Currency error:', currencyError);
            tariffData.currency_data = { code: 'UAH', symbol: '₴' };
          }
        } else {
          tariffData.currency_data = { code: 'UAH', symbol: '₴' };
        }
      }
      
      setActiveSubscription(activeSub as any);

      // Load subscription history
      const { data: history, error: historyError } = await supabase
        .from('user_subscriptions')
        .select('id,user_id,tariff_id,start_date,end_date,is_active,tariffs(name,new_price,is_lifetime,duration_days,currency_id)')
        .eq('user_id', id)
        .order('start_date', { ascending: false });
      
      if (historyError) {
        console.error('Subscription history error:', historyError);
        setSubscriptionHistory([]);
      } else if (history && history.length > 0) {
        // Load currencies for all subscriptions
        const historyWithCurrency = await Promise.all(
          history.map(async (sub: any) => {
            if (sub.tariffs?.currency_id) {
              const { data: currency } = await supabase
                .from('currencies')
                .select('code')
                .eq('id', sub.tariffs.currency_id)
                .single();
              
              // Add symbol based on code
              const symbolMap: Record<string, string> = {
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'UAH': '₴'
              };
              
              sub.tariffs.currency_data = {
                code: currency?.code || 'UAH',
                symbol: symbolMap[currency?.code || 'UAH'] || currency?.code || '₴'
              };
            } else {
              sub.tariffs.currency_data = { code: 'UAH', symbol: '₴' };
            }
            return sub;
          })
        );
        setSubscriptionHistory(historyWithCurrency);
      } else {
        setSubscriptionHistory([]);
      }

      // Load all available tariffs via service with includeDemo for admin
      const rows: TariffWithDetails[] = await TariffService.getTariffsAggregated(true, true);
      const symbolMap: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'UAH': '₴' };
      const tariffsWithCurrency = (rows || []).map((t: TariffWithDetails) => ({
        id: t.id,
        name: t.name,
        new_price: t.new_price,
        duration_days: t.duration_days,
        is_lifetime: t.is_lifetime,
        is_popular: t.popular === true,
        currency: {
          code: (t.currency_data?.code || t.currency_code || 'USD'),
          symbol: symbolMap[(t.currency_data?.code || t.currency_code || 'USD')] || '$'
        }
      }));
      setAvailableTariffs(tariffsWithCurrency);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadUserData();
    }
  }, [id, loadUserData]);
  
  // Handle tariff activation
  const handleActivateTariff = async (tariffId: number) => {
    if (!id) return;
    
    try {
      // 1. Деактивируем все активные подписки пользователя
      const { error: deactivateError } = await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('user_id', id)
        .eq('is_active', true);
      
      if (deactivateError) {
        console.error('Deactivate error:', deactivateError);
        toast.error(t('failed_update_tariff') || 'Не вдалося оновити тариф');
        return;
      }
      
      // 2. Получаем duration_days выбранного тарифа
      const { data: tariffData, error: tariffError } = await supabase
        .from('tariffs')
        .select('duration_days,is_lifetime')
        .eq('id', tariffId)
        .single();
      
      if (tariffError) {
        console.error('Tariff fetch error:', tariffError);
        toast.error(t('failed_update_tariff') || 'Не вдалося оновити тариф');
        return;
      }
      
      // 3. Рассчитываем даты
      const start = new Date();
      let endDate: string | null = null;
      
      // Если тариф не lifetime и есть duration_days, рассчитываем end_date
      if (!tariffData.is_lifetime && tariffData.duration_days) {
        endDate = new Date(start.getTime() + tariffData.duration_days * 24 * 60 * 60 * 1000).toISOString();
      }
      
      // 4. Создаем новую активную подписку
      const { data: newSub, error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: id,
          tariff_id: tariffId,
          start_date: start.toISOString(),
          end_date: endDate,
          is_active: true
        })
        .select('id,user_id,tariff_id,start_date,end_date,is_active,tariffs(id,name,new_price,is_lifetime,duration_days,currency_id)')
        .single();
      
      if (insertError) {
        console.error('Insert subscription error:', insertError);
        toast.error(t('failed_update_tariff') || 'Не вдалося оновити тариф');
        return;
      }
      
      toast.success(t('tariff_updated_successfully') || 'Тариф успішно оновлено');
      try { queryClient.invalidateQueries({ queryKey: ['shopLimit'] }); } catch { void 0; }
      
      // 5. Обновляем только состояние подписок без полной перезагрузки
      // Обновляем активную подписку
      if (newSub?.tariffs) {
        const tariffData = newSub.tariffs as any;
        if (tariffData.currency_id) {
          const { data: currency } = await supabase
            .from('currencies')
            .select('code')
            .eq('id', tariffData.currency_id)
            .single();
          
          const symbolMap: Record<string, string> = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'UAH': '₴'
          };
          
          tariffData.currency_data = {
            code: currency?.code || 'UAH',
            symbol: symbolMap[currency?.code || 'UAH'] || '₴'
          };
        } else {
          tariffData.currency_data = { code: 'UAH', symbol: '₴' };
        }
        
        setActiveSubscription(newSub as any);
      }
      
      // Обновляем историю подписок
      setSubscriptionHistory(prev => 
        prev.map(sub => ({ ...sub, is_active: false })).concat(newSub as any)
      );
      
    } catch (error) {
      console.error('Activate tariff error:', error);
      toast.error(t('failed_update_tariff') || 'Не вдалося оновити тариф');
    }
  };
  
  // Handle tariff deactivation
  const handleDeactivateTariff = async (subscriptionId: number) => {
    if (!id) return;
    
    try {
      // Просто меняем is_active на false
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('id', subscriptionId);
      
      if (updateError) {
        console.error('Deactivate error:', updateError);
        toast.error(t('failed_update_tariff') || 'Не вдалося деактивувати тариф');
        return;
      }
      
      toast.success(t('tariff_deactivated_successfully') || 'Тариф успішно деактивовано');
      
      // Обновляем только состояние без полной перезагрузки
      setActiveSubscription(null);
      setSubscriptionHistory(prev => 
        prev.map(sub => 
          sub.id === subscriptionId ? { ...sub, is_active: false } : sub
        )
      );
      try { queryClient.invalidateQueries({ queryKey: ['shopLimit'] }); } catch { void 0; }
      
    } catch (error) {
      console.error('Deactivate tariff error:', error);
      toast.error(t('failed_update_tariff') || 'Не вдалося деактивувати тариф');
    }
  };
  
  // Handle subscription deletion
  const handleDeleteSubscription = async (subscriptionId: number, isActive: boolean) => {
    if (isActive) {
      toast.error(t('cannot_delete_active_subscription') || 'Не можна видалити активну підписку');
      return;
    }
    
    if (!id) return;
    
    try {
      const { error: deleteError } = await supabase
        .from('user_subscriptions')
        .delete()
        .eq('id', subscriptionId);
      
      if (deleteError) {
        console.error('Delete subscription error:', deleteError);
        toast.error(t('failed_delete_subscription') || 'Не вдалося видалити підписку');
        return;
      }
      
      toast.success(t('subscription_deleted_successfully') || 'Підписку успішно видалено');
      try { queryClient.invalidateQueries({ queryKey: ['shopLimit'] }); } catch { void 0; }
      
      // Обновляем только историю без полной перезагрузки
      setSubscriptionHistory(prev => 
        prev.filter(sub => sub.id !== subscriptionId)
      );
      
    } catch (error) {
      console.error('Delete subscription error:', error);
      toast.error(t('failed_delete_subscription') || 'Не вдалося видалити підписку');
    }
  };
  
  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'UAH': '₴'
    };
    return symbols[code] || code;
  };
  if (loading) {
    return (
      <FullPageLoader
        title={t("loading") || "Завантаження…"}
        subtitle={t("menu_users") || "Готуємо дані користувача"}
        icon={TrendingUp}
      />
    );
  }
  if (!user) {
    return <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Помилка</AlertTitle>
          <AlertDescription>Користувача не знайдено</AlertDescription>
        </Alert>
      </div>;
  }
  return <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbs} />

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Tariff Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('active_tariff') || 'Активний тариф'}
            </CardTitle>
            {activeSubscription?.tariffs.is_lifetime ? <Crown className="h-4 w-4" /> : <CreditCard className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSubscription ? activeSubscription.tariffs.name : t('no_tariff') || 'Немає'}
            </div>
            {activeSubscription?.tariffs.new_price && <p className="text-xs text-muted-foreground mt-1">
                {getCurrencySymbol(activeSubscription.tariffs.currency_data.code)}
                {activeSubscription.tariffs.new_price}
                {!activeSubscription.tariffs.is_lifetime && '/міс'}
              </p>}
            {activeSubscription?.end_date && <p className="text-xs text-muted-foreground mt-2">
                {t('end_date')}: {format(new Date(activeSubscription.end_date), 'dd.MM.yyyy')}
              </p>}
          </CardContent>
        </Card>

        {/* Empty cards for future data */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статистика 1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Дані будуть додані</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статистика 2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Дані будуть додані</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статистика 3</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Дані будуть додані</p>
          </CardContent>
        </Card>
      </div>

      {/* Visits Chart Placeholder */}
      

      {/* User Activity Chart */}
      <ChartAreaInteractive />

      {/* Available Tariffs Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('available_tariffs')}</h2>
          <p className="text-muted-foreground">
            {t('manage_user_subscriptions')}
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {availableTariffs.map(tariff => {
          const userSubscription = subscriptionHistory.find(sub => sub.tariff_id === tariff.id);
          const isActive = userSubscription?.is_active || false;
          return <Card key={tariff.id} className={isActive ? 'border-emerald-500 shadow-md' : ''}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {tariff.name}
                  </CardTitle>
                  {tariff.is_lifetime ? <Crown className="h-4 w-4" /> : <CreditCard className="h-4 w-4 text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tariff.new_price ? <>
                        {getCurrencySymbol(tariff.currency.code)}
                        {tariff.new_price}
                      </> : t('free') || 'Безкоштовно'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tariff.is_lifetime ? t('lifetime') || 'Безстроково' : `${tariff.duration_days} ${t('days') || 'днів'}`}
                  </p>
                  
                  {/* Subscription Status */}
                  <div className="mt-4 flex items-center gap-2">
                    {isActive ? <>
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Активна</span>
                      </> : userSubscription ? <>
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">Неактивна</span>
                      </> : <span className="text-sm text-muted-foreground">Не придбано</span>}
                  </div>
                  
                  {/* End Date if active */}
                  {isActive && userSubscription?.end_date && <p className="text-xs text-muted-foreground mt-2">
                      {t('end_date') || 'Закінчення'}: {format(new Date(userSubscription.end_date), 'dd.MM.yyyy')}
                    </p>}
                  
                  {/* Action Button */}
                  <Button 
                    className="w-full mt-4" 
                    variant={isActive ? 'outline' : 'default'} 
                    size="sm"
                    onClick={() => {
                      if (isActive && userSubscription) {
                        handleDeactivateTariff(userSubscription.id);
                      } else {
                        handleActivateTariff(tariff.id);
                      }
                    }}
                  >
                    {isActive ? <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Деактивувати
                      </> : <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Активувати
                      </>}
                  </Button>
                </CardContent>
              </Card>;
        })}
        </div>
      </div>

      {/* Subscription History Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription_history') || 'Історія підписок'}</CardTitle>
          <CardDescription>
            {t('subscription_history_desc') || 'Всі підписки користувача'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Іконка</TableHead>
                <TableHead>{t('tariff_name') || 'Назва тарифу'}</TableHead>
                <TableHead>{t('price') || 'Ціна'}</TableHead>
                <TableHead>{t('start_date') || 'Дата активації'}</TableHead>
                <TableHead>{t('end_date') || 'Дата закінчення'}</TableHead>
                <TableHead>{t('status') || 'Статус'}</TableHead>
                <TableHead className="text-right">{t('actions') || 'Дії'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptionHistory.length === 0 ? <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('no_subscriptions') || 'Немає підписок'}
                  </TableCell>
                </TableRow> : subscriptionHistory.map(sub => <TableRow key={sub.id}>
                    <TableCell>
                      {sub.tariffs.is_lifetime ? <Crown className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{sub.tariffs.name}</TableCell>
                    <TableCell>
                      {sub.tariffs.new_price ? <>
                          {getCurrencySymbol(sub.tariffs.currency_data.code)}
                          {sub.tariffs.new_price}
                        </> : t('free') || 'Безкоштовно'}
                    </TableCell>
                    <TableCell>{format(new Date(sub.start_date), 'dd.MM.yyyy')}</TableCell>
                    <TableCell>
                      {sub.end_date ? format(new Date(sub.end_date), 'dd.MM.yyyy') : t('lifetime') || 'Безстроково'}
                    </TableCell>
                    <TableCell>
                      {sub.is_active ? <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm">Активна</span>
                        </div> : <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="text-sm">Неактивна</span>
                        </div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            disabled={sub.is_active}
                            onClick={() => handleDeleteSubscription(sub.id, sub.is_active)}
                            className={sub.is_active ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('delete') || 'Видалити'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>;
};
export default AdminUserDetails;
