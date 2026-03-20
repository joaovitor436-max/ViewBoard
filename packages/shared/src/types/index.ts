export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export type ScreenStatus = "ONLINE" | "OFFLINE" | "ERROR";

export type DeviceStatus = "ONLINE" | "OFFLINE" | "PENDING";

export type Orientation = "LANDSCAPE" | "PORTRAIT";

export type MediaType = "IMAGE" | "VIDEO";

// LayoutTemplate is exported from schemas/layout.schema.ts (Zod-inferred)

// ContentType is exported from schemas/content.schema.ts (Zod-inferred)

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: Role;
  type: "access" | "refresh" | "screen" | "player";
  iat?: number;
  exp?: number;
}

export interface PlayerJwtPayload {
  sub: string;
  tenantId: string;
  deviceId: string;
  type: "player";
  iat?: number;
  exp?: number;
}

export interface ScreenJwtPayload {
  sub: string;
  tenantId: string;
  screenId: string;
  type: "screen";
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    timestamp?: string;
  };
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  city: string;
  country: string;
  updatedAt: string;
  forecast?: WeatherForecastItem[];
}

export interface WeatherForecastItem {
  time: string;
  temperature: number;
  description: string;
  icon: string;
}

export interface NewsItem {
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  timeAgo?: string;
}

export type WidgetType = "NEWS" | "WEATHER";

export interface WeatherWidgetConfig {
  city: string;
  unit: "celsius" | "fahrenheit";
  updateIntervalMinutes: number;
}

export interface NewsWidgetConfig {
  sources: string[];
  category?: string;
  language: string;
  maxItems: number;
  updateIntervalMinutes: number;
}

export interface WidgetConfigResponse {
  id: string;
  tenantId: string;
  type: WidgetType;
  config: WeatherWidgetConfig | NewsWidgetConfig;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerWidgetsPayload {
  weather: WeatherData | null;
  news: NewsItem[];
  weatherConfig: WeatherWidgetConfig | null;
  newsConfig: NewsWidgetConfig | null;
}

export interface ZoneLayout {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface TenantSettings {
  allowedDomains?: string[];
  maxScreens?: number;
  maxContent?: number;
  features?: {
    weather?: boolean;
    news?: boolean;
    analytics?: boolean;
  };
}
