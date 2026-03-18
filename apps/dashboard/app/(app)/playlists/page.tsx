"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

interface Playlist {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  layout: { id: string; name: string };
  _count: { items: number };
}

export default function PlaylistsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.get<{ data: Playlist[] }>("/playlists"),
  });

  const playlists = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Playlists</h1>
          <p className="text-muted-foreground">
            Configure sequências de conteúdo para suas telas
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Playlist
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Carregando playlists...
        </div>
      ) : playlists.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Nenhuma playlist ainda. Crie sua primeira playlist.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Layout</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {playlists.map((playlist) => (
                <TableRow key={playlist.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {playlist.name}
                      {playlist.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Padrão
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{playlist.layout.name}</TableCell>
                  <TableCell>{playlist._count.items} itens</TableCell>
                  <TableCell>
                    {new Date(playlist.createdAt).toLocaleDateString("pt-BR")}
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
