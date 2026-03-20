"use client";

import { useState, useCallback, memo } from "react";
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
  List,
  Save,
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
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api-client";
import { PlaylistPreviewModal } from "@/components/playlist-preview-modal";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useKeyboardSave } from "@/lib/hooks";

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

// Componente de item de midia memoizado
const MediaThumbnail = memo(function MediaThumbnail({
  media,
  onClick,
}: {
  media: MediaItem;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all text-left"
      onClick={onClick}
    >
      <div className="aspect-video bg-muted relative">
        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.name}
            className="w-full h-full object-cover"
            loading="lazy"
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
  );
});

export default function PlaylistsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [previewPlaylistId, setPreviewPlaylistId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  // Ctrl+S para salvar (reorder) a playlist
  const handleSave = useCallback(() => {
    if (!selectedId) return;
    const detail = queryClient.getQueryData<{ data: PlaylistDetail }>(["playlist", selectedId]);
    if (!detail?.data) return;

    const reorderData = detail.data.items.map((item, i) => ({
      itemId: item.id,
      order: i,
    }));
    reorderMutation.mutate({ playlistId: selectedId, items: reorderData });
  }, [selectedId, queryClient]);

  useKeyboardSave(handleSave);

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
      toast.success("Playlist criada com sucesso");
    },
    onError: () => {
      toast.error("Erro ao criar playlist");
    },
  });

  // Delete playlist
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/playlists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setSelectedId(null);
      toast.success("Playlist excluida com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir playlist");
    },
  });

  const handleDeletePlaylist = useCallback(
    async (id: string, name: string) => {
      const ok = await confirm({
        title: "Excluir playlist",
        description: `Tem certeza que deseja excluir a playlist "${name}"? Esta acao nao pode ser desfeita.`,
        confirmLabel: "Excluir",
        variant: "destructive",
      });
      if (ok) deleteMutation.mutate(id);
    },
    [confirm, deleteMutation]
  );

  // Add media to playlist
  const addItemMutation = useMutation({
    mutationFn: ({ playlistId, mediaId }: { playlistId: string; mediaId: string }) =>
      api.post(`/playlists/${playlistId}/items`, { mediaId, durationSec: 10 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Midia adicionada a playlist");
    },
    onError: () => {
      toast.error("Erro ao adicionar midia");
    },
  });

  // Remove item from playlist
  const removeItemMutation = useMutation({
    mutationFn: ({ playlistId, itemId }: { playlistId: string; itemId: string }) =>
      api.delete(`/playlists/${playlistId}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Item removido da playlist");
    },
    onError: () => {
      toast.error("Erro ao remover item");
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
      toast.success("Ordem salva com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar ordem");
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold">{playlist.name}</h1>
            <p className="text-sm text-muted-foreground">
              {playlist.items.length} item(ns) na playlist
              <span className="hidden sm:inline"> &bull; Ctrl+S para salvar</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              title="Salvar ordem (Ctrl+S)"
            >
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewPlaylistId(playlist.id)}
              disabled={playlist.items.length === 0}
            >
              <Play className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button size="sm" onClick={() => setShowAddMedia(!showAddMedia)}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar Midia
            </Button>
          </div>
        </div>

        {/* Add Media Panel */}
        {showAddMedia && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Selecione midias para adicionar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mediaLibrary.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma midia disponivel. Faca upload na pagina de Midias.
                </p>
              ) : (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                  {mediaLibrary.map((media) => (
                    <MediaThumbnail
                      key={media.id}
                      media={media}
                      onClick={() =>
                        addItemMutation.mutate({
                          playlistId: playlist.id,
                          mediaId: media.id,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Playlist Items */}
        {playlist.items.length === 0 ? (
          <EmptyState
            icon={List}
            title="Playlist vazia"
            description="Adicione midias usando o botao acima"
            actionLabel="Adicionar Midia"
            onAction={() => setShowAddMedia(true)}
          />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="w-20">Thumb</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24 hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="w-28 hidden sm:table-cell">Duracao</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {playlist.items.map((item, idx) => {
                  const media = item.media;
                  const content = item.content;
                  const name = media?.name ?? content?.name ?? "--";
                  const type = media?.type ?? content?.type ?? "--";
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
                              loading="lazy"
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
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant="secondary"
                          className={
                            isVideo
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }
                        >
                          {isVideo ? "Video" : "Imagem"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Playlists</h1>
          <p className="text-muted-foreground text-sm">
            Configure sequencias de conteudo para suas telas
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
        <TableSkeleton rows={5} cols={5} />
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={List}
          title="Nenhuma playlist ainda"
          description="Crie sua primeira playlist para organizar conteudo"
          actionLabel="Nova Playlist"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Layout</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
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
                          Padrao
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.layout?.name ?? "--"}</TableCell>
                  <TableCell>{p._count.items} itens</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant="secondary"
                      className={
                        p.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }
                    >
                      {p.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
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
                        onClick={() => handleDeletePlaylist(p.id, p.name)}
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
