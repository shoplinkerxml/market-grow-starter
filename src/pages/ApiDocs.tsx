import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  Copy,
  Download,
  Edit,
  FileJson,
  Lock,
  Save,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { SUPABASE_URL } from "@/integrations/supabase/client";

interface ApiEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  description: string;
  headers?: Record<string, string>;
  body?: any;
  response: any;
  postmanScript?: string;
}

interface ApiPage {
  name: string;
  description?: string;
  endpoints: ApiEndpoint[];
}

interface ApiSection {
  name: string;
  pages: ApiPage[];
}

type SectionKey = "admin" | "user";

const methodColors: Record<ApiEndpoint["method"], string> = {
  GET: "bg-sky-500 text-white border-transparent hover:bg-sky-500",
  POST: "bg-emerald-500 text-white border-transparent hover:bg-emerald-500",
  PATCH: "bg-amber-500 text-white border-transparent hover:bg-amber-500",
  DELETE: "bg-rose-500 text-white border-transparent hover:bg-rose-500",
};

const getEndpointKey = (endpoint: ApiEndpoint) => {
  return `${endpoint.method} ${endpoint.endpoint} :: ${endpoint.name}`;
};

export default function ApiDocs() {
  const [customScripts, setCustomScripts] = useState<Record<string, string>>({});
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [settings, setSettings] = useState<{
    apiKey: string;
    accessToken: string;
    adminEmail: string;
    adminPassword: string;
  }>({
    apiKey: "",
    accessToken: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(SUPABASE_URL);
  const { toast } = useToast();
  const { t, lang, setLang } = useI18n();

  // Загружаем сохранённые скрипты и API ключ из localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('postman-scripts');
      if (saved) {
        setCustomScripts(JSON.parse(saved));
      }
      
      const savedApiKey = localStorage.getItem('supabase-apikey');
      const savedAccessToken = localStorage.getItem('access-token');
      const savedEmail = localStorage.getItem('admin-email');
      const savedPassword = localStorage.getItem('admin-password');
      
      setSettings({
        apiKey: savedApiKey || "",
        accessToken: savedAccessToken || "",
        adminEmail: savedEmail || "",
        adminPassword: savedPassword || "",
      });
    } catch (e) {
      console.warn('Не удалось загрузить данные из localStorage', e);
    }
  }, []);

  // Сохраняем скрипты в localStorage (функциональное обновление во избежание потери данных)
  const saveScripts = (updater: (prev: Record<string, string>) => Record<string, string>) => {
    setCustomScripts(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem('postman-scripts', JSON.stringify(next));
      } catch (e) {
        console.warn('Не удалось сохранить скрипты в localStorage', e);
      }
      return next;
    });
  };

  const updateScript = useCallback(
    (endpointKey: string, script: string) => {
      saveScripts((prev) => ({ ...prev, [endpointKey]: script }));
      toast({
        title: t("script_updated"),
        description: t("script_saved"),
        duration: 2000,
      });
    },
    [toast, t]
  );

  const getPostmanScript = useCallback(
    (endpoint: ApiEndpoint) => {
      const key = getEndpointKey(endpoint);
      const legacyKey = `${endpoint.method}-${endpoint.endpoint}`;
      return customScripts[key] || customScripts[legacyKey] || endpoint.postmanScript || "";
    },
    [customScripts]
  );

  const closeAuthDialog = useCallback(() => setAuthDialogOpen(false), []);
  const closeExportDialog = useCallback(() => setExportDialogOpen(false), []);

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      toast({
        title: t("copied"),
        description: t("copied_clipboard"),
        duration: 2000,
      });
    },
    [toast, t]
  );

  const handleCopyFromButtonData = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const text = e.currentTarget.dataset.copyText;
      if (!text) return;
      copyToClipboard(text);
    },
    [copyToClipboard]
  );

  const handleToggleEditingScript = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const endpointKey = e.currentTarget.dataset.endpointKey;
      if (!endpointKey) return;
      setEditingScript((prev) => (prev === endpointKey ? null : endpointKey));
    },
    []
  );

  const handleScriptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const endpointKey = e.currentTarget.dataset.endpointKey;
      if (!endpointKey) return;
      updateScript(endpointKey, e.target.value);
    },
    [updateScript]
  );

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setSettings((prev) => ({ ...prev, apiKey: value }));
      try {
        localStorage.setItem("supabase-apikey", value);
        toast({
          title: t("api_key_saved"),
          description: t("api_key_used"),
          duration: 2000,
        });
      } catch (e) {
        console.warn("Не удалось сохранить API ключ в localStorage", e);
      }
    },
    [toast, t]
  );

  const handleAccessTokenChange = useCallback((value: string) => {
    setSettings((prev) => ({ ...prev, accessToken: value }));
    try {
      localStorage.setItem("access-token", value);
    } catch (e) {
      console.warn("Не удалось сохранить access token в localStorage", e);
    }
  }, []);

  const handleAdminEmailChange = useCallback((value: string) => {
    setSettings((prev) => ({ ...prev, adminEmail: value }));
    try {
      localStorage.setItem("admin-email", value);
    } catch (e) {
      console.warn("Не удалось сохранить email в localStorage", e);
    }
  }, []);

  const handleAdminPasswordChange = useCallback((value: string) => {
    setSettings((prev) => ({ ...prev, adminPassword: value }));
    try {
      localStorage.setItem("admin-password", value);
    } catch (e) {
      console.warn("Не удалось сохранить password в localStorage", e);
    }
  }, []);

  const handleSaveBearerAuth = useCallback(() => {
    toast({
      title: t("api_docs_auth_saved_title"),
      description: t("api_docs_auth_saved_bearer_desc"),
      duration: 2000,
    });
  }, [t, toast]);

  const handleSaveSupabaseApiKey = useCallback(() => {
    toast({
      title: t("api_docs_auth_saved_title"),
      description: t("api_docs_auth_saved_apikey_desc"),
      duration: 2000,
    });
  }, [t, toast]);

  const handleSaveAdminCredentials = useCallback(() => {
    toast({
      title: t("api_docs_auth_saved_title"),
      description: t("api_docs_auth_saved_admin_desc"),
      duration: 2000,
    });
  }, [t, toast]);

  const apiSections: { admin: ApiSection; user: ApiSection } = useMemo(() => ({
    admin: {
      name: t("api_docs_section_admin_name"),
      pages: [
        {
          name: t("api_docs_page_auth_name"),
          description: t("api_docs_page_auth_desc"),
          endpoints: [
            {
              name: 'Get Auth Token',
              method: 'POST',
              endpoint: '/auth/v1/token?grant_type=password',
              description: t("api_docs_desc_get_auth_token"),
              body: {
                email: 'user@example.com',
                password: 'your_password',
              },
              response: {
                access_token: 'jwt_token_here',
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'refresh_token_here',
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let responseData = pm.response.json();
if (responseData.access_token) { pm.collectionVariables.set("access_token", responseData.access_token); }`,
            },
            {
              name: 'Register User',
              method: 'POST',
              endpoint: '/auth/v1/signup',
              description: t("api_docs_desc_register_user"),
              body: {
                email: 'manager@testmail.com',
                password: 'ManagerPass123',
              },
              response: {
                id: 'uuid-here',
                email: 'manager@testmail.com',
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let responseData = pm.response.json();
if (responseData.id) { pm.collectionVariables.set("manager_id", responseData.id); }`,
            },
          ],
        },
        {
          name: t("api_docs_page_users_name"),
          description: t("api_docs_page_users_desc"),
          endpoints: [
            {
              name: 'Get Users',
              method: 'GET',
              endpoint: '/functions/v1/users',
              description: t("api_docs_desc_get_users"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              response: {
                users: [
                  {
                    id: 'uuid',
                    email: 'user@example.com',
                    name: 'Имя пользователя',
                    phone: '+380501234567',
                    role: 'manager',
                    status: 'active',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                  },
                ],
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let responseData = pm.response.json();
if (responseData.users && responseData.users.length > 0) { pm.collectionVariables.set("first_user_id", responseData.users[0].id); }`,
            },
            {
              name: 'Create User',
              method: 'POST',
              endpoint: '/functions/v1/users',
              description: t("api_docs_desc_create_user"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {
                email: 'new.user@example.com',
                password: 'SecurePass123',
                name: 'Новый Пользователь',
                phone: '+380991112233',
                role: 'user'
              },
              response: {
                user: {
                  id: 'uuid',
                  email: 'new.user@example.com',
                  name: 'Новый Пользователь',
                  phone: '+380991112233',
                  role: 'user',
                  status: 'active',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z'
                }
              },
              postmanScript: `pm.test("Status code is 201", function () { pm.response.to.have.status(201); });
let r = pm.response.json();
if (r.user && r.user.id) { pm.collectionVariables.set("first_user_id", r.user.id); }`
            },
            {
              name: 'Update User',
              method: 'PATCH',
              endpoint: '/functions/v1/users/{id}',
              description: t("api_docs_desc_update_user"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {
                name: 'Новое имя',
                phone: '+380987654321',
                role: 'admin',
                status: 'inactive',
              },
              response: {
                user: {
                  id: 'uuid',
                  email: 'test@example.com',
                  name: 'Новое имя',
                  phone: '+380987654321',
                  role: 'admin',
                  status: 'inactive',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let responseData = pm.response.json();
if (responseData.user && responseData.user.id) { pm.collectionVariables.set("edited_user_id", responseData.user.id); }`,
            },
            {
              name: 'Delete User',
              method: 'DELETE',
              endpoint: '/functions/v1/users/{id}',
              description: t("api_docs_desc_delete_user"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              response: {
                user: {
                  id: 'uuid',
                  email: 'test@example.com',
                  name: 'Тест Пользователь',
                  phone: '+380501234567',
                  role: 'manager',
                  status: 'inactive',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
          ],
        },
        {
          name: t("api_docs_page_admin_permissions_name"),
          description: t("api_docs_page_admin_permissions_desc"),
          endpoints: [
            {
              name: 'Get User Permissions',
              method: 'GET',
              endpoint: '/functions/v1/permissions?user_id={{current_user_id}}',
              description: t("api_docs_desc_get_user_permissions"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              response: {
                permissions: [
                  {
                    id: 1,
                    user_id: 'uuid',
                    menu_item_id: 1,
                    can_view: true,
                    can_edit: false,
                    created_at: '2024-01-01T00:00:00Z',
                    menu_items: { id: 1, title: 'Главное меню', path: '/main' },
                  },
                ],
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Update User Permissions',
              method: 'POST',
              endpoint: '/functions/v1/permissions',
              description: t("api_docs_desc_update_user_permissions"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {
                user_id: '{{current_user_id}}',
                permissions: [
                  { menu_item_id: 1, can_view: true, can_edit: false },
                  { menu_item_id: 2, can_view: true, can_edit: true },
                ],
              },
              response: { message: 'Права доступа успешно обновлены', updated_permissions: 2 },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
          ],
        },
      ],
    },
    user: {
      name: t("api_docs_section_user_name"),
      pages: [
        {
          name: t("api_docs_page_profile_name"),
          description: t("api_docs_page_profile_desc"),
          endpoints: [
            {
              name: 'Get Current User',
              method: 'GET',
              endpoint: '/functions/v1/auth-me',
              description: t("api_docs_desc_get_current_user"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              response: {
                user: {
                  id: 'uuid',
                  email: 'user@example.com',
                  name: 'Имя пользователя',
                  phone: '+380501234567',
                  role: 'manager',
                  status: 'active',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let responseData = pm.response.json();
if (responseData.user && responseData.user.id) { pm.collectionVariables.set("current_user_id", responseData.user.id); }`,
            },
            {
              name: 'Update Profile',
              method: 'PATCH',
              endpoint: '/rest/v1/profiles?id=eq.{{manager_id}}',
              description: t("api_docs_desc_update_profile"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { name: 'Manager Name', phone: '+380991112233' },
              response: {
                id: 'uuid',
                email: 'manager@testmail.com',
                name: 'Manager Name',
                phone: '+380991112233',
                role: 'manager',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
          ],
        },
        {
          name: t("api_docs_page_menu_name"),
          description: t("api_docs_page_menu_desc"),
          endpoints: [
            {
              name: 'Get Menu',
              method: 'GET',
              endpoint: '/functions/v1/menu',
              description: t("api_docs_desc_get_menu"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              response: {
                menu: [
                  {
                    id: 1,
                    title: 'Главное меню',
                    path: '/main',
                    parent_id: null,
                    order_index: 1,
                    is_active: true,
                    created_at: '2024-01-01T00:00:00Z',
                    children: [
                      { id: 2, title: 'Подменю', path: '/main/sub', parent_id: 1, order_index: 1, is_active: true, created_at: '2024-01-01T00:00:00Z' },
                    ],
                  },
                ],
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let responseData = pm.response.json();
if (responseData.menu && responseData.menu.length > 0) { pm.collectionVariables.set("menu_item_id", responseData.menu[0].id); }`,
            },
          ],
        },
        {
          name: t("api_docs_page_user_permissions_name"),
          description: t("api_docs_page_user_permissions_desc"),
          endpoints: [
            {
              name: 'Get User Permissions',
              method: 'GET',
              endpoint: '/functions/v1/permissions?user_id={{current_user_id}}',
              description: t("api_docs_desc_get_user_permissions"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              response: {
                permissions: [
                  { id: 1, user_id: 'uuid', menu_item_id: 1, can_view: true, can_edit: false, created_at: '2024-01-01T00:00:00Z', menu_items: { id: 1, title: 'Главное меню', path: '/main' } },
                ],
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
          ],
        },
        {
          name: t("api_docs_page_shops_name"),
          description: t("api_docs_page_shops_desc"),
          endpoints: [
            {
              name: 'List User Shops',
              method: 'POST',
              endpoint: '/functions/v1/user-shops-list',
              description: t("api_docs_desc_list_user_shops"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {},
              response: {
                shops: [
                  {
                    id: 'uuid',
                    store_name: 'Shop A',
                    store_url: 'https://shop.example.com',
                    is_active: true,
                    productsCount: 10,
                    categoriesCount: 5,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                  }
                ]
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let r = pm.response.json();
if (Array.isArray(r.shops) && r.shops.length > 0) { pm.collectionVariables.set("store_id", r.shops[0].id); }`,
            },
            {
              name: 'Create Shop',
              method: 'POST',
              endpoint: '/functions/v1/create-shop',
              description: t("api_docs_desc_create_shop"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {
                store_name: 'Demo Shop',
                template_id: null,
                xml_config: null,
                custom_mapping: null,
                store_company: 'Company LLC',
                store_url: 'https://demo.shop'
              },
              response: { shop: { id: 'uuid', store_name: 'Demo Shop', is_active: true } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let r = pm.response.json();
if (r.shop && r.shop.id) { pm.collectionVariables.set("store_id", r.shop.id); }`,
            },
            {
              name: 'Update Shop',
              method: 'POST',
              endpoint: '/functions/v1/update-shop',
              description: t("api_docs_desc_update_shop"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{store_id}}', patch: { store_name: 'Demo Shop Updated', is_active: true } },
              response: { shop: { id: '{{store_id}}', store_name: 'Demo Shop Updated', is_active: true } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Delete Shop',
              method: 'POST',
              endpoint: '/functions/v1/delete-shop',
              description: t("api_docs_desc_delete_shop"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{store_id}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Store Categories List',
              method: 'POST',
              endpoint: '/functions/v1/store-categories-list',
              description: t("api_docs_desc_store_categories_list"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}' },
              response: {
                rows: [
                  { id: 101, store_id: '{{store_id}}', category_id: 12, name: 'Категория', external_id: 'cat-12', is_active: true }
                ]
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });

let r = pm.response.json();
if (Array.isArray(r.rows) && r.rows.length > 0) { pm.collectionVariables.set("store_category_id", r.rows[0].id); pm.collectionVariables.set("category_id", r.rows[0].category_id); }`,
            },
            {
              name: 'Ensure Store Category',
              method: 'POST',
              endpoint: '/functions/v1/ensure-store-category',
              description: t("api_docs_desc_ensure_store_category"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', category_id: 12, external_id: 'cat-12', custom_name: 'Мужская одежда' },
              response: { id: 101 },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (r.id) { pm.collectionVariables.set("store_category_id", r.id.toString()); }`,
            },
            {
              name: 'Update Store Category',
              method: 'POST',
              endpoint: '/functions/v1/update-store-category',
              description: t("api_docs_desc_update_store_category"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{store_category_id}}', custom_name: 'Новое имя', is_active: true },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Delete Store Category With Products',
              method: 'POST',
              endpoint: '/functions/v1/delete-store-category-with-products',
              description: t("api_docs_desc_delete_store_category_with_products"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', category_id: '{{category_id}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Delete Store Categories With Products',
              method: 'POST',
              endpoint: '/functions/v1/delete-store-categories-with-products',
              description: t("api_docs_desc_delete_store_categories_with_products"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', category_ids: [ '{{category_id}}' ] },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Get Store Products Count',
              method: 'POST',
              endpoint: '/functions/v1/get-store-products-count',
              description: t("api_docs_desc_get_store_products_count"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}' },
              response: { count: 42 },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
          ]
        },
        {
          name: t("api_docs_page_store_currencies_name"),
          description: t("api_docs_page_store_currencies_desc"),
          endpoints: [
            { 
              name: 'Store Currencies List',
              method: 'POST',
              endpoint: '/functions/v1/store-currencies-list',
              description: t("api_docs_desc_store_currencies_list"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}' },
              response: { rows: [ { code: 'USD', rate: 1, is_base: true }, { code: 'EUR', rate: 40.5, is_base: false } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (Array.isArray(r.rows) && r.rows.length > 0) { pm.collectionVariables.set("currency_code", r.rows[0].code); }`
            },
            {
              name: 'Add Store Currency',
              method: 'POST',
              endpoint: '/functions/v1/add-store-currency',
              description: t("api_docs_desc_add_store_currency"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: 'EUR', rate: 40.5 },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Update Store Currency Rate',
              method: 'POST',
              endpoint: '/functions/v1/update-store-currency-rate',
              description: t("api_docs_desc_update_store_currency_rate"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: '{{currency_code}}', rate: 41.2 },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Set Base Store Currency',
              method: 'POST',
              endpoint: '/functions/v1/set-base-store-currency',
              description: t("api_docs_desc_set_base_store_currency"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: '{{currency_code}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Delete Store Currency',
              method: 'POST',
              endpoint: '/functions/v1/delete-store-currency',
              description: t("api_docs_desc_delete_store_currency"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: '{{currency_code}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Available Currencies',
              method: 'POST',
              endpoint: '/functions/v1/get-available-currencies',
              description: t("api_docs_desc_get_available_currencies"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {},
              response: { rows: [ { code: 'USD' }, { code: 'EUR' }, { code: 'UAH' } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
          ]
        },
        {
          name: t("api_docs_page_suppliers_name"),
          description: t("api_docs_page_suppliers_desc"),
          endpoints: [
            {
              name: 'Suppliers List',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-list',
              description: t("api_docs_desc_suppliers_list"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {},
              response: { suppliers: [ { id: 1, supplier_name: 'Supplier A', website_url: 'https://sup.example.com', xml_feed_url: null, phone: '+380...', created_at: '...', updated_at: '...' } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (Array.isArray(r.suppliers) && r.suppliers.length > 0) { pm.collectionVariables.set("supplier_id", r.suppliers[0].id.toString()); }`
            },
            {
              name: 'Suppliers Limit',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-limit',
              description: t("api_docs_desc_suppliers_limit"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {},
              response: { value: 5 },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (typeof r.value === 'number') { pm.collectionVariables.set("suppliers_limit", String(r.value)); }`
            },
            {
              name: 'Create Supplier',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-create',
              description: t("api_docs_desc_create_supplier"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { supplier_name: 'Supplier Demo', website_url: 'https://sup.demo', xml_feed_url: null, phone: '+3800000000' },
              response: { supplier: { id: 2, supplier_name: 'Supplier Demo', website_url: 'https://sup.demo' } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (r.supplier && r.supplier.id) { pm.collectionVariables.set("supplier_id", String(r.supplier.id)); }`
            },
            {
              name: 'Update Supplier',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-update',
              description: t("api_docs_desc_update_supplier"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{supplier_id}}', supplier_name: 'Supplier Demo Updated', xml_feed_url: null, phone: '+3800000001' },
              response: { supplier: { id: '{{supplier_id}}', supplier_name: 'Supplier Demo Updated' } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Delete Supplier',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-delete',
              description: t("api_docs_desc_delete_supplier"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{supplier_id}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
          ]
        },
        {
          name: t("api_docs_page_products_name"),
          description: t("api_docs_page_products_desc"),
          endpoints: [
            {
              name: 'User Products List',
              method: 'POST',
              endpoint: '/functions/v1/user-products-list',
              description: t("api_docs_desc_user_products_list"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { limit: 20, offset: 0 },
              response: { products: [ { id: 'uuid', store_id: 'store', name: 'Product', price: 100, stock_quantity: 10, available: true } ], page: { limit: 20, offset: 0, hasMore: true, nextOffset: 20, total: 100 } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (Array.isArray(r.products) && r.products.length > 0) { pm.collectionVariables.set("product_id", r.products[0].id); }`
            },
            {
              name: 'Store Products List',
              method: 'POST',
              endpoint: '/functions/v1/store-products-list',
              description: t("api_docs_desc_store_products_list"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', limit: 20, offset: 0 },
              response: { products: [ { id: 'uuid', store_id: 'store', name: 'Product', price: 100, stock_quantity: 10, available: true } ], page: { limit: 20, offset: 0, hasMore: true, nextOffset: 20, total: 100 } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (Array.isArray(r.products) && r.products.length > 0) { pm.collectionVariables.set("product_id", r.products[0].id); }`
            },
            {
              name: 'Product Edit Data',
              method: 'POST',
              endpoint: '/functions/v1/product-edit-data',
              description: t("api_docs_desc_product_edit_data"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}', store_id: '{{store_id}}' },
              response: {
                product: { id: '{{product_id}}', store_id: '{{store_id}}', name: 'Product', price: 100 },
                link: { custom_price: 90, custom_stock_quantity: 5 },
                images: [ { url: 'https://image', is_main: true } ],
                params: [ { name: 'Color', value: 'Red' } ]
              },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Create Product',
              method: 'POST',
              endpoint: '/functions/v1/create-product',
              description: t("api_docs_desc_create_product"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {
                store_id: '{{store_id}}',
                supplier_id: '{{supplier_id}}',
                category_id: 12,
                category_external_id: 'footwear',
                currency_code: '{{currency_code}}',
                external_id: 'EXT-123',
                name: 'Demo Product',
                name_ua: 'Демо товар',
                vendor: 'ACME',
                article: 'SKU-001',
                available: true,
                stock_quantity: 10,
                price: 100,
                price_old: 120,
                price_promo: 95,
                description: 'Описание товара',
                description_ua: 'Опис товару',
                docket: 'Краткое описание',
                docket_ua: 'Короткий опис',
                state: 'new',
                images: [
                  { url: 'https://example.com/image-main.jpg', is_main: true, order_index: 0 },
                  { url: 'https://example.com/image-2.jpg', is_main: false, order_index: 1 }
                ],
                params: [
                  { name: 'Color', value: 'Red', order_index: 0 },
                  { name: 'Size', value: 'M', order_index: 1 }
                ],
                links: [
                  {
                    store_id: '{{store_id}}',
                    is_active: true,
                    custom_price: 95,
                    custom_price_promo: 90,
                    custom_stock_quantity: 8,
                    custom_available: true,
                    custom_name: 'Demo Product (Store)',
                    custom_description: 'Локальное описание для магазина',
                    custom_category_id: null
                  }
                ]
              },
              response: { product_id: 'uuid' },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (r.product_id) { pm.collectionVariables.set("product_id", r.product_id); }`
            },
            {
              name: 'Update Product',
              method: 'POST',
              endpoint: '/functions/v1/update-product',
              description: t("api_docs_desc_update_product"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}', price: 120, stock_quantity: 12, description: 'Обновлённое описание' },
              response: { product_id: '{{product_id}}' },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Delete Product',
              method: 'POST',
              endpoint: '/functions/v1/delete-product',
              description: t("api_docs_desc_delete_product"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_ids: [ '{{product_id}}' ] },
              response: { success: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Duplicate Product',
              method: 'POST',
              endpoint: '/functions/v1/duplicate-product',
              description: t("api_docs_desc_duplicate_product"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { productId: '{{product_id}}' },
              response: { product: { id: 'uuid-copy', name: 'Demo Product (Copy)' } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (r.product && r.product.id) { pm.collectionVariables.set("product_copy_id", r.product.id); }`
            },
            {
              name: 'Save Store Product Edit',
              method: 'POST',
              endpoint: '/functions/v1/save-store-product-edit',
              description: t("api_docs_desc_save_store_product_edit"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}', store_id: '{{store_id}}', name: 'Edited', price: 95, linkPatch: { custom_price: 95 } },
              response: { product_id: '{{product_id}}', link: { custom_price: 95 } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (r.link && typeof r.link.custom_price !== 'undefined') { pm.collectionVariables.set("link_custom_price", String(r.link.custom_price)); }`
            },
            {
              name: 'Update Store Product Link',
              method: 'POST',
              endpoint: '/functions/v1/update-store-product-link',
              description: t("api_docs_desc_update_store_product_link"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}', store_id: '{{store_id}}', patch: { custom_price: 88, custom_available: true } },
              response: { link: { custom_price: 88, custom_available: true } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Store Links For Product',
              method: 'POST',
              endpoint: '/functions/v1/get-store-links-for-product',
              description: t("api_docs_desc_get_store_links_for_product"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}' },
              response: { store_ids: [ '{{store_id}}' ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Bulk Add Store Product Links',
              method: 'POST',
              endpoint: '/functions/v1/bulk-add-store-product-links',
              description: t("api_docs_desc_bulk_add_store_product_links"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { links: [ { product_id: '{{product_id}}', store_id: '{{store_id}}', is_active: true } ] },
              response: { inserted: 1, addedByStore: { '{{store_id}}': 1 } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (typeof r.inserted === 'number') { pm.collectionVariables.set("added_links_count", String(r.inserted)); }`
            },
            {
              name: 'Bulk Remove Store Product Links',
              method: 'POST',
              endpoint: '/functions/v1/bulk-remove-store-product-links',
              description: t("api_docs_desc_bulk_remove_store_product_links"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_ids: [ '{{product_id}}' ], store_ids: [ '{{store_id}}' ] },
              response: { deleted: 1, deletedByStore: { '{{store_id}}': 1 } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (typeof r.deleted === 'number') { pm.collectionVariables.set("deleted_links_count", String(r.deleted)); }`
            },
            {
              name: 'Store Category Filter Options',
              method: 'POST',
              endpoint: '/functions/v1/store-category-filter-options',
              description: t("api_docs_desc_store_category_filter_options"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}' },
              response: { names: [ 'Одежда', 'Обувь', 'Аксессуары' ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Product Limit Only',
              method: 'POST',
              endpoint: '/functions/v1/get-product-limit-only',
              description: t("api_docs_desc_get_product_limit_only"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {},
              response: { value: 1000 },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
let r = pm.response.json();
if (typeof r.value === 'number') { pm.collectionVariables.set("product_limit", String(r.value)); }`
            },
          ]
        },
        {
          name: t("api_docs_page_categories_name"),
          description: t("api_docs_page_categories_desc"),
          endpoints: [
            {
              name: 'Supplier Categories List',
              method: 'POST',
              endpoint: '/functions/v1/categories',
              description: t("api_docs_desc_supplier_categories_list"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { action: 'list', supplier_id: '{{supplier_id}}' },
              response: { rows: [ { id: '1001', name: 'Обувь', external_id: 'footwear', supplier_id: '{{supplier_id}}', parent_external_id: null } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Supplier Categories (Full)',
              method: 'POST',
              endpoint: '/functions/v1/categories',
              description: t("api_docs_desc_supplier_categories_full"),
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { action: 'get_supplier_categories', supplier_id: '{{supplier_id}}' },
              response: { rows: [ { id: '1002', external_id: 'men', name: 'Мужское', parent_external_id: null, supplier_id: '{{supplier_id}}' } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
          ]
        },
      ],
    },
  }), [t]);

  const visiblePageGroupsBySection = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const build = (sectionKey: SectionKey) => {
      const section = apiSections[sectionKey];
      return section.pages
        .map((page) => {
          const endpoints = q
            ? page.endpoints.filter((endpoint) => {
                const haystack = [
                  endpoint.name,
                  endpoint.endpoint,
                  endpoint.description,
                  endpoint.method,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return haystack.includes(q);
              })
            : page.endpoints;
          return { pageName: page.name, pageDescription: page.description, endpoints };
        })
        .filter((p) => p.endpoints.length > 0);
    };
    return {
      admin: build("admin"),
      user: build("user"),
    };
  }, [apiSections, searchQuery]);

  const generateCurlCommand = useCallback(
    (endpoint: ApiEndpoint) => {
      const baseUrl = serverUrl;
      const fullUrl = `${baseUrl}${endpoint.endpoint}`;

      let curlCmd = `curl -X ${endpoint.method} "${fullUrl}"`;

      if (endpoint.endpoint.includes("/auth/v1/") || endpoint.endpoint.includes("/rest/v1/")) {
        const apikeyValue = settings.apiKey || "YOUR_APIKEY_HERE";
        curlCmd += ` \\\n  -H "apikey: ${apikeyValue}"`;
      }

      if (endpoint.headers) {
        const tokenValue = settings.accessToken || "YOUR_TOKEN_HERE";
        Object.entries(endpoint.headers).forEach(([key, value]) => {
          const replaced = value
            .replace("{{access_token}}", tokenValue)
            .replace("{{jwt_token}}", tokenValue);
          curlCmd += ` \\\n  -H "${key}: ${replaced}"`;
        });
      }

      curlCmd += ` \\\n  -H "Content-Type: application/json"`;

      if (endpoint.body) {
        const body = { ...endpoint.body };

        if (endpoint.name === "Get Auth Token") {
          body.email = settings.adminEmail || "user@example.com";
          body.password = settings.adminPassword || "your_password";
        }

        curlCmd += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
      }

      return curlCmd;
    },
    [serverUrl, settings.accessToken, settings.adminEmail, settings.adminPassword, settings.apiKey]
  );

  const generatePostmanCollection = useCallback(() => {
    const baseUrl = serverUrl;
    
    const collection = {
      info: {
        name: t("api_docs_postman_collection_name"),
        description: t("api_docs_postman_collection_desc"),
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      variable: [
        {
          key: "base_url",
          value: baseUrl
        },
          {
            key: "access_token", 
            value: "",
            type: "string"
          },
          {
            key: "manager_id",
            value: "",
            type: "string"
          },
          {
            key: "current_user_id",
            value: "",
            type: "string"
          },
          {
            key: "first_user_id",
            value: "",
            type: "string"
          },
          {
            key: "menu_item_id",
            value: "",
            type: "string"
          }
      ],
      item: [
        ...(['admin','user'] as const).map(sectionKey => {
          const section = apiSections[sectionKey];
          return {
            name: section.name,
            item: section.pages.map(page => ({
              name: page.name,
              item: page.endpoints.map(endpoint => {
                const endpointKey = getEndpointKey(endpoint);
                const script = getPostmanScript(endpoint);
                const requestData: any = {
                  name: endpoint.name,
                  url: `${baseUrl}${endpoint.endpoint}`,
                  method: endpoint.method,
                  header: [
                    { key: 'Content-Type', value: 'application/json' },
                    ...(endpoint.headers ? Object.entries(endpoint.headers).map(([key, value]) => ({ key, value: value.replace('{{jwt_token}}', '{{access_token}}') })) : [])
                  ],
                };
                if (endpoint.body) {
                  const body: any = { ...endpoint.body };
                  if (endpoint.name === 'Get Auth Token') {
                    body.email = settings.adminEmail || 'user@example.com';
                    body.password = settings.adminPassword || 'your_password';
                  }
                  requestData.body = { mode: 'raw', raw: JSON.stringify(body, null, 2) };
                }
                if (endpoint.endpoint.includes('/auth/v1/') || endpoint.endpoint.includes('/rest/v1/')) {
                  const apikeyValue = settings.apiKey || 'YOUR_APIKEY_HERE';
                  requestData.header.push({ key: 'apikey', value: apikeyValue });
                }
                return {
                  name: endpoint.name,
                  request: requestData,
                  ...(script && script.trim() && { event: [{ listen: 'test', script: { exec: script.split('\n').filter(line => line.trim() !== '') } }] })
                };
              })
            }))
          };
        })
      ]
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(collection, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "api-collection.postman_collection.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    toast({
      title: t("collection_downloaded"),
      description: t("collection_ready"),
      duration: 3000,
    });
  }, [apiSections, getPostmanScript, serverUrl, settings.adminEmail, settings.adminPassword, settings.apiKey, t, toast]);

  const generateOpenApiSpec = useCallback(() => {
    const spec: any = {
      openapi: "3.0.3",
      info: {
        title: t("api_docs_title"),
        version: "1.0.0",
        description:
          t("api_docs_openapi_description"),
      },
      servers: [{ url: serverUrl }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          supabaseApiKey: {
            type: "apiKey",
            in: "header",
            name: "apikey",
          },
        },
      },
      paths: {},
    };

    const addEndpoint = (endpoint: ApiEndpoint) => {
      const [pathPart, queryString] = endpoint.endpoint.split("?");
      const method = endpoint.method.toLowerCase();

      const parameters: any[] = [];
      const pathParamMatches = Array.from(pathPart.matchAll(/\{([^}]+)\}/g));
      pathParamMatches.forEach((m) => {
        const name = m[1];
        parameters.push({
          in: "path",
          name,
          required: true,
          schema: { type: "string" },
        });
      });
      if (queryString) {
        const params = new URLSearchParams(queryString);
        params.forEach((value, name) => {
          parameters.push({
            in: "query",
            name,
            required: true,
            schema: { type: "string" },
            example: value,
          });
        });
      }

      const security: any[] = [];
      const hasAuthHeader = Boolean(
        endpoint.headers && Object.keys(endpoint.headers).some((h) => h.toLowerCase() === "authorization")
      );
      if (hasAuthHeader) security.push({ bearerAuth: [] });
      if (endpoint.endpoint.includes("/auth/v1/") || endpoint.endpoint.includes("/rest/v1/")) {
        security.push({ supabaseApiKey: [] });
      }

      const operation: any = {
        summary: endpoint.name,
        description: endpoint.description,
        ...(parameters.length ? { parameters } : {}),
        ...(security.length ? { security } : {}),
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                example: endpoint.response,
              },
            },
          },
        },
      };

      if (endpoint.body) {
        operation.requestBody = {
          required: true,
          content: {
            "application/json": {
              example:
                endpoint.name === "Get Auth Token"
                  ? {
                      ...endpoint.body,
                      email: "user@example.com",
                      password: "your_password",
                    }
                  : endpoint.body,
            },
          },
        };
      }

      spec.paths[pathPart] = spec.paths[pathPart] || {};
      spec.paths[pathPart][method] = operation;
    };

    (["admin", "user"] as const).forEach((sectionKey) => {
      apiSections[sectionKey].pages.forEach((page) => {
        page.endpoints.forEach(addEndpoint);
      });
    });

    return spec;
  }, [apiSections, serverUrl, t]);

  const downloadJson = useCallback(
    (filename: string, obj: unknown) => {
      const dataStr =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(obj, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    },
    []
  );

  const downloadOpenApiSpec = useCallback(() => {
    const spec = generateOpenApiSpec();
    downloadJson("openapi.json", spec);
    toast({
      title: t("api_docs_openapi_export_ready"),
      description: t("api_docs_openapi_export_downloaded"),
      duration: 3000,
    });
  }, [downloadJson, generateOpenApiSpec, t, toast]);

  const handleExportPostman = useCallback(() => {
    generatePostmanCollection();
    closeExportDialog();
  }, [closeExportDialog, generatePostmanCollection]);

  const handleExportSwagger = useCallback(() => {
    downloadOpenApiSpec();
    closeExportDialog();
  }, [closeExportDialog, downloadOpenApiSpec]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    []
  );

  const swaggerTags = useMemo(() => {
    const tags: Array<{
      key: string;
      name: string;
      description?: string;
      endpoints: ApiEndpoint[];
    }> = [];

    (["admin", "user"] as const).forEach((sectionKey) => {
      visiblePageGroupsBySection[sectionKey].forEach((page) => {
        const name = `${sectionKey} / ${page.pageName}`;
        tags.push({
          key: `${sectionKey}:${page.pageName}`,
          name,
          description: page.pageDescription,
          endpoints: page.endpoints,
        });
      });
    });

    return tags;
  }, [visiblePageGroupsBySection]);

  const methodRowStyles: Record<ApiEndpoint["method"], string> = useMemo(
    () => ({
      GET: "border-sky-500 bg-sky-50/60 dark:bg-sky-950/20",
      POST: "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20",
      PATCH: "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
      DELETE: "border-rose-500 bg-rose-50/60 dark:bg-rose-950/20",
    }),
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 relative">
        <div className="absolute right-4 top-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLang(lang === "uk" ? "en" : "uk")}
            aria-label={t("toggle_language")}
            className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-200 dark:hover:bg-transparent dark:hover:text-emerald-100"
          >
            {lang === "uk" ? "EN" : "UA"}
          </Button>
        </div>
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-5xl font-semibold tracking-tight text-foreground">
                {t("api_docs_title")}
              </h1>
              <span className="inline-flex items-center rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground dark:bg-neutral-900/70 dark:border dark:border-emerald-500/40 dark:text-emerald-100">
                1.0
              </span>
              <span className="inline-flex items-center rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                OAS 3.0
              </span>
            </div>
            <p className="text-muted-foreground">
              {t("api_docs_subtitle")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2">
              <div className="text-sm font-semibold text-muted-foreground">
                {t("api_docs_servers_label")}
              </div>
              <div className="max-w-xl">
                <Select value={serverUrl} onValueChange={setServerUrl}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SUPABASE_URL}>{SUPABASE_URL}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {t("api_docs_authorize")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      {t("api_docs_available_authorizations")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("api_docs_values_saved")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 max-h-[65vh] sm:max-h-[70vh] overflow-y-auto pr-2">
                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-600 dark:bg-rose-950/30">
                          bearerAuth
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (http, Bearer)
                        </span>
                      </div>
                      <Label htmlFor="auth-bearer">{t("api_docs_value_label")}</Label>
                      <Input
                        id="auth-bearer"
                        type="text"
                        value={settings.accessToken}
                        onChange={(e) => handleAccessTokenChange(e.target.value)}
                        placeholder={t("api_docs_jwt_placeholder")}
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
                          variant="outline"
                          onClick={handleSaveBearerAuth}
                        >
                          {t("api_docs_authorize")}
                        </Button>
                        <Button variant="outline" onClick={closeAuthDialog}>
                          {t("api_docs_close")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-600 dark:bg-rose-950/30">
                          supabaseApiKey
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (apiKey)
                        </span>
                      </div>
                      <Label htmlFor="auth-apikey">{t("api_docs_value_label")}</Label>
                      <Input
                        id="auth-apikey"
                        type="text"
                        value={settings.apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder={t("api_docs_apikey_placeholder")}
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
                          variant="outline"
                          onClick={handleSaveSupabaseApiKey}
                        >
                          {t("api_docs_authorize")}
                        </Button>
                        <Button variant="outline" onClick={closeAuthDialog}>
                          {t("api_docs_close")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-50 px-2 py-1 text-sm font-semibold text-rose-600 dark:bg-rose-950/30">
                          adminCredentials
                        </span>
                        <span className="text-sm text-muted-foreground">
                          (internal)
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="auth-admin-email">{t("api_docs_username_label")}</Label>
                          <Input
                            id="auth-admin-email"
                            type="email"
                            value={settings.adminEmail}
                            onChange={(e) => handleAdminEmailChange(e.target.value)}
                            placeholder={t("api_docs_admin_email_placeholder")}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="auth-admin-password">{t("api_docs_password_label")}</Label>
                          <Input
                            id="auth-admin-password"
                            type="password"
                            value={settings.adminPassword}
                            onChange={(e) => handleAdminPasswordChange(e.target.value)}
                            placeholder={t("api_docs_admin_password_placeholder")}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
                          variant="outline"
                          onClick={handleSaveAdminCredentials}
                        >
                          {t("api_docs_authorize")}
                        </Button>
                        <Button variant="outline" onClick={closeAuthDialog}>
                          {t("api_docs_close")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    {t("api_docs_export")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      {t("api_docs_export")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("api_docs_export_desc")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-auto py-3"
                      onClick={handleExportPostman}
                    >
                      <Send className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-medium">{t("api_docs_postman_label")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("api_docs_postman_desc")}
                        </div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-auto py-3"
                      onClick={handleExportSwagger}
                    >
                      <FileJson className="h-5 w-5" />
                      <div className="text-left">
                        <div className="font-medium">{t("api_docs_swagger_label")}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("api_docs_swagger_desc")}
                        </div>
                      </div>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="text-sm font-semibold text-muted-foreground">
              {t("api_docs_filter_label")}
            </div>
            <Input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t("api_docs_filter_placeholder")}
              className="max-w-xl"
            />
          </div>

          <Accordion type="multiple" className="w-full space-y-4">
            {swaggerTags.map((tag) => (
              <AccordionItem
                key={tag.key}
                value={tag.key}
                className="rounded-md border border-border overflow-hidden"
              >
                <AccordionTrigger className="group px-4 py-3 hover:no-underline [&>svg]:hidden">
                  <div className="flex w-full items-center justify-between gap-3 rounded-md">
                    <div className="flex flex-col items-start gap-1">
                      <div className="text-2xl font-semibold text-foreground">
                        {tag.name}
                      </div>
                      {tag.description ? (
                        <div className="text-sm text-muted-foreground">
                          {tag.description}
                        </div>
                      ) : null}
                    </div>
                    <ChevronDown className="h-6 w-6 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2">
                    <Accordion type="multiple" className="w-full">
                      {tag.endpoints.map((endpoint) => {
                        const endpointKey = getEndpointKey(endpoint);
                        const pathOnly = endpoint.endpoint.split("?")[0];
                        const script = getPostmanScript(endpoint);
                        const responseJson = JSON.stringify(endpoint.response, null, 2);
                        const curlCommand = generateCurlCommand(endpoint);
                        const isEditing = editingScript === endpointKey;
                        return (
                          <AccordionItem key={endpointKey} value={endpointKey}>
                            <AccordionTrigger className="group hover:no-underline py-0 [&>svg]:hidden">
                              <div
                                className={`flex w-full items-center gap-3 rounded-md border border-l-4 px-3 py-2 ${methodRowStyles[endpoint.method]}`}
                              >
                                <span
                                  className={`min-w-[72px] text-center rounded px-2 py-1 text-xs font-bold ${methodColors[endpoint.method]}`}
                                >
                                  {endpoint.method}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                    <span className="font-mono text-sm font-semibold text-foreground">
                                      {pathOnly}
                                    </span>
                                    <span className="text-sm text-muted-foreground line-clamp-1">
                                      {endpoint.description}
                                    </span>
                                  </div>
                                </div>
                                <ChevronDown className="h-6 w-6 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-3">
                              <div className="rounded-md border bg-background p-4 space-y-4">
                                <div className="space-y-1">
                                  <div className="text-sm font-semibold text-foreground">
                                    {t("api_docs_description_label")}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {endpoint.description}
                                  </div>
                                </div>

                                <Separator />

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold text-foreground">
                                      {t("api_docs_request_label")}
                                    </div>
                                    <div className="space-y-3">
                                      {endpoint.headers ? (
                                        <div className="space-y-1">
                                          <div className="text-xs font-semibold text-muted-foreground">
                                            {t("api_docs_headers_label")}
                                          </div>
                                          <pre className="bg-muted p-3 rounded overflow-x-auto text-xs dark:bg-neutral-900/70 dark:border dark:border-emerald-500/40">
                                            <code>
                                              {JSON.stringify(endpoint.headers, null, 2)}
                                            </code>
                                          </pre>
                                        </div>
                                      ) : null}
                                      {endpoint.body ? (
                                        <div className="space-y-1">
                                          <div className="text-xs font-semibold text-muted-foreground">
                                            {t("api_docs_body_label")}
                                          </div>
                                          <pre className="bg-muted p-3 rounded overflow-x-auto text-xs dark:bg-neutral-900/70 dark:border dark:border-emerald-500/40">
                                            <code>
                                              {JSON.stringify(endpoint.body, null, 2)}
                                            </code>
                                          </pre>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold text-foreground">
                                      {t("api_docs_responses_label")}
                                    </div>
                                    <div className="relative">
                                      <pre className="bg-muted rounded overflow-x-auto text-xs px-3 pb-3 pt-12 dark:bg-neutral-900/70 dark:border dark:border-emerald-500/40">
                                        <code>
                                          {responseJson}
                                        </code>
                                      </pre>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="absolute top-2 right-2 border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm transition hover:bg-emerald-200 hover:shadow-md hover:scale-[1.03] active:scale-100 dark:bg-emerald-900/50 dark:text-emerald-100 dark:border-emerald-500/40 dark:hover:bg-emerald-900/70"
                                              data-copy-text={responseJson}
                                              onClick={handleCopyFromButtonData}
                                            >
                                              <Copy className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{t("api_docs_copy_response")}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="text-sm font-semibold text-foreground">
                                    {t("api_docs_curl_label")}
                                  </div>
                                  <div className="relative">
                                    <pre className="bg-muted rounded overflow-x-auto text-xs px-3 pb-3 pt-12 dark:bg-neutral-900/70 dark:border dark:border-emerald-500/40">
                                      <code>{curlCommand}</code>
                                    </pre>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="absolute top-2 right-2 border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm transition hover:bg-emerald-200 hover:shadow-md hover:scale-[1.03] active:scale-100 dark:bg-emerald-900/50 dark:text-emerald-100 dark:border-emerald-500/40 dark:hover:bg-emerald-900/70"
                                            data-copy-text={curlCommand}
                                            onClick={handleCopyFromButtonData}
                                          >
                                            <Copy className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{t("api_docs_copy_curl")}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-foreground">
                                      {t("api_docs_postman_script_label")}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      data-endpoint-key={endpointKey}
                                      onClick={handleToggleEditingScript}
                                    >
                                      {isEditing ? (
                                        <>
                                          <Save className="w-4 h-4 mr-2" />
                                          {t("api_docs_done")}
                                        </>
                                      ) : (
                                        <>
                                          <Edit className="w-4 h-4 mr-2" />
                                          {t("api_docs_edit")}
                                        </>
                                      )}
                                    </Button>
                                  </div>

                                  {isEditing ? (
                                    <Textarea
                                      value={script}
                                      data-endpoint-key={endpointKey}
                                      onChange={handleScriptChange}
                                      placeholder={t("api_docs_postman_script_placeholder")}
                                      className="min-h-[180px] font-mono text-sm"
                                    />
                                  ) : (
                                    <div className="relative">
                                      <pre className="bg-muted rounded overflow-x-auto text-xs min-h-[120px] px-3 pb-3 pt-12 dark:bg-neutral-900/70 dark:border dark:border-emerald-500/40">
                                        <code>{script || t("api_docs_postman_script_empty")}</code>
                                      </pre>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="absolute top-2 right-2 border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm transition hover:bg-emerald-200 hover:shadow-md hover:scale-[1.03] active:scale-100 dark:bg-emerald-900/50 dark:text-emerald-100 dark:border-emerald-500/40 dark:hover:bg-emerald-900/70"
                                              data-copy-text={script}
                                              onClick={handleCopyFromButtonData}
                                              disabled={!script}
                                            >
                                              <Copy className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{t("api_docs_copy_script")}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
