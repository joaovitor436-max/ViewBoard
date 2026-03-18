"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Power, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScreenStatusBadge } from "@/components/screen-status-badge";
import { api } from "@/lib/api-client";
import { connectAsMonitor } from "@/lib/socket-client";
import { getUser } from "@/lib/auth";
import type { ScreenStatusPayload } from "@viewboard/shared";

interface ScreenDetail {
  id: string;
  name: string;
  location?: string;
  pairingCode: string;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  lastSeenAt?: string;
  orientation: string;
  resolution?: { width: number; height: number };
  currentPlaylistId?: string;
  heartbeats: Array<{ timestamp: string; metadata?: Record<string, unknown> }>;
}

export default function ScreenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = getUser();
  const [liveStatus, setLiveStatus] = useState<
    "ONLINE" | "OFFLINE" | "ERROR" | null
  >(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["screen", id],
    queryFn: () => api.get<{ data: ScreenDetail }>(`/screens/${id}`),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!user?.tenantId) return;

    const socket = connectAsMonitor(user.tenantId);

    const handleStatus = (payload: ScreenStatusPayload) => {
      if (payload.screenId === id) {
        setLiveStatus(payload.status);
      }
    };

    socket.on("screen:status", handleStatus);
    return () => {
      socket.off("screen:status", handleStatus);
    };
  }, [user?.tenantId, id]);

  const handleReboot = async () => {
    await api.post(`/screens/${id}/reboot`);
  };

  const handleRefreshContent = async () => {
    await api.post(`/screens/${id}/command`, { command: "refresh-content" });
  };

  const screen = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-6 w-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!screen) {
    return <div>Tela não encontrada</div>;
  }

  const currentStatus = liveStatus ?? screen.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{screen.name}</h1>
          <p className="text-muted-foreground">{screen.location ?? "Localização não definida"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleRefreshContent}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Atualizar Conteúdo
          </Button>
          <Button variant="destructive" onClick={handleReboot}>
            <Power className="mr-2 h-4 w-4" />
            Reiniciar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Situação</CardTitle>
          </CardHeader>
          <CardContent>
            <ScreenStatusBadge status={currentStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Código de Pareamento</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-lg font-bold">{screen.pairingCode}</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Orientação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{screen.orientation}</p>
            {screen.resolution && (
              <p className="text-xs text-muted-foreground">
                {screen.resolution.width} x {screen.resolution.height}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Última Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {screen.lastSeenAt
                ? new Date(screen.lastSeenAt).toLocaleString("pt-BR")
                : "Nunca"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Heartbeats Recentes</CardTitle>
          <CardDescription>Últimos 10 eventos de heartbeat desta tela</CardDescription>
        </CardHeader>
        <CardContent>
          {screen.heartbeats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum heartbeat registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {screen.heartbeats.map((hb, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                >
                  <span>{new Date(hb.timestamp).toLocaleString("pt-BR")}</span>
                  {hb.metadata && (
                    <span className="text-muted-foreground text-xs">
                      {JSON.stringify(hb.metadata)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
