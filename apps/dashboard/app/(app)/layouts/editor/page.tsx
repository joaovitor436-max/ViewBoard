"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Monitor,
  SplitSquareHorizontal,
  Columns,
  Grid2X2,
  Clock,
  CloudSun,
  Newspaper,
  Upload,
  ArrowLeft,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api, apiUpload } from "@/lib/api-client";

// ── Tipos ────────────────────────────────────────────────────────────

type LayoutTemplate = "FULLSCREEN" | "SPLIT_BOTTOM" | "SPLIT_SIDE" | "GRID";

interface LayoutWidget {
  type: "clock" | "weather" | "news";
  enabled: boolean;
}

interface LayoutConfig {
  backgroundColor: string;
  logoUrl: string | null;
  widgets: LayoutWidget[];
  fontFamily: string;
  fontSize: number;
}

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  role: "media" | "widget";
}

interface LayoutData {
  id: string;
  name: string;
  template: LayoutTemplate;
  zones: Zone[];
  config: LayoutConfig;
  isDefault: boolean;
}

// ── Zonas padrão por template (espelho do backend) ───────────────────

function buildZones(template: LayoutTemplate): Zone[] {
  switch (template) {
    case "FULLSCREEN":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 100, zIndex: 0, role: "media" },
      ];
    case "SPLIT_BOTTOM":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 75, zIndex: 0, role: "media" },
        { id: "bottom", name: "Barra Inferior", x: 0, y: 75, width: 100, height: 25, zIndex: 1, role: "widget" },
      ];
    case "SPLIT_SIDE":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 70, height: 100, zIndex: 0, role: "media" },
        { id: "sidebar", name: "Coluna Lateral", x: 70, y: 0, width: 30, height: 100, zIndex: 1, role: "widget" },
      ];
    case "GRID":
      return [
        { id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 70, zIndex: 0, role: "media" },
        { id: "widget-left", name: "Widget Esquerdo", x: 0, y: 70, width: 50, height: 30, zIndex: 1, role: "widget" },
        { id: "widget-right", name: "Widget Direito", x: 50, y: 70, width: 50, height: 30, zIndex: 1, role: "widget" },
      ];
    default:
      return [{ id: "main", name: "Principal", x: 0, y: 0, width: 100, height: 100, zIndex: 0, role: "media" }];
  }
}

const DEFAULT_CONFIG: LayoutConfig = {
  backgroundColor: "#000000",
  logoUrl: null,
  widgets: [
    { type: "clock", enabled: true },
    { type: "weather", enabled: false },
    { type: "news", enabled: false },
  ],
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 16,
};

const TEMPLATES: { value: LayoutTemplate; label: string; description: string; icon: typeof Monitor }[] = [
  { value: "FULLSCREEN", label: "Tela Cheia", description: "Mídia ocupa 100% da tela", icon: Monitor },
  { value: "SPLIT_BOTTOM", label: "Barra Inferior", description: "75% mídia + barra inferior com widgets", icon: SplitSquareHorizontal },
  { value: "SPLIT_SIDE", label: "Coluna Lateral", description: "70% mídia + coluna direita com widgets", icon: Columns },
  { value: "GRID", label: "Grade", description: "Mídia principal + dois widgets abaixo", icon: Grid2X2 },
];

const WIDGET_INFO = {
  clock: { label: "Data/Hora", icon: Clock },
  weather: { label: "Clima", icon: CloudSun },
  news: { label: "Notícias", icon: Newspaper },
};

const FONT_OPTIONS = [
  { value: "Inter, system-ui, sans-serif", label: "Inter (Padrão)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Open Sans', sans-serif", label: "Open Sans" },
  { value: "'Courier New', monospace", label: "Courier New" },
];

// ── Componente de Preview 16:9 ───────────────────────────────────────

function LayoutPreview({
  template,
  zones,
  config,
}: {
  template: LayoutTemplate;
  zones: Zone[];
  config: LayoutConfig;
}) {
  const enabledWidgets = config.widgets.filter((w) => w.enabled);

  return (
    <div
      className="relative rounded-lg overflow-hidden border-2 border-border shadow-lg"
      style={{
        aspectRatio: "16/9",
        backgroundColor: config.backgroundColor,
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize * 0.5}px`,
      }}
    >
      {zones.map((zone) => {
        const isMedia = zone.role === "media";
        return (
          <div
            key={zone.id}
            className="absolute transition-all duration-300 ease-in-out"
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`,
              zIndex: zone.zIndex,
            }}
          >
            {isMedia ? (
              <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 flex flex-col items-center justify-center border border-white/10">
                <Monitor className="h-8 w-8 text-white/30 mb-1" />
                <span className="text-white/40 text-xs">Área de Mídia</span>
                {config.logoUrl && (
                  <div className="absolute top-2 left-2">
                    <img
                      src={config.logoUrl}
                      alt="Logo"
                      className="h-6 w-auto object-contain opacity-80"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                className="w-full h-full flex items-stretch border border-white/10"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                {enabledWidgets.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-white/30 text-xs">
                    Widgets
                  </div>
                ) : (
                  enabledWidgets.map((widget) => {
                    const info = WIDGET_INFO[widget.type];
                    const Icon = info.icon;
                    return (
                      <div
                        key={widget.type}
                        className="flex-1 flex flex-col items-center justify-center text-white/60 border-r border-white/10 last:border-r-0"
                      >
                        <Icon className="h-4 w-4 mb-0.5" />
                        <span className="text-[9px]">{info.label}</span>
                        {widget.type === "clock" && (
                          <span className="text-white/80 text-[10px] font-mono mt-0.5">
                            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {widget.type === "weather" && (
                          <span className="text-white/80 text-[10px] mt-0.5">25°C</span>
                        )}
                        {widget.type === "news" && (
                          <span className="text-white/80 text-[9px] mt-0.5 px-1 text-center truncate w-full">
                            Últimas notícias...
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal do editor ───────────────────────────────────────

function LayoutEditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const editId = searchParams.get("id");

  const [name, setName] = useState("Novo Layout");
  const [template, setTemplate] = useState<LayoutTemplate>("FULLSCREEN");
  const [config, setConfig] = useState<LayoutConfig>({ ...DEFAULT_CONFIG });
  const [isDefault, setIsDefault] = useState(false);
  const [zones, setZones] = useState<Zone[]>(buildZones("FULLSCREEN"));
  const [logoUploading, setLogoUploading] = useState(false);

  // Carregar layout existente para edição
  const { data: existingLayout } = useQuery({
    queryKey: ["layout", editId],
    queryFn: () => api.get<{ data: LayoutData }>(`/layouts/${editId}`),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existingLayout?.data) {
      const l = existingLayout.data;
      setName(l.name);
      setTemplate(l.template);
      setConfig({ ...DEFAULT_CONFIG, ...l.config });
      setIsDefault(l.isDefault);
      setZones(l.zones?.length ? l.zones : buildZones(l.template));
    }
  }, [existingLayout]);

  // Atualizar zonas quando o template muda
  const handleTemplateChange = useCallback((t: LayoutTemplate) => {
    setTemplate(t);
    setZones(buildZones(t));
  }, []);

  // Atualizar widget
  const toggleWidget = useCallback((type: "clock" | "weather" | "news") => {
    setConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.type === type ? { ...w, enabled: !w.enabled } : w
      ),
    }));
  }, []);

  // Upload de logo
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const result = await apiUpload<{ data: { url: string } }>("/media/upload", file);
      setConfig((prev) => ({ ...prev, logoUrl: result.data.url }));
    } catch {
      // falhou, manter sem logo
    } finally {
      setLogoUploading(false);
    }
  }, []);

  // Salvar (criar ou atualizar)
  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { name, template, config, isDefault };
      if (editId) {
        return api.patch(`/layouts/${editId}`, body);
      }
      return api.post("/layouts", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
      router.push("/layouts");
    },
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/layouts")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {editId ? "Editar Layout" : "Novo Layout"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure o template e os widgets que aparecerão na TV
            </p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Preview 16:9 */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Preview ao Vivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LayoutPreview template={template} zones={zones} config={config} />
            </CardContent>
          </Card>

          {/* Seleção de template */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Escolha o Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  const isActive = template === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => handleTemplateChange(t.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-2 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel de configuração */}
        <div className="lg:col-span-2 space-y-4">
          {/* Nome e Default */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Layout</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Layout Recepção"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-input"
                />
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Layout padrão do tenant</span>
              </label>
            </CardContent>
          </Card>

          {/* Aparência */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Aparência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Cor de Fundo</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig((c) => ({ ...c, backgroundColor: e.target.value }))}
                    className="h-9 w-12 rounded cursor-pointer border border-input"
                  />
                  <Input
                    value={config.backgroundColor}
                    onChange={(e) => setConfig((c) => ({ ...c, backgroundColor: e.target.value }))}
                    className="flex-1"
                    maxLength={7}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Fonte</Label>
                <Select
                  options={FONT_OPTIONS}
                  value={config.fontFamily}
                  onChange={(e) => setConfig((c) => ({ ...c, fontFamily: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tamanho da Fonte ({config.fontSize}px)</Label>
                <input
                  type="range"
                  min={10}
                  max={48}
                  value={config.fontSize}
                  onChange={(e) => setConfig((c) => ({ ...c, fontSize: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Logo da Empresa</Label>
                {config.logoUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={config.logoUrl} alt="Logo" className="h-10 w-auto object-contain rounded bg-muted p-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfig((c) => ({ ...c, logoUrl: null }))}
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer p-2 border border-dashed border-border rounded-md hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {logoUploading ? "Enviando..." : "Enviar logo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Widgets */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Widgets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {template === "FULLSCREEN" && (
                <p className="text-xs text-muted-foreground">
                  O template Tela Cheia não possui áreas de widget.
                </p>
              )}
              {template !== "FULLSCREEN" &&
                config.widgets.map((widget) => {
                  const info = WIDGET_INFO[widget.type];
                  const Icon = info.icon;
                  return (
                    <label
                      key={widget.type}
                      className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                        widget.enabled
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={widget.enabled}
                        onChange={() => toggleWidget(widget.type)}
                        className="rounded border-input"
                      />
                      <Icon className={`h-4 w-4 ${widget.enabled ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium">{info.label}</span>
                    </label>
                  );
                })}
            </CardContent>
          </Card>

          {/* Zonas (info) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Zonas do Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-sm bg-muted/50"
                >
                  <span className="font-medium">{zone.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {zone.width}% x {zone.height}% ({zone.role === "media" ? "mídia" : "widget"})
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LayoutEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Carregando editor...</div>}>
      <LayoutEditorContent />
    </Suspense>
  );
}
