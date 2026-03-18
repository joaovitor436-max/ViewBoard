"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScreenStatusBadge } from "@/components/screen-status-badge";
import { api } from "@/lib/api-client";
import { connectAsMonitor, getSocket } from "@/lib/socket-client";
import { getUser } from "@/lib/auth";
import type { ScreenStatusPayload } from "@viewboard/shared";

interface Screen {
  id: string;
  name: string;
  location?: string;
  pairingCode: string;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  lastSeenAt?: string;
  orientation: string;
}

export default function ScreensPage() {
  const queryClient = useQueryClient();
  const user = getUser();
  const [liveStatuses, setLiveStatuses] = useState<
    Record<string, "ONLINE" | "OFFLINE" | "ERROR">
  >({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["screens"],
    queryFn: () => api.get<{ data: Screen[] }>("/screens"),
  });

  useEffect(() => {
    if (!user?.tenantId) return;

    const socket = connectAsMonitor(user.tenantId);

    const handleStatus = (payload: ScreenStatusPayload) => {
      setLiveStatuses((prev) => ({
        ...prev,
        [payload.screenId]: payload.status,
      }));
      queryClient.invalidateQueries({ queryKey: ["screens"] });
    };

    socket.on("screen:status", handleStatus);
    return () => {
      socket.off("screen:status", handleStatus);
    };
  }, [user?.tenantId, queryClient]);

  const screens = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Screens</h1>
          <p className="text-muted-foreground">
            Manage and monitor your display screens
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Screen
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Loading screens...
        </div>
      ) : screens.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No screens found. Add your first screen to get started.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orientation</TableHead>
                <TableHead>Pairing Code</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {screens.map((screen) => (
                <TableRow key={screen.id}>
                  <TableCell className="font-medium">{screen.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {screen.location ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ScreenStatusBadge
                      status={liveStatuses[screen.id] ?? screen.status}
                    />
                  </TableCell>
                  <TableCell>{screen.orientation}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {screen.pairingCode}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {screen.lastSeenAt
                      ? new Date(screen.lastSeenAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/screens/${screen.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
