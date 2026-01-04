import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMenuService, UserMenuItem } from "@/lib/user-menu-service";
import { UserProfile } from "@/lib/user-auth-schemas";
import { useI18n } from "@/i18n";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { Button } from "@/components/ui/button";
import { Edit3, Copy, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FullPageLoader } from "@/components/LoadingSkeletons";

interface UserDashboardContextType {
  user: UserProfile;
  menuItems: UserMenuItem[];
  onMenuUpdate: () => void;
}

const UserMenuContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, menuItems, onMenuUpdate } = useOutletContext<UserDashboardContextType>();
  const { t } = useI18n();
  const [menuItem, setMenuItem] = useState<UserMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMenuItem = async () => {
      if (!id) {
        setError("No menu item ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const menuId = Number(id);
        if (!Number.isFinite(menuId)) {
          setError("Invalid menu item ID");
          return;
        }

        const fromContext = menuItems.find((m) => m.id === menuId) ?? null;
        if (!fromContext) {
          setError("Menu item not found");
          return;
        }
        setMenuItem(fromContext);
      } catch (err) {
        console.error("Error loading menu item:", err);
        setError("Failed to load menu item");
        toast.error(t("failed_load_menu_item"));
      } finally {
        setLoading(false);
      }
    };

    loadMenuItem();
  }, [id, menuItems, t]);

  const handleEdit = () => {
    toast.error("Menu management is no longer available");
  };

  const handleDuplicate = async () => {
    if (!menuItem) return;
    
    try {
      await UserMenuService.duplicateMenuItem(menuItem.id, user.id);
      onMenuUpdate();
      toast.success(t("menu_item_duplicated"));
    } catch (err) {
      console.error("Error duplicating menu item:", err);
      toast.error(t("failed_duplicate_menu_item"));
    }
  };

  const handleDelete = async () => {
    if (!menuItem) return;
    
    try {
      await UserMenuService.deleteMenuItem(menuItem.id, user.id);
      onMenuUpdate();
      navigate("/user/dashboard");
      toast.success(t("menu_item_deleted"));
    } catch (err) {
      console.error("Error deleting menu item:", err);
      toast.error(t("failed_delete_menu_item"));
    }
  };

  if (loading) {
    return (
      <FullPageLoader
        title="Завантаження сторінки…"
        subtitle="Готуємо налаштування меню"
        icon={Edit3}
      />
    );
  }

  if (error || !menuItem) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("error")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || t("menu_item_not_found")}</p>
            <div className="mt-4">
              <p className="text-muted-foreground">{t("menu_management_not_available")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <DynamicIcon 
            name={menuItem.icon_name || "FileText"} 
            className="h-8 w-8 text-emerald-600" 
          />
          <div>
            <h1 className="text-2xl font-bold">{menuItem.title}</h1>
            <p className="text-sm text-muted-foreground">{menuItem.description || t("no_description")}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit3 className="h-4 w-4 mr-2" />
            {t("edit")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            {t("duplicate")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive border-destructive/20 hover:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" />
            {t("delete")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("content")}</CardTitle>
        </CardHeader>
        <CardContent>
          {menuItem.page_type === 'content' && menuItem.content_data ? (
            <div className="prose max-w-none">
              {menuItem.content_data.content ? (
                <div dangerouslySetInnerHTML={{ __html: menuItem.content_data.content }} />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t("no_content_available")}</p>
                  <div className="mt-4">
                    <Button onClick={handleEdit}>
                      {t("add_content")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : menuItem.page_type === 'form' ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">{t("configure_form_fields_in_admin")}</p>
              {(() => {
                const formConfig = menuItem.content_data?.form_config as { fields?: Array<{ label: string; type: string; placeholder?: string; options?: Array<{ value: string; label: string }> }>; submitAction?: string } | undefined;
                const fields = formConfig?.fields;
                if (fields && fields.length > 0) {
                  return (
                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <div key={index} className="border p-4 rounded-lg">
                          <label className="block font-medium mb-2">{field.label}</label>
                          {field.type === 'text' && <Input type="text" placeholder={field.placeholder} />}
                          {field.type === 'email' && <Input type="email" placeholder={field.placeholder} />}
                          {field.type === 'textarea' && <Textarea placeholder={field.placeholder} />}
                          {field.type === 'select' && (
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((option, optIndex) => (
                                  <SelectItem key={optIndex} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                      <Button>{formConfig?.submitAction || t("submit")}</Button>
                    </div>
                  );
                }
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t("no_form_fields_defined")}</p>
                    <div className="mt-4">
                      <Button onClick={handleEdit}>
                        {t("configure_form")}
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : menuItem.page_type === 'list' ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">{t("displaying_data_from_api_source")}</p>
              {(() => {
                const tableConfig = menuItem.content_data?.table_config as { columns?: Array<{ label: string; key: string }> } | undefined;
                const columns = tableConfig?.columns;
                if (columns && columns.length > 0) {
                  return (
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            {columns.map((column, index) => (
                              <th key={index} className="text-left p-4 font-medium">{column.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t">
                            {columns.map((column, index) => (
                              <td key={index} className="p-4">{t("sample_data")}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                }
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t("no_columns_defined")}</p>
                    <div className="mt-4">
                      <Button onClick={handleEdit}>
                        {t("configure_table")}
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : menuItem.page_type === 'dashboard' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const widgets = menuItem.content_data?.widgets as Array<{ title: string; type: string }> | undefined;
                return widgets?.map((widget, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle>{widget.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{t("widget_content_placeholder") + " " + widget.type}</p>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">{t("custom_page_with_custom_components")}</p>
              {(() => {
                const content = menuItem.content_data?.content as string | undefined;
                return content ? (
                  <div className="prose max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserMenuContent;
