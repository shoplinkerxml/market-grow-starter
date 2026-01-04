import {
  LayoutDashboard,
  FileText,
  FormInput,
  Clipboard,
  CheckCircle,
  Users,
  UserCheck,
  UserCog,
  BarChart3,
  TrendingUp,
  FileBarChart,
  Edit3,
  Layers,
  Settings,
  Cog,
  Sliders,
  Shield,
  Lock,
  Key,
  LogOut,
  DoorOpen,
  Package,
  Menu,
  LayoutGrid,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Circle,
  Home,
  User,
  FileSpreadsheet,
  Layout,
  Code,
  CodeXml,
  FileCode,
  FileCode2,
  Image,
  Bell,
  CreditCard,
  DollarSign,
  Tags,
  ChevronRight,
  Truck,
  Store,
  type LucideIcon,
} from "lucide-react";

export const MENU_ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  dashboard: LayoutDashboard,
  home: Home,
  LayoutDashboard,

  "file-text": FileText,
  forms: FileText,
  "form-input": FormInput,
  "forms-elements": FormInput,
  clipboard: Clipboard,
  "forms-layouts": Clipboard,
  "check-circle": CheckCircle,
  "forms-validation": CheckCircle,
  "file-spreadsheet": FileSpreadsheet,
  FileText,

  "layout-grid": LayoutGrid,
  layout: Layout,
  pages: Layout,
  "move-horizontal": MoveHorizontal,
  "move-vertical": MoveVertical,
  palette: Palette,
  Layout,

  users: Users,
  user: User,
  profile: User,
  "user-profile": UserCheck,
  "user-management": UserCog,
  "user-check": UserCheck,
  "user-cog": UserCog,
  User,
  Users,

  "bar-chart-3": BarChart3,
  reports: BarChart3,
  analytics: BarChart3,
  "trending-up": TrendingUp,
  "file-bar-chart": FileBarChart,
  statistics: FileBarChart,
  BarChart3,

  content: FileText,
  "edit-3": Edit3,
  layers: Layers,
  categories: Layers,
  package: Package,
  products: Package,
  suppliers: Truck,
  supplier: Truck,
  постачальники: Truck,
  постачальник: Truck,
  shops: Store,
  shop: Store,
  магазини: Store,
  магазин: Store,
  Store,
  Package,
  Truck,

  "credit-card": CreditCard,
  pricing: CreditCard,
  "pricing-plans": CreditCard,
  "dollar-sign": DollarSign,
  prices: DollarSign,
  money: DollarSign,
  tags: Tags,
  discounts: Tags,
  "payment-systems": CreditCard,
  "payment-system": CreditCard,
  "платежные-системы": CreditCard,
  "платежная-система": CreditCard,
  CreditCard,

  code: Code,
  api: Code,
  "code-xml": CodeXml,
  "file-code": FileCode,
  "file-code-2": FileCode2,
  xml: CodeXml,
  template: FileCode,
  templates: FileCode,
  "xml-template": CodeXml,
  "xml-templates": CodeXml,
  Code,
  CodeXml,
  FileCode,

  image: Image,
  media: Image,
  bell: Bell,
  notifications: Bell,
  Image,
  Bell,

  settings: Settings,
  configuration: Cog,
  cog: Cog,
  sliders: Sliders,
  preferences: Sliders,
  Settings,

  shield: Shield,
  permissions: Shield,
  lock: Lock,
  security: Lock,
  key: Key,
  access: Key,
  Shield,

  menu: Menu,
  "log-out": LogOut,
  logout: LogOut,
  "door-open": DoorOpen,
  exit: DoorOpen,
  "chevron-right": ChevronRight,
  Menu,

  circle: Circle,
  dot: Circle,
  Circle,
} as const;

export const useIcon = (name?: string | null): LucideIcon => {
  return name ? MENU_ICONS[name] || Circle : Circle;
};

export const getAvailableIcons = (): string[] => {
  return Object.keys(MENU_ICONS).sort();
};

export const isValidIconName = (name: string): boolean => {
  return name in MENU_ICONS;
};

export const getAutoIcon = (item: { title: string; path: string; page_type?: string }): string => {
  const title = item.title.toLowerCase();
  const path = item.path.toLowerCase();

  if (item.page_type === "dashboard") return "layout-dashboard";
  if (item.page_type === "form") return "file-text";
  if (item.page_type === "list") return "bar-chart-3";

  if (title.includes("dashboard") || title.includes("панель")) return "layout-dashboard";
  if (title.includes("user") || title.includes("користувач")) return "users";
  if (title.includes("setting") || title.includes("налаштування")) return "settings";
  if (title.includes("xml") || title.includes("template") || title.includes("шаблон")) return "file-code";
  if (title.includes("form") || title.includes("форм")) return "file-text";
  if (title.includes("report") || title.includes("звіт")) return "bar-chart-3";
  if (title.includes("analytic") || title.includes("аналітика")) return "trending-up";
  if (title.includes("content") || title.includes("контент")) return "file-text";
  if (title.includes("categor") || title.includes("категор")) return "layers";
  if (title.includes("product") || title.includes("товар")) return "package";
  if (title.includes("supplier") || title.includes("постачальник")) return "truck";
  if (title.includes("shop") || title.includes("магазин")) return "store";
  if (title.includes("payment") || title.includes("платеж")) return "credit-card";
  if (title.includes("permission") || title.includes("дозвол")) return "shield";
  if (title.includes("api")) return "code";
  if (title.includes("media") || title.includes("медіа")) return "image";
  if (title.includes("notification") || title.includes("сповіщення")) return "bell";
  if (title.includes("pricing") || title.includes("price") || title.includes("тариф") || title.includes("ціна")) return "credit-card";
  if (title.includes("plan") || title.includes("subscription") || title.includes("план")) return "credit-card";

  if (path.includes("/dashboard")) return "layout-dashboard";
  if (path.includes("/users") || path.includes("/користувачі")) return "users";
  if (path.includes("/settings") || path.includes("/налаштування")) return "settings";
  if (path.includes("/forms") || path.includes("/форми")) return "file-text";
  if (path.includes("/reports") || path.includes("/звіти")) return "bar-chart-3";
  if (path.includes("/analytics") || path.includes("/аналітика")) return "trending-up";
  if (path.includes("/content") || path.includes("/контент")) return "file-text";
  if (path.includes("/categories") || path.includes("/категорії")) return "layers";
  if (path.includes("/products") || path.includes("/товари")) return "package";
  if (path.includes("/suppliers") || path.includes("/постачальники")) return "truck";
  if (path.includes("/shops") || path.includes("/магазины") || path.includes("/магазини")) return "store";
  if (path.includes("/payments") || path.includes("/платежи") || path.includes("/платежі")) return "credit-card";
  if (path.includes("/permissions")) return "shield";
  if (path.includes("/api")) return "code";
  if (path.includes("/media")) return "image";
  if (path.includes("/personal") || path.includes("/profile")) return "user";

  return "circle";
};

