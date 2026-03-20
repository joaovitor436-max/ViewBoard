export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export type ScreenStatus = "ONLINE" | "OFFLINE" | "ERROR";

export type DeviceStatus = "ONLINE" | "OFFLINE" | "PENDING";

export type Orientation = "LANDSCAPE" | "PORTRAIT";

export type MediaType = "IMAGE" | "VIDEO";

export type LayoutTemplate = "FULLSCREEN" | "SPLIT_BOTTOM" | "SPLIT_SIDE" | "GRID";

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
}

export interface NewsItem {
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
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
