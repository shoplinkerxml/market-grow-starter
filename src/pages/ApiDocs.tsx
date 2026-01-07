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
  const { t } = useI18n();

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
      title: "Authorization сохранена",
      description: "Bearer token применён в примерах",
      duration: 2000,
    });
  }, [toast]);

  const handleSaveSupabaseApiKey = useCallback(() => {
    toast({
      title: "Authorization сохранена",
      description: "API key применён в примерах",
      duration: 2000,
    });
  }, [toast]);

  const handleSaveAdminCredentials = useCallback(() => {
    toast({
      title: "Authorization сохранена",
      description: "Данные админа применены в примерах",
      duration: 2000,
    });
  }, [toast]);

  const apiSections: { admin: ApiSection; user: ApiSection } = useMemo(() => ({
    admin: {
      name: 'Кабинет админа',
      pages: [
        {
          name: 'Аутентификация',
          description: 'Получение токена администратора для работы с админ-API',
          endpoints: [
            {
              name: 'Get Auth Token',
              method: 'POST',
              endpoint: '/auth/v1/token?grant_type=password',
              description: 'Получить JWT токен для аутентификации',
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
              description: 'Регистрация нового пользователя',
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
          name: 'Пользователи',
          description: 'Список и управление пользователями',
          endpoints: [
            {
              name: 'Get Users',
              method: 'GET',
              endpoint: '/functions/v1/users',
              description: 'Получить список всех пользователей',
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
              description: 'Создать нового пользователя',
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
              description: 'Обновить данные пользователя',
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
              description: 'Деактивировать пользователя',
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
          name: 'Права доступа',
          description: 'Управление правами доступа пользователей',
          endpoints: [
            {
              name: 'Get User Permissions',
              method: 'GET',
              endpoint: '/functions/v1/permissions?user_id={{current_user_id}}',
              description: 'Получить права доступа пользователя',
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
              description: 'Обновить права доступа пользователя к пунктам меню',
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
      name: 'Кабинет пользователя',
      pages: [
        {
          name: 'Профиль',
          description: 'Данные текущего пользователя и их обновление',
          endpoints: [
            {
              name: 'Get Current User',
              method: 'GET',
              endpoint: '/functions/v1/auth-me',
              description: 'Получить информацию о текущем пользователе',
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
              description: 'Обновить профиль пользователя после регистрации',
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
          name: 'Меню',
          description: 'Структурированное меню доступных разделов',
          endpoints: [
            {
              name: 'Get Menu',
              method: 'GET',
              endpoint: '/functions/v1/menu',
              description: 'Получить структурированное меню для текущего пользователя',
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
          name: 'Права доступа',
          description: 'Просмотр прав доступа текущего пользователя',
          endpoints: [
            {
              name: 'Get User Permissions',
              method: 'GET',
              endpoint: '/functions/v1/permissions?user_id={{current_user_id}}',
              description: 'Получить права доступа пользователя',
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
          name: 'Магазины',
          description: 'CRUD магазинов и связанные данные',
          endpoints: [
            {
              name: 'List User Shops',
              method: 'POST',
              endpoint: '/functions/v1/user-shops-list',
              description: 'Получить список магазинов текущего пользователя',
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
              description: 'Создать новый магазин',
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
              description: 'Обновить магазин',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{store_id}}', patch: { store_name: 'Demo Shop Updated', is_active: true } },
              response: { shop: { id: '{{store_id}}', store_name: 'Demo Shop Updated', is_active: true } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Delete Shop',
              method: 'POST',
              endpoint: '/functions/v1/delete-shop',
              description: 'Удалить магазин',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{store_id}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Store Categories List',
              method: 'POST',
              endpoint: '/functions/v1/store-categories-list',
              description: 'Категории магазина',
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
              description: 'Гарантировать привязку категории к магазину (апсерт)',
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
              description: 'Обновить поля категории магазина',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{store_category_id}}', custom_name: 'Новое имя', is_active: true },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Delete Store Category With Products',
              method: 'POST',
              endpoint: '/functions/v1/delete-store-category-with-products',
              description: 'Удалить категорию магазина и её товары',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', category_id: '{{category_id}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Delete Store Categories With Products',
              method: 'POST',
              endpoint: '/functions/v1/delete-store-categories-with-products',
              description: 'Массовое удаление категорий магазина и их товаров',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', category_ids: [ '{{category_id}}' ] },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
            {
              name: 'Get Store Products Count',
              method: 'POST',
              endpoint: '/functions/v1/get-store-products-count',
              description: 'Количество товаров в магазине',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}' },
              response: { count: 42 },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`,
            },
          ]
        },
        {
          name: 'Валюты магазина',
          description: 'Операции с валютами магазина',
          endpoints: [
            { 
              name: 'Store Currencies List',
              method: 'POST',
              endpoint: '/functions/v1/store-currencies-list',
              description: 'Список валют магазина',
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
              description: 'Добавить валюту в магазин',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: 'EUR', rate: 40.5 },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Update Store Currency Rate',
              method: 'POST',
              endpoint: '/functions/v1/update-store-currency-rate',
              description: 'Обновить курс валюты',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: '{{currency_code}}', rate: 41.2 },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Set Base Store Currency',
              method: 'POST',
              endpoint: '/functions/v1/set-base-store-currency',
              description: 'Установить базовую валюту',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: '{{currency_code}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Delete Store Currency',
              method: 'POST',
              endpoint: '/functions/v1/delete-store-currency',
              description: 'Удалить валюту из магазина',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}', code: '{{currency_code}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Available Currencies',
              method: 'POST',
              endpoint: '/functions/v1/get-available-currencies',
              description: 'Справочник доступных валют',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: {},
              response: { rows: [ { code: 'USD' }, { code: 'EUR' }, { code: 'UAH' } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
          ]
        },
        {
          name: 'Поставщики',
          description: 'CRUD поставщиков',
          endpoints: [
            {
              name: 'Suppliers List',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-list',
              description: 'Список поставщиков текущего пользователя',
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
              description: 'Максимально доступное количество поставщиков',
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
              description: 'Создать поставщика',
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
              description: 'Обновить поставщика',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{supplier_id}}', supplier_name: 'Supplier Demo Updated', xml_feed_url: null, phone: '+3800000001' },
              response: { supplier: { id: '{{supplier_id}}', supplier_name: 'Supplier Demo Updated' } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Delete Supplier',
              method: 'POST',
              endpoint: '/functions/v1/suppliers-delete',
              description: 'Удалить поставщика',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { id: '{{supplier_id}}' },
              response: { ok: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
          ]
        },
        {
          name: 'Товары',
          description: 'Полный набор операций с товарами',
          endpoints: [
            {
              name: 'User Products List',
              method: 'POST',
              endpoint: '/functions/v1/user-products-list',
              description: 'Общий список товаров пользователя (страница /user/products) с пагинацией',
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
              description: 'Список товаров конкретного магазина (страница /user/shops/:id) с пагинацией',
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
              description: 'Агрегированные данные для редактирования товара',
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
              description: 'Создать новый товар',
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
              description: 'Обновить товар',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}', price: 120, stock_quantity: 12, description: 'Обновлённое описание' },
              response: { product_id: '{{product_id}}' },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Delete Product',
              method: 'POST',
              endpoint: '/functions/v1/delete-product',
              description: 'Удалить товар',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_ids: [ '{{product_id}}' ] },
              response: { success: true },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Duplicate Product',
              method: 'POST',
              endpoint: '/functions/v1/duplicate-product',
              description: 'Дублировать товар',
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
              description: 'Сохранить изменения товара для магазина',
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
              description: 'Обновить переопределения товара в магазине',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}', store_id: '{{store_id}}', patch: { custom_price: 88, custom_available: true } },
              response: { link: { custom_price: 88, custom_available: true } },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Store Links For Product',
              method: 'POST',
              endpoint: '/functions/v1/get-store-links-for-product',
              description: 'Список магазинов, к которым привязан товар',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { product_id: '{{product_id}}' },
              response: { store_ids: [ '{{store_id}}' ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Bulk Add Store Product Links',
              method: 'POST',
              endpoint: '/functions/v1/bulk-add-store-product-links',
              description: 'Массово привязать товар к магазинам',
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
              description: 'Массово отвязать товар от магазинов',
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
              description: 'Названия категорий для фильтрации товаров магазина',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { store_id: '{{store_id}}' },
              response: { names: [ 'Одежда', 'Обувь', 'Аксессуары' ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Product Limit Only',
              method: 'POST',
              endpoint: '/functions/v1/get-product-limit-only',
              description: 'Максимально доступное количество товаров',
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
          name: 'Категории',
          description: 'Работа с категориями поставщиков (user функции)',
          endpoints: [
            {
              name: 'Supplier Categories List',
              method: 'POST',
              endpoint: '/functions/v1/categories',
              description: 'Список категорий по поставщику',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { action: 'list', supplier_id: '{{supplier_id}}' },
              response: { rows: [ { id: '1001', name: 'Обувь', external_id: 'footwear', supplier_id: '{{supplier_id}}', parent_external_id: null } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
            {
              name: 'Get Supplier Categories (Full)',
              method: 'POST',
              endpoint: '/functions/v1/categories',
              description: 'Полный список категорий с id/parent для поставщика',
              headers: { Authorization: 'Bearer {{access_token}}' },
              body: { action: 'get_supplier_categories', supplier_id: '{{supplier_id}}' },
              response: { rows: [ { id: '1002', external_id: 'men', name: 'Мужское', parent_external_id: null, supplier_id: '{{supplier_id}}' } ] },
              postmanScript: `pm.test("Status code is 200", function () { pm.response.to.have.status(200); });`
            },
          ]
        },
      ],
    },
  }), []);

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
        name: "API Documentation Collection",
        description: "Postman коллекция для тестирования API",
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
        title: "MarketGrow API",
        version: "1.0.0",
        description:
          "OpenAPI спецификация, собранная из встроенной документации проекта.",
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
  }, [apiSections, serverUrl]);

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
      title: "Swagger экспорт готов",
      description: "Файл openapi.json скачан",
      duration: 3000,
    });
  }, [downloadJson, generateOpenApiSpec, toast]);

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
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-5xl font-semibold tracking-tight text-foreground">
                MarketGrow API
              </h1>
              <span className="inline-flex items-center rounded bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                1.0
              </span>
              <span className="inline-flex items-center rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                OAS 3.0
              </span>
            </div>
            <p className="text-muted-foreground">
              REST API для системы управления пользователями и ролевым доступом
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2">
              <div className="text-sm font-semibold text-muted-foreground">
                Servers
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
                    Authorize
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      Available authorizations
                    </DialogTitle>
                    <DialogDescription>
                      Значения сохраняются локально в браузере
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
                      <Label htmlFor="auth-bearer">Value</Label>
                      <Input
                        id="auth-bearer"
                        type="text"
                        value={settings.accessToken}
                        onChange={(e) => handleAccessTokenChange(e.target.value)}
                        placeholder="JWT token"
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
                          variant="outline"
                          onClick={handleSaveBearerAuth}
                        >
                          Authorize
                        </Button>
                        <Button variant="outline" onClick={closeAuthDialog}>
                          Close
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
                      <Label htmlFor="auth-apikey">Value</Label>
                      <Input
                        id="auth-apikey"
                        type="text"
                        value={settings.apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder="Supabase anon key"
                        className="font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          className="border-emerald-500 bg-transparent text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20"
                          variant="outline"
                          onClick={handleSaveSupabaseApiKey}
                        >
                          Authorize
                        </Button>
                        <Button variant="outline" onClick={closeAuthDialog}>
                          Close
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
                          <Label htmlFor="auth-admin-email">Username</Label>
                          <Input
                            id="auth-admin-email"
                            type="email"
                            value={settings.adminEmail}
                            onChange={(e) => handleAdminEmailChange(e.target.value)}
                            placeholder="admin@example.com"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="auth-admin-password">Password</Label>
                          <Input
                            id="auth-admin-password"
                            type="password"
                            value={settings.adminPassword}
                            onChange={(e) => handleAdminPasswordChange(e.target.value)}
                            placeholder="password"
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
                          Authorize
                        </Button>
                        <Button variant="outline" onClick={closeAuthDialog}>
                          Close
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
                    Экспорт
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      Экспорт
                    </DialogTitle>
                    <DialogDescription>
                      Скачайте Swagger/OpenAPI или Postman коллекцию
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
                        <div className="font-medium">Postman</div>
                        <div className="text-xs text-muted-foreground">
                          Коллекция v2.1 (JSON)
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
                        <div className="font-medium">Swagger (OpenAPI)</div>
                        <div className="text-xs text-muted-foreground">
                          Спецификация OpenAPI 3.0 (JSON)
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
              Filter
            </div>
            <Input
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Filter"
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
                                    Description
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {endpoint.description}
                                  </div>
                                </div>

                                <Separator />

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold text-foreground">
                                      Request
                                    </div>
                                    <div className="space-y-3">
                                      {endpoint.headers ? (
                                        <div className="space-y-1">
                                          <div className="text-xs font-semibold text-muted-foreground">
                                            Headers
                                          </div>
                                          <pre className="bg-muted p-3 rounded overflow-x-auto text-xs">
                                            <code>
                                              {JSON.stringify(endpoint.headers, null, 2)}
                                            </code>
                                          </pre>
                                        </div>
                                      ) : null}
                                      {endpoint.body ? (
                                        <div className="space-y-1">
                                          <div className="text-xs font-semibold text-muted-foreground">
                                            Body
                                          </div>
                                          <pre className="bg-muted p-3 rounded overflow-x-auto text-xs">
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
                                      Responses
                                    </div>
                                    <div className="relative">
                                      <pre className="bg-muted rounded overflow-x-auto text-xs px-3 pb-3 pt-12">
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
                                              className="absolute top-2 right-2 border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm transition hover:bg-emerald-200 hover:shadow-md hover:scale-[1.03] active:scale-100"
                                              data-copy-text={responseJson}
                                              onClick={handleCopyFromButtonData}
                                            >
                                              <Copy className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Копировать ответ</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="text-sm font-semibold text-foreground">
                                    cURL
                                  </div>
                                  <div className="relative">
                                    <pre className="bg-muted rounded overflow-x-auto text-xs px-3 pb-3 pt-12">
                                      <code>{curlCommand}</code>
                                    </pre>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="absolute top-2 right-2 border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm transition hover:bg-emerald-200 hover:shadow-md hover:scale-[1.03] active:scale-100"
                                            data-copy-text={curlCommand}
                                            onClick={handleCopyFromButtonData}
                                          >
                                            <Copy className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Копировать cURL</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-foreground">
                                      Postman Test Script
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
                                          Готово
                                        </>
                                      ) : (
                                        <>
                                          <Edit className="w-4 h-4 mr-2" />
                                          Редактировать
                                        </>
                                      )}
                                    </Button>
                                  </div>

                                  {isEditing ? (
                                    <Textarea
                                      value={script}
                                      data-endpoint-key={endpointKey}
                                      onChange={handleScriptChange}
                                      placeholder="Введите Postman тест скрипт..."
                                      className="min-h-[180px] font-mono text-sm"
                                    />
                                  ) : (
                                    <div className="relative">
                                      <pre className="bg-muted rounded overflow-x-auto text-xs min-h-[120px] px-3 pb-3 pt-12">
                                        <code>{script || "// Postman скрипт не задан"}</code>
                                      </pre>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="absolute top-2 right-2 border-emerald-200 bg-emerald-100 text-emerald-900 shadow-sm transition hover:bg-emerald-200 hover:shadow-md hover:scale-[1.03] active:scale-100"
                                              data-copy-text={script}
                                              onClick={handleCopyFromButtonData}
                                              disabled={!script}
                                            >
                                              <Copy className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Копировать скрипт</p>
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
