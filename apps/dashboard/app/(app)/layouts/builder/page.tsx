"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

function ZoneItem({
  zone,
  isSelected,
  onSelect,
  onDelete,
}: {
  zone: Zone;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: zone.id,
  });

  const style = {
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.width}%`,
    height: `${zone.height}%`,
    zIndex: zone.zIndex + 10,
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute border-2 rounded flex items-center justify-center cursor-move transition-colors ${
        isSelected
          ? "border-primary bg-primary/20"
          : "border-blue-400 bg-blue-100/50 hover:bg-blue-200/50"
      }`}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium truncate max-w-[80px]">
          {zone.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function Canvas({
  zones,
  selectedZone,
  onSelectZone,
  onDeleteZone,
  onDrop,
}: {
  zones: Zone[];
  selectedZone: string | null;
  onSelectZone: (id: string) => void;
  onDeleteZone: (id: string) => void;
  onDrop: (id: string, x: number, y: number) => void;
}) {
  const { setNodeRef } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      className="relative bg-gray-900 rounded-lg overflow-hidden"
      style={{ aspectRatio: "16/9" }}
    >
      <div className="absolute inset-0 opacity-10">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "5% 5%",
          }}
        />
      </div>
      {zones.map((zone) => (
        <ZoneItem
          key={zone.id}
          zone={zone}
          isSelected={selectedZone === zone.id}
          onSelect={() => onSelectZone(zone.id)}
          onDelete={() => onDeleteZone(zone.id)}
        />
      ))}
    </div>
  );
}

export default function LayoutBuilderPage() {
  const router = useRouter();
  const [layoutName, setLayoutName] = useState("Novo Layout");
  const [zones, setZones] = useState<Zone[]>([
    {
      id: "zone-main",
      name: "Main",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: 0,
    },
  ]);
  const [selectedZone, setSelectedZone] = useState<string | null>("zone-main");

  const selectedZoneData = zones.find((z) => z.id === selectedZone);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/layouts", { name: layoutName, zones }),
    onSuccess: () => router.push("/layouts"),
  });

  const addZone = useCallback(() => {
    const newZone: Zone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Zona ${zones.length + 1}`,
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      zIndex: zones.length,
    };
    setZones((prev) => [...prev, newZone]);
    setSelectedZone(newZone.id);
  }, [zones.length]);

  const deleteZone = useCallback((id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    setSelectedZone(null);
  }, []);

  const updateZone = useCallback((id: string, updates: Partial<Zone>) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, ...updates } : z))
    );
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.over || event.over.id !== "canvas") return;
      const { id } = event.active;
      const { delta } = event;
      const zone = zones.find((z) => z.id === id);
      if (!zone) return;

      // delta is in pixels, convert to percentage of canvas
      const canvas = document.querySelector("[data-droppable-id=canvas]");
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (delta.x / rect.width) * 100;
      const dy = (delta.y / rect.height) * 100;

      updateZone(String(id), {
        x: Math.max(0, Math.min(100 - zone.width, zone.x + dx)),
        y: Math.max(0, Math.min(100 - zone.height, zone.y + dy)),
      });
    },
    [zones, updateZone]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Editor de Layout</h1>
          <p className="text-muted-foreground">
            Projete layouts de zonas para suas telas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/layouts")}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Salvando..." : "Salvar Layout"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Canvas */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="text-lg font-semibold max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addZone}>
              <Plus className="mr-1 h-3 w-3" />
              Adicionar Zona
            </Button>
          </div>

          <DndContext onDragEnd={handleDragEnd}>
            <Canvas
              zones={zones}
              selectedZone={selectedZone}
              onSelectZone={setSelectedZone}
              onDeleteZone={deleteZone}
              onDrop={(id, x, y) => updateZone(id, { x, y })}
            />
          </DndContext>
        </div>

        {/* Zone Properties */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Propriedades da Zona</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedZoneData ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={selectedZoneData.name}
                      onChange={(e) =>
                        updateZone(selectedZoneData.id, { name: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["x", "y", "width", "height"] as const).map((prop) => (
                      <div key={prop} className="space-y-1">
                        <Label className="text-xs uppercase">{prop === "width" ? "LARGURA" : prop === "height" ? "ALTURA" : prop}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={selectedZoneData[prop]}
                          onChange={(e) =>
                            updateZone(selectedZoneData.id, {
                              [prop]: parseFloat(e.target.value),
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Camada (Z-Index)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={selectedZoneData.zIndex}
                      onChange={(e) =>
                        updateZone(selectedZoneData.id, {
                          zIndex: parseInt(e.target.value, 10),
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => deleteZone(selectedZoneData.id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Excluir Zona
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecione uma zona para editar suas propriedades.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-sm">Zonas ({zones.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  className={`w-full text-left rounded px-2 py-1.5 text-sm transition-colors ${
                    selectedZone === zone.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {zone.name}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
