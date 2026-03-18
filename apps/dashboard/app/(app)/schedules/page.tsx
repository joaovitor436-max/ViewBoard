"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";

interface Schedule {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  priority: number;
  isActive: boolean;
  recurrence?: unknown;
  playlist: { id: string; name: string };
  screens: Array<{ screen: { id: string; name: string } }>;
}

export default function SchedulesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => api.get<{ data: Schedule[] }>("/schedules"),
  });

  const schedules = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">
            Control when playlists play on each screen
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Loading schedules...
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No schedules configured. Create your first schedule.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Playlist</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Screens</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell className="font-medium">
                    {schedule.name}
                    {schedule.recurrence && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (recurring)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{schedule.playlist.name}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(schedule.startAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(schedule.endAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {schedule.screens.map((s) => s.screen.name).join(", ")}
                  </TableCell>
                  <TableCell>{schedule.priority}</TableCell>
                  <TableCell>
                    <Badge
                      variant={schedule.isActive ? "success" : "secondary"}
                    >
                      {schedule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
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
