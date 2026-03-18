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
          <h1 className="text-3xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground">
            Controle quando as playlists são exibidas em cada tela
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Carregando agendamentos...
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum agendamento configurado. Crie seu primeiro agendamento.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Playlist</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Telas</TableHead>
                <TableHead>Prioridade</TableHead>
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
                        (recorrente)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{schedule.playlist.name}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(schedule.startAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(schedule.endAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {schedule.screens.map((s) => s.screen.name).join(", ")}
                  </TableCell>
                  <TableCell>{schedule.priority}</TableCell>
                  <TableCell>
                    <Badge
                      variant={schedule.isActive ? "success" : "secondary"}
                    >
                      {schedule.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Editar
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
