"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  Newspaper,
  Save,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api-client";

interface WidgetConfigResponse {
  id: string;
  tenantId: string;
  type: "NEWS" | "WEATHER";
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WeatherConfig {
  city: string;
  unit: "celsius" | "fahrenheit";
  updateIntervalMinutes: number;
}

interface NewsConfig {
  sources: string[];
  category: string;
  language: string;
  maxItems: number;
  updateIntervalMinutes: number;
}

interface WeatherPreview {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  city: string;
  country: string;
}

interface NewsPreview {
  title: string;
  source: string;
  timeAgo?: string;
  imageUrl?: string;
}

const NEWS_CATEGORIES = [
  { value: "general", label: "Geral" },
  { value: "business", label: "Negócios" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "health", label: "Saúde" },
  { value: "science", label: "Ciência" },
  { value: "sports", label: "Esportes" },
  { value: "technology", label: "Tecnologia" },
];

const CITY_SUGGESTIONS = [
  "São Paulo",
  "Rio de Janeiro",
  "Brasília",
  "Curitiba",
  "Belo Horizonte",
  "Porto Alegre",
  "Salvador",
  "Fortaleza",
  "Recife",
  "Manaus",
];

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<WidgetConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Weather form state
  const [weatherConfig, setWeatherConfig] = useState<WeatherConfig>({
    city: "São Paulo",
    unit: "celsius",
    updateIntervalMinutes: 10,
  });
  const [weatherId, setWeatherId] = useState<string | null>(null);
  const [weatherActive, setWeatherActive] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [weatherPreview, setWeatherPreview] = useState<WeatherPreview | null>(null);

  // News form state
  const [newsConfig, setNewsConfig] = useState<NewsConfig>({
    sources: [],
    category: "general",
    language: "pt",
    maxItems: 10,
    updateIntervalMinutes: 15,
  });
  const [newsId, setNewsId] = useState<string | null>(null);
  const [newsActive, setNewsActive] = useState(false);
  const [newsPreview, setNewsPreview] = useState<NewsPreview[]>([]);

  const loadWidgets = useCallback(async () => {
    try {
      const res = await api.get<{ data: WidgetConfigResponse[] }>("/widgets");
      const list = res.data;
      setWidgets(list);

      const weatherWidget = list.find((w) => w.type === "WEATHER");
      if (weatherWidget) {
        setWeatherId(weatherWidget.id);
        setWeatherActive(weatherWidget.isActive);
        const cfg = weatherWidget.config as unknown as WeatherConfig;
        setWeatherConfig({
          city: cfg.city ?? "São Paulo",
          unit: cfg.unit ?? "celsius",
          updateIntervalMinutes: cfg.updateIntervalMinutes ?? 10,
        });
        setCitySearch(cfg.city ?? "São Paulo");
      }

      const newsWidget = list.find((w) => w.type === "NEWS");
      if (newsWidget) {
        setNewsId(newsWidget.id);
        setNewsActive(newsWidget.isActive);
        const cfg = newsWidget.config as unknown as NewsConfig;
        setNewsConfig({
          sources: cfg.sources ?? [],
          category: cfg.category ?? "general",
          language: cfg.language ?? "pt",
          maxItems: cfg.maxItems ?? 10,
          updateIntervalMinutes: cfg.updateIntervalMinutes ?? 15,
        });
      }
    } catch {
      // Ignore load errors
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeatherPreview = useCallback(async () => {
    try {
      const res = await api.get<{ data: WeatherPreview }>(
        "/integrations/weather",
        { city: weatherConfig.city }
      );
      setWeatherPreview(res.data);
    } catch {
      setWeatherPreview(null);
    }
  }, [weatherConfig.city]);

  const loadNewsPreview = useCallback(async () => {
    try {
      const res = await api.get<{ data: NewsPreview[] }>(
        "/integrations/news",
        { pageSize: 5, category: newsConfig.category }
      );
      setNewsPreview(res.data);
    } catch {
      setNewsPreview([]);
    }
  }, [newsConfig.category]);

  useEffect(() => {
    loadWidgets();
  }, [loadWidgets]);

  useEffect(() => {
    if (weatherConfig.city) loadWeatherPreview();
  }, [weatherConfig.city, loadWeatherPreview]);

  useEffect(() => {
    loadNewsPreview();
  }, [loadNewsPreview]);

  const filteredCities = CITY_SUGGESTIONS.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  async function saveWeather() {
    setSaving(true);
    try {
      if (weatherId) {
        await api.patch(`/widgets/${weatherId}`, {
          config: weatherConfig,
          isActive: weatherActive,
        });
      } else {
        const res = await api.post<{ data: WidgetConfigResponse }>("/widgets", {
          type: "WEATHER",
          config: weatherConfig,
          isActive: true,
        });
        setWeatherId(res.data.id);
        setWeatherActive(true);
      }
    } catch {
      // Handle save error
    } finally {
      setSaving(false);
    }
  }

  async function saveNews() {
    setSaving(true);
    try {
      if (newsId) {
        await api.patch(`/widgets/${newsId}`, {
          config: newsConfig,
          isActive: newsActive,
        });
      } else {
        const res = await api.post<{ data: WidgetConfigResponse }>("/widgets", {
          type: "NEWS",
          config: newsConfig,
          isActive: true,
        });
        setNewsId(res.data.id);
        setNewsActive(true);
      }
    } catch {
      // Handle save error
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Widgets</h1>
        <p className="text-muted-foreground">
          Configure os widgets de clima e notícias que aparecem nas TVs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Weather Widget ───────────────────────────── */}
        <div className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Previsão do Tempo</h2>
            </div>
            <button
              onClick={() => {
                setWeatherActive(!weatherActive);
                if (weatherId) {
                  api.patch(`/widgets/${weatherId}`, { isActive: !weatherActive });
                }
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                weatherActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {weatherActive ? (
                <>
                  <Power className="h-3 w-3" /> Ativo
                </>
              ) : (
                <>
                  <PowerOff className="h-3 w-3" /> Inativo
                </>
              )}
            </button>
          </div>

          {/* City search */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cidade</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  setShowCitySuggestions(true);
                }}
                onFocus={() => setShowCitySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                placeholder="Buscar cidade..."
                className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showCitySuggestions && filteredCities.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {filteredCities.map((city) => (
                    <button
                      key={city}
                      onMouseDown={() => {
                        setCitySearch(city);
                        setWeatherConfig((c) => ({ ...c, city }));
                        setShowCitySuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Unidade</label>
            <div className="flex gap-2">
              {(["celsius", "fahrenheit"] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setWeatherConfig((c) => ({ ...c, unit }))}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    weatherConfig.unit === unit
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {unit === "celsius" ? "°C Celsius" : "°F Fahrenheit"}
                </button>
              ))}
            </div>
          </div>

          {/* Update interval */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Intervalo de atualização: {weatherConfig.updateIntervalMinutes} min
            </label>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={weatherConfig.updateIntervalMinutes}
              onChange={(e) =>
                setWeatherConfig((c) => ({
                  ...c,
                  updateIntervalMinutes: parseInt(e.target.value, 10),
                }))
              }
              className="w-full"
            />
          </div>

          {/* Preview */}
          {weatherPreview && (
            <div className="rounded-lg overflow-hidden">
              <div
                className="p-4 text-white text-center"
                style={{
                  background: "linear-gradient(135deg, #1e3a5f, #2980b9)",
                }}
              >
                <div className="text-sm opacity-80">
                  {weatherPreview.city}, {weatherPreview.country}
                </div>
                <div className="flex items-center justify-center gap-2 my-1">
                  <img
                    src={`https://openweathermap.org/img/wn/${weatherPreview.icon}@2x.png`}
                    alt={weatherPreview.description}
                    className="h-12 w-12"
                  />
                  <span className="text-4xl font-bold">
                    {weatherPreview.temperature}°
                    {weatherConfig.unit === "celsius" ? "C" : "F"}
                  </span>
                </div>
                <div className="text-sm capitalize">{weatherPreview.description}</div>
                <div className="text-xs opacity-60 mt-1">
                  Sensação {weatherPreview.feelsLike}° · Umidade{" "}
                  {weatherPreview.humidity}%
                </div>
              </div>
            </div>
          )}

          <button
            onClick={saveWeather}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {weatherId ? "Salvar alterações" : "Criar widget de clima"}
          </button>
        </div>

        {/* ── News Widget ──────────────────────────────── */}
        <div className="rounded-lg border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold">Notícias</h2>
            </div>
            <button
              onClick={() => {
                setNewsActive(!newsActive);
                if (newsId) {
                  api.patch(`/widgets/${newsId}`, { isActive: !newsActive });
                }
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                newsActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {newsActive ? (
                <>
                  <Power className="h-3 w-3" /> Ativo
                </>
              ) : (
                <>
                  <PowerOff className="h-3 w-3" /> Inativo
                </>
              )}
            </button>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoria</label>
            <select
              value={newsConfig.category}
              onChange={(e) =>
                setNewsConfig((c) => ({ ...c, category: e.target.value }))
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {NEWS_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Idioma</label>
            <select
              value={newsConfig.language}
              onChange={(e) =>
                setNewsConfig((c) => ({ ...c, language: e.target.value }))
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
              <option value="es">Espanhol</option>
            </select>
          </div>

          {/* Max items */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Máximo de manchetes: {newsConfig.maxItems}
            </label>
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={newsConfig.maxItems}
              onChange={(e) =>
                setNewsConfig((c) => ({
                  ...c,
                  maxItems: parseInt(e.target.value, 10),
                }))
              }
              className="w-full"
            />
          </div>

          {/* Update interval */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Intervalo de atualização: {newsConfig.updateIntervalMinutes} min
            </label>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={newsConfig.updateIntervalMinutes}
              onChange={(e) =>
                setNewsConfig((c) => ({
                  ...c,
                  updateIntervalMinutes: parseInt(e.target.value, 10),
                }))
              }
              className="w-full"
            />
          </div>

          {/* Sources */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Fontes RSS personalizadas (opcional)
            </label>
            <input
              type="text"
              value={newsConfig.sources.join(", ")}
              onChange={(e) =>
                setNewsConfig((c) => ({
                  ...c,
                  sources: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="bbc-news, cnn, google-news-br"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Separar com vírgulas. Deixe vazio para usar as manchetes do país.
            </p>
          </div>

          {/* Preview */}
          {newsPreview.length > 0 && (
            <div className="rounded-lg border overflow-hidden divide-y">
              {newsPreview.slice(0, 4).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-background"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.source}
                      {item.timeAgo && ` · ${item.timeAgo}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={saveNews}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {newsId ? "Salvar alterações" : "Criar widget de notícias"}
          </button>
        </div>
      </div>
    </div>
  );
}
