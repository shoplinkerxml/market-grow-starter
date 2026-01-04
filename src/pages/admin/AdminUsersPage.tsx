import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Filter, Download } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { PageHeader } from "@/components/PageHeader";
import { useBreadcrumbs, usePageInfo } from "@/hooks/useBreadcrumbs";
import { useUsers, useToggleUserStatus, usePrefetchUsers } from "@/hooks/useUsers";
import { FullPageLoader } from "@/components/LoadingSkeletons";
import { Users } from "lucide-react";

interface UserFilters {
  search: string;
  status: "all" | "active" | "inactive";
  role: "user" | "admin" | "manager" | "all";
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "user" | "admin" | "manager";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

export default function AdminUsersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const pageInfo = usePageInfo();
  
  // State management
  const [filters, setFilters] = useState<UserFilters>({
    search: "",
    status: "all",
    role: "user", // Show only users by default (changed from "all")
    sortBy: "created_at",
    sortOrder: "desc",
  });
  
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
  });
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Data fetching
  const { data: usersData, isLoading, error, refetch } = useUsers(filters, pagination);
  const toggleUserStatusMutation = useToggleUserStatus();
  
  // Prefetch next page
  const prefetchUsers = usePrefetchUsers();
  
  // Prefetch next page when current page loads
  
  // Handle initial load
  useEffect(() => {
    if (!isLoading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isLoading, isInitialLoad]);
  
  // Event handlers
  const handleCreateUser = () => {
    setShowCreateDialog(true);
  };
  
  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };
  
  const handleDeleteUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };
  
  const handleViewUserDetails = (user: UserProfile) => {
    navigate(`/admin/users/${user.id}`);
  };
  
  const handleStatusToggle = async (userId: string, newStatus: "active" | "inactive") => {
    try {
      await toggleUserStatusMutation.mutateAsync({ id: userId, status: newStatus });
      // The mutation will handle cache invalidation and success/error messages
    } catch (error) {
      console.error("Toggle status error:", error);
      // Error handling is done by the mutation
    }
  };
  
  const handleRefresh = () => {
    refetch();
  };
  
  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  const handleFilterChange = (key: keyof UserFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  const handlePaginationChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };
  
  const handleExport = () => {
    // Export functionality will be implemented
  };
  
  // Close dialog handlers
  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    refetch();
  };
  
  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setSelectedUser(null);
    refetch();
  };
  
  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false);
    setSelectedUser(null);
    refetch();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header with Breadcrumbs */}
      <PageHeader
        title={pageInfo.title}
        description={pageInfo.description}
        breadcrumbItems={breadcrumbs}
        actions={
          <Button
            onClick={handleCreateUser}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("add_user")}
          </Button>
        }
      />
      
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("filters_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              <option value="all">{t("filter_all_status")}</option>
              <option value="active">{t("status_active")}</option>
              <option value="inactive">{t("status_inactive")}</option>
            </select>
            
            {/* Role Filter */}
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange("role", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              <option value="user">{t("role_user")}</option>
              <option value="admin">{t("role_admin")}</option>
              <option value="manager">{t("role_manager")}</option>
              <option value="all">{t("filter_all_roles")}</option>
            </select>
            
            {/* Sort Options */}
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-");
                setFilters(prev => ({ ...prev, sortBy, sortOrder: sortOrder as "asc" | "desc" }));
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              <option value="created_at-desc">{t("sort_newest_first")}</option>
              <option value="created_at-asc">{t("sort_oldest_first")}</option>
              <option value="name-asc">{t("sort_name_az")}</option>
              <option value="name-desc">{t("sort_name_za")}</option>
              <option value="email-asc">{t("sort_email_az")}</option>
              <option value="email-desc">{t("sort_email_za")}</option>
            </select>
            
            <Button variant="outline" onClick={handleRefresh}>
              <Filter className="mr-2 h-4 w-4" />
              {t("refresh")}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && isInitialLoad ? (
            <FullPageLoader title="Завантаження…" subtitle={t("sidebar_users") || "Користувачі"} icon={Users} />
          ) : (
            <UsersTable
              users={usersData?.users || []}
              loading={isLoading && !isInitialLoad}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              onViewUserDetails={handleViewUserDetails}
              onStatusToggle={handleStatusToggle}
              statusToggleLoading={toggleUserStatusMutation.isPending}
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onSort={(column) => {
                const newOrder = filters.sortBy === column && filters.sortOrder === "asc" ? "desc" : "asc";
                setFilters(prev => ({ ...prev, sortBy: column, sortOrder: newOrder }));
              }}
            />
          )}
        </CardContent>
      </Card>
      
      {/* Pagination */}
      {usersData && usersData.total > pagination.limit && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="text-sm text-muted-foreground">
              {t("showing_users")} {(pagination.page - 1) * pagination.limit + 1} {t("to")}{" "}
              {Math.min(pagination.page * pagination.limit, usersData.total)} {t("of")}{" "}
              {usersData.total} {t("users_total")}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePaginationChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                {t("previous")}
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(usersData.total / pagination.limit) })
                  .slice(
                    Math.max(0, pagination.page - 3),
                    Math.min(Math.ceil(usersData.total / pagination.limit), pagination.page + 2)
                  )
                  .map((_, i) => {
                    const pageNum = Math.max(0, pagination.page - 3) + i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePaginationChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePaginationChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(usersData.total / pagination.limit)}
              >
                {t("next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Dialogs */}
      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />
      
      {selectedUser && (
        <EditUserDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          user={selectedUser}
          onSuccess={handleEditSuccess}
        />
      )}
      
      {selectedUser && (
        <DeleteUserDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          user={selectedUser}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
