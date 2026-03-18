"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface Layout {
  id: string;
  name: string;
  zones: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  _count: { playlists: number };
}

export default function LayoutsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["layouts"],
    queryFn: () => api.get<{ data: Layout[] }>("/layouts"),
  });

  const layouts = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Layouts</h1>
          <p className="text-muted-foreground">
            Design zone configurations for your screens
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/layouts/builder">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Layout
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-48" />
          ))}
        </div>
      ) : layouts.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No layouts yet. Create your first layout.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {layouts.map((layout) => (
            <Card key={layout.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{layout.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mini zone preview */}
                <div className="relative bg-muted rounded aspect-video mb-3">
                  {layout.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="absolute border-2 border-primary/50 bg-primary/10 rounded text-xs flex items-center justify-center overflow-hidden"
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                      }}
                    >
                      <span className="truncate px-1">{zone.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {layout.zones.length} zone{layout.zones.length !== 1 ? "s" : ""} &bull;{" "}
                  {layout._count.playlists} playlist{layout._count.playlists !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
