"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Trash2,
  GripVertical,
  Film,
  Image as ImageIcon,
  ChevronLeft,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { PlaylistPreviewModal } from "@/components/playlist-preview-modal";

interface Playlist {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  layout: { id: string; name: string } | null;
  _count: { items: number };
}

interface MediaItem {
  id: string;
  name: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  sizeBytes: number;
}

interface PlaylistDetail {
  id: string;
  name: string;
  isActive: boolean;
  items: Array<{
    id: string;
    order: number;
    durationSec: number | null;
    media: MediaItem | null;
    content: { id: string; name: string; type: string } | null;
  }>;
}

export default function PlaylistsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [previewPlaylistId, setPreviewPlaylistId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // List playlists
  const { data: listData, isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => api.get<{ data: Playlist[] }>("/playlists"),
  });

  // Get selected playlist detail
  const { data: detailData } = useQuery({
    queryKey: ["playlist", selectedId],
    queryFn: () =>
      api.get<{ data: PlaylistDetail }>(`/playlists/${selectedId}`),
    enabled: !!selectedId,
  });

  // Media library for adding to playlist
  const { data: mediaData } = useQuery({
    queryKey: ["media-all"],
    queryFn: () =>
      api.get<{ data: MediaItem[] }>("/media", { pageSize: 100 }),
    enabled: showAddMedia,
  });

  // Create playlist
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<{ data: Playlist }>("/playlists", { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setShowCreate(false);
      setNewName("");
      setSelectedId(res.data.id);
    },
  });

  // Delete playlist
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/playlists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setSelectedId(null);
    },
  });

  // Add media to playlist
  const addItemMutation = useMutation({
    mutationFn: ({ playlistId, mediaId }: { playlistId: string; mediaId: string }) =>
      api.post(`/playlists/${playlistId}/items`, { mediaId, durationSec: 10 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  // Remove item from playlist
  const removeItemMutation = useMutation({
    mutationFn: ({ playlistId, itemId }: { playlistId: string; itemId: string }) =>
      api.delete(`/playlists/${playlistId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });

  // Reorder items
  const reorderMutation = useMutation({
    mutationFn: ({
      playlistId,
      items,
    }: {
      playlistId: string;
      items: Array<{ itemId: string; order: number }>;
    }) => api.patch(`/playlists/${playlistId}/items/reorder`, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", selectedId] });
    },
  });

  const playlists = listData?.data ?? [];
  const playlist = detailData?.data ?? null;
  const mediaLibrary = mediaData?.data ?? [];

  // Drag and drop reorder
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx || !playlist) return;

    const items = [...playlist.items];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(idx, 0, moved!);

    // Optimistically update the order display
    const updatedPlaylist = {
      ...playlist,
      items: items.map((item, i) => ({ ...item, order: i })),
    };
    queryClient.setQueryData(["playlist", selectedId], { data: updatedPlaylist });
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    if (!playlist || dragIdx === null) return;
    setDragIdx(null);

    const reorderData = playlist.items.map((item, i) => ({
      itemId: item.id,
      order: i,
    }));
    reorderMutation.mutate({ playlistId: playlist.id, items: reorderData });
  };

  // ── Playlist Detail View ────────────────────────────────────────────
  if (selectedId && playlist) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{playlist.name}</h1>
            <p className="text-sm text-muted-foreground">
              {playlist.items.length} item(ns) na playlist
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setPreviewPlaylistId(playlist.id)}
            disabled={playlist.items.length === 0}
          >
            <Play className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button onClick={() => setShowAddMedia(!showAddMedia)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Mídia
          </Button>
        </div>

        {/* Add Media Panel */}
        {showAddMedia && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Selecione mídias para adicionar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mediaLibrary.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma mídia disponível. Faça upload na página de Mídias.
                </p>
              ) : (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                  {mediaLibrary.map((media) => (
                    <button
                      key={media.id}
                      className="rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all text-left"
                      onClick={() =>
                        addItemMutation.mutate({
                          playlistId: playlist.id,
                          mediaId: media.id,
                        })
                      }
                    >
                      <div className="aspect-video bg-muted relative">
                        {media.thumbnailUrl ? (
                          <img
                            src={media.thumbnailUrl}
                            alt={media.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            {media.type === "VIDEO" ? (
                              <Film className="h-6 w-6 text-muted-foreground" />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <Plus className="absolute bottom-1 right-1 h-5 w-5 bg-primary text-white rounded-full p-0.5" />
                      </div>
                      <p className="text-xs p-1.5 truncate">{media.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Playlist Items */}
        {playlist.items.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">Playlist vazia</p>
            <p className="text-sm">Adicione mídias usando o botão acima</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-20">Thumb</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24">Tipo</TableHead>
                  <TableHead className="w-28">Duração</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {playlist.items.map((item, idx) => {
                  const media = item.media;
                  const content = item.content;
                  const name = media?.name ?? content?.name ?? "—";
                  const type = media?.type ?? content?.type ?? "—";
                  const thumb = media?.thumbnailUrl;
                  const isVideo = type === "VIDEO";

                  return (
                    <TableRow
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div className="w-16 h-10 rounded bg-muted overflow-hidden">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              {isVideo ? (
                                <Film className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            isVideo
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }
                        >
                          {isVideo ? "Vídeo" : "Imagem"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {item.durationSec ?? 10}s
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() =>
                            removeItemMutation.mutate({
                              playlistId: playlist.id,
                              itemId: item.id,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Preview Modal */}
        {previewPlaylistId && (
          <PlaylistPreviewModal
            playlistId={previewPlaylistId}
            onClose={() => setPreviewPlaylistId(null)}
          />
        )}
      </div>
    );
  }

  // ── Playlist List View ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Playlists</h1>
          <p className="text-muted-foreground">
            Configure sequências de conteúdo para suas telas
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Playlist
        </Button>
      </div>

      {/* Create playlist inline */}
      {showCreate && (
        <Card>
          <CardContent className="p-4 flex gap-3">
            <Input
              placeholder="Nome da playlist..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  createMutation.mutate(newName.trim());
                }
              }}
              autoFocus
            />
            <Button
              onClick={() => {
                if (newName.trim()) createMutation.mutate(newName.trim());
              }}
              disabled={!newName.trim() || createMutation.isPending}
            >
              Criar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
            >
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

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
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {playlists.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.name}
                      {p.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          Padrão
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{p.layout?.name ?? "—"}</TableCell>
                  <TableCell>{p._count.items} itens</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        p.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {p.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(p.id)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewPlaylistId(p.id)}
                        disabled={p._count.items === 0}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Deseja excluir esta playlist?")) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
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

      {/* Preview Modal */}
      {previewPlaylistId && (
        <PlaylistPreviewModal
          playlistId={previewPlaylistId}
          onClose={() => setPreviewPlaylistId(null)}
        />
      )}
    </div>
  );
}
