"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Monitor,
  SplitSquareHorizontal,
  Columns,
  Grid2X2,
  Star,
  Trash2,
  Pencil,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

type LayoutTemplate = "FULLSCREEN" | "SPLIT_BOTTOM" | "SPLIT_SIDE" | "GRID";

interface LayoutConfig {
  backgroundColor?: string;
  logoUrl?: string | null;
  widgets?: Array<{ type: string; enabled: boolean }>;
  fontFamily?: string;
  fontSize?: number;
}

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role?: "media" | "widget";
}

interface Layout {
  id: string;
  name: string;
  template: LayoutTemplate;
  zones: Zone[];
  config: LayoutConfig;
  isDefault: boolean;
  createdAt: string;
  _count: { playlists: number; devices: number; deviceGroups: number };
}

const TEMPLATE_INFO: Record<
  LayoutTemplate,
  { label: string; icon: typeof Monitor }
> = {
  FULLSCREEN: { label: "Tela Cheia", icon: Monitor },
  SPLIT_BOTTOM: { label: "Barra Inferior", icon: SplitSquareHorizontal },
  SPLIT_SIDE: { label: "Coluna Lateral", icon: Columns },
  GRID: { label: "Grade", icon: Grid2X2 },
};

function MiniPreview({ zones, config }: { zones: Zone[]; config: LayoutConfig }) {
  return (
    <div
      className="relative rounded aspect-video overflow-hidden"
      style={{ backgroundColor: config.backgroundColor ?? "#000" }}
    >
      {zones.map((zone) => (
        <div
          key={zone.id}
          className={`absolute border transition-colors ${
            zone.role === "widget"
              ? "border-amber-400/50 bg-amber-400/10"
              : "border-blue-400/50 bg-blue-400/10"
          }`}
          style={{
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.width}%`,
            height: `${zone.height}%`,
          }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/40 truncate px-0.5">
            {zone.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LayoutsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["layouts"],
    queryFn: () => api.get<{ data: Layout[] }>("/layouts"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/layouts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["layouts"] }),
  });

  const layouts = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Layouts</h1>
          <p className="text-muted-foreground">
            Templates de exibição para suas TVs e dispositivos
          </p>
        </div>
        <Link href="/layouts/editor">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Layout
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-56" />
          ))}
        </div>
      ) : layouts.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Nenhum layout ainda. Crie seu primeiro layout para definir como o
          conteúdo é exibido na TV.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {layouts.map((layout) => {
            const tInfo = TEMPLATE_INFO[layout.template] ?? TEMPLATE_INFO.FULLSCREEN;
            const Icon = tInfo.icon;
            const enabledWidgets = (layout.config.widgets ?? []).filter(
              (w) => w.enabled
            );

            return (
              <Card
                key={layout.id}
                className="group hover:shadow-md transition-shadow relative"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {layout.isDefault && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                      {layout.name}
                    </CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => router.push(`/layouts/editor?id=${layout.id}`)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 hover:text-destructive"
                        onClick={() => {
                          if (confirm("Excluir este layout?")) {
                            deleteMutation.mutate(layout.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MiniPreview
                    zones={layout.zones}
                    config={layout.config}
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="gap-1">
                      <Icon className="h-3 w-3" />
                      {tInfo.label}
                    </Badge>
                    {enabledWidgets.map((w) => (
                      <Badge key={w.type} variant="outline" className="text-xs">
                        {w.type === "clock" ? "Relógio" : w.type === "weather" ? "Clima" : "Notícias"}
                      </Badge>
                    ))}
                  </div>

                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>{layout._count.playlists} playlist{layout._count.playlists !== 1 ? "s" : ""}</span>
                    <span>{layout._count.devices} dispositivo{layout._count.devices !== 1 ? "s" : ""}</span>
                    <span>{layout._count.deviceGroups} grupo{layout._count.deviceGroups !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
