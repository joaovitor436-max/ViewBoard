"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Monitor, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenStatusBadge } from "@/components/screen-status-badge";
import { api } from "@/lib/api-client";
import { connectAsMonitor } from "@/lib/socket-client";
import { getUser } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
  const toast = useToast();
  const confirm = useConfirm();
  const [liveStatuses, setLiveStatuses] = useState<
    Record<string, "ONLINE" | "OFFLINE" | "ERROR">
  >({});
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formOrientation, setFormOrientation] = useState("LANDSCAPE");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["screens"],
    queryFn: () => api.get<{ data: Screen[] }>("/screens"),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; location?: string; orientation?: string }) =>
      api.post<{ data: Screen }>("/screens", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screens"] });
      setModalOpen(false);
      setFormName("");
      setFormLocation("");
      setFormOrientation("LANDSCAPE");
      toast.success("Tela criada com sucesso");
    },
    onError: () => {
      toast.error("Erro ao criar tela");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/screens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screens"] });
      toast.success("Tela removida com sucesso");
    },
    onError: () => {
      toast.error("Erro ao remover tela");
    },
  });

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const ok = await confirm({
        title: "Remover tela",
        description: `Tem certeza que deseja remover a tela "${name}"? O dispositivo sera desvinculado.`,
        confirmLabel: "Remover",
        variant: "destructive",
      });
      if (ok) deleteMutation.mutate(id);
    },
    [confirm, deleteMutation]
  );

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

  function handleSubmit() {
    if (!formName.trim()) return;
    const body: { name: string; location?: string; orientation?: string } = {
      name: formName.trim(),
    };
    if (formLocation.trim()) body.location = formLocation.trim();
    if (formOrientation) body.orientation = formOrientation;
    createMutation.mutate(body);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Telas</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie e monitore suas telas de exibicao
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Tela
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : screens.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="Nenhuma tela encontrada"
          description="Adicione sua primeira tela para comecar a exibir conteudo"
          actionLabel="Adicionar Tela"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Localizacao</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Orientacao</TableHead>
                <TableHead className="hidden lg:table-cell">Codigo</TableHead>
                <TableHead className="hidden md:table-cell">Ultima Conexao</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {screens.map((screen) => (
                <TableRow key={screen.id}>
                  <TableCell className="font-medium">{screen.name}</TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {screen.location ?? "--"}
                  </TableCell>
                  <TableCell>
                    <ScreenStatusBadge
                      status={liveStatuses[screen.id] ?? screen.status}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{screen.orientation}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {screen.pairingCode}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                    {screen.lastSeenAt
                      ? new Date(screen.lastSeenAt).toLocaleString("pt-BR")
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/screens/${screen.id}`}>
                        <Button variant="ghost" size="sm">
                          Ver
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(screen.id, screen.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal Adicionar Tela */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onOpenChange={setModalOpen} />
          <DialogHeader>
            <DialogTitle>Adicionar Tela</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="screen-name">Nome</Label>
              <Input
                id="screen-name"
                placeholder="Ex: TV Recepcao"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="screen-location">Localizacao (opcional)</Label>
              <Input
                id="screen-location"
                placeholder="Ex: Andar 1, Recepcao"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="screen-orientation">Orientacao</Label>
              <Select
                id="screen-orientation"
                value={formOrientation}
                onChange={(e) => setFormOrientation(e.target.value)}
                options={[
                  { value: "LANDSCAPE", label: "Paisagem (horizontal)" },
                  { value: "PORTRAIT", label: "Retrato (vertical)" },
                ]}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Tela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
