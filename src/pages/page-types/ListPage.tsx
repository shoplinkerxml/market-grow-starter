import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, CreditCard, Star, Crown, Package, Edit, Trash2, Copy } from "lucide-react";
import { TariffService } from "@/lib/tariff-service";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { PageHeader as PageHeaderComponent, ActionButton, PageCardHeader } from "@/components/page-header";
import { useBreadcrumbs, usePageInfo } from "@/hooks/useBreadcrumbs";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { FullPageLoader } from "@/components/LoadingSkeletons";

interface ListPageProps {
  config: any;
  title: string;
}

interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'badge' | 'boolean';
  sortable?: boolean;
}

interface TableData {
  [key: string]: any;
}

const defaultColumns: TableColumn[] = [
  { key: 'icon', label: 'tariff_icon', type: 'text' },
  { key: 'name', label: 'tariff_name', type: 'text', sortable: true },
  { key: 'new_price', label: 'tariff_price', type: 'number', sortable: true },
  { key: 'duration_days', label: 'tariff_term', type: 'number', sortable: true },
  { key: 'is_active', label: 'tariff_status', type: 'badge', sortable: true },
  { key: 'actions', label: 'tariff_actions', type: 'text' }
];

const defaultData: TableData[] = [
  { id: 1, name: 'Basic Plan', new_price: 0, duration_days: 30, is_free: true, is_active: true, created_at: '2024-01-15' },
  { id: 2, name: 'Pro Plan', new_price: 19.99, duration_days: 30, is_free: false, is_active: true, created_at: '2024-01-20' },
  { id: 3, name: 'Enterprise Plan', new_price: 49.99, duration_days: 365, is_free: false, is_active: false, created_at: '2024-01-25' }
];

export const ListPage = ({ config, title }: ListPageProps) => {
  const { t } = useI18n();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();
  
  const columns: TableColumn[] = config?.table_config?.columns || defaultColumns;
  const [data, setData] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = config?.table_config?.itemsPerPage || 10;

  // Fetch tariff data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Check if this is a tariff page by looking at the path or title
        if (title === 'Тарифні плани' || title === 'Tariff Plans' || title === 'Tariff Management' || (config?.path === 'tariff' || config?.data === undefined)) {
          const tariffData = await TariffService.getAllTariffs(true, true); // Include inactive and demo for admin
          setData(tariffData);
        } else {
          setData(config?.data || defaultData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(t('failed_load_currencies'));
        setData(config?.data || defaultData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [config, title, t]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Search filter
    if (searchTerm) {
      filtered = data.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Sort
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const getTariffIcon = (row: TableData) => {
    if (row.is_free) return <Package className="h-5 w-5" />;
    if (row.is_lifetime) return <Crown className="h-5 w-5" />;
    if (row.new_price && row.new_price > 50) return <Star className="h-5 w-5" />;
    return <CreditCard className="h-5 w-5" />;
  };

  const getCurrencyIcon = (currencyCode: string) => {
    return null;
  };

  const renderCellValue = (value: any, column: TableColumn, row: TableData) => {
    // Special handling for tariff icons
    if (column.key === 'icon') {
      return getTariffIcon(row);
    }
    
    // Special handling for tariff actions
    if (column.key === 'actions') {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="dropdown-item-hover">
              <Edit className="mr-2 h-4 w-4" />
              <span>{t('edit_tariff')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="dropdown-item-hover">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>{t('delete_tariff')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="dropdown-item-hover">
              <Copy className="mr-2 h-4 w-4" />
              <span>{t('duplicate_tariff')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    switch (column.type) {
      case 'badge':
        // Special handling for tariff status
        if (column.key === 'is_active') {
          const variant = value ? 'default' : 'secondary';
          const label = value ? t('status_active') : t('status_inactive');
          return <Badge variant={variant} className={value ? 'badge-active' : ''}>{label}</Badge>;
        }
        
        const getVariant = (status: string) => {
          switch (status.toLowerCase()) {
            case 'active': return 'default';
            case 'inactive': return 'secondary';
            case 'pending': return 'outline';
            default: return 'outline';
          }
        };
        return <Badge variant={getVariant(value)} className={value === 'active' ? 'badge-active' : ''}>{value}</Badge>;
      
      case 'boolean':
        return <Badge variant={value ? 'default' : 'secondary'} className={value ? 'badge-active' : ''}>{value ? 'Yes' : 'No'}</Badge>;
      
      case 'date':
        return new Date(value).toLocaleDateString();
      
      case 'number':
        // Special handling for tariff prices
        if (column.key === 'new_price') {
          if (row.is_free) {
            return <Badge variant="secondary">{t('free_tariff')}</Badge>;
          }
          if (value !== null && value !== undefined) {
            // Use currency code from the related currencies table
            const currencyCode = row.currency_data?.code || 'USD';
            return (
              <div className="flex items-center">
                <span>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currencyCode,
                  }).format(value)}
                </span>
              </div>
            );
          }
          return 'N/A';
        }
        
        // Special handling for tariff duration
        if (column.key === 'duration_days') {
          if (row.is_lifetime) return t('lifetime_tariff');
          if (value !== null && value !== undefined) return `${value} ${t('days_tariff')}`;
          return 'N/A';
        }
        
        return typeof value === 'number' ? value.toLocaleString() : value;
      
      default:
        return value;
    }
  };

  // Check if this is a tariff management page
  const isTariffPage = title === 'Тарифні плани' || title === 'Tariff Plans' || title === 'Tariff Management' || title === 'menu_pricing' || config?.path === 'tariff';

  if (loading) {
    return (
      <FullPageLoader
        title={isTariffPage ? "Завантаження тарифів…" : "Завантаження списку…"}
        subtitle={isTariffPage ? t("tariff_plans_description") : pageInfo.description}
        icon={isTariffPage ? CreditCard : Package}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbs} />
        
        {/* Title and Actions */}
        <PageHeaderComponent
          title={isTariffPage ? t('menu_pricing') : pageInfo.title}
          description={isTariffPage ? t('tariff_plans_description') : pageInfo.description}
          actions={
            isTariffPage ? (
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('add_new_tariff')}
              </Button>
            ) : null
          }
        />
      </div>
      
      <Card>
        <CardContent className="p-0">
          {/* Search and Filter Bar */}

          {/* Data Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={column.sortable ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => column.sortable && handleSort(column.key)}
                    >
                      <div className="flex items-center gap-2">
                        {t(column.label as any)}
                        {column.sortable && sortColumn === column.key && (
                          <span className="text-xs">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                      {t('no_tariffs_found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row, index) => (
                    <TableRow key={row.id || index}>
                      {columns.map((column) => (
                        <TableCell key={column.key}>
                          {renderCellValue(row[column.key], column, row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {t('showing_tariffs')} {(currentPage - 1) * itemsPerPage + 1} {t('to_tariff')}{' '}
                {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} {t('of_tariff')}{' '}
                {filteredAndSortedData.length} {t('results_tariff')}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  {t('previous_tariff')}
                </Button>
                <span className="text-sm px-2">
                  {t('page_tariff')} {currentPage} {t('of_tariff')} {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  {t('next_tariff')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
