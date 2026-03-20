"use client";

import { useState, useCallback, useRef, memo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
  Upload,
  Trash2,
  Image as ImageIcon,
  Film,
  X,
  FileUp,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api, apiUpload } from "@/lib/api-client";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDebounce, useInfiniteScroll } from "@/lib/hooks";

interface MediaItem {
  id: string;
  name: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  sizeBytes: number;
  createdAt: string;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const PAGE_SIZE = 24;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Tipo nao suportado: ${file.type}. Use JPG, PNG, GIF, WEBP, MP4 ou WEBM.`;
  }
  if (file.type.startsWith("image/") && file.size > MAX_IMAGE_SIZE) {
    return `Imagem muito grande (${formatFileSize(file.size)}). Maximo: 10MB.`;
  }
  if (file.type.startsWith("video/") && file.size > MAX_VIDEO_SIZE) {
    return `Video muito grande (${formatFileSize(file.size)}). Maximo: 500MB.`;
  }
  return null;
}

// Componente de card memoizado para evitar re-renders desnecessários
const MediaCard = memo(function MediaCard({
  item,
  onDelete,
}: {
  item: MediaItem;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group overflow-hidden rounded-lg border hover:shadow-md transition-shadow bg-card">
      {/* Thumbnail com lazy loading */}
      <div className="relative aspect-video bg-muted">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            {item.type === "VIDEO" ? (
              <Film className="h-10 w-10 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
        )}

        <Badge
          className={`absolute top-2 left-2 text-xs ${
            item.type === "VIDEO"
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {item.type === "VIDEO" ? (
            <Film className="h-3 w-3 mr-1" />
          ) : (
            <ImageIcon className="h-3 w-3 mr-1" />
          )}
          {item.type === "VIDEO" ? "Video" : "Imagem"}
        </Badge>

        {item.duration && (
          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(item.duration)}
          </span>
        )}

        <Button
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CardContent className="p-3">
        <p className="font-medium text-sm truncate" title={item.name}>
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatFileSize(item.sizeBytes)} &bull;{" "}
          {new Date(item.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </CardContent>
    </div>
  );
});

export default function MediaPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showUpload, setShowUpload] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<
    Array<{ file: File; progress: number; error?: string; done?: boolean }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  // Paginacao infinita
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["media", debouncedSearch],
    queryFn: ({ pageParam = 1 }) =>
      api.get<{ data: MediaItem[]; meta: { total: number; page: number; pageSize: number } }>("/media", {
        search: debouncedSearch || undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      const { page, pageSize } = lastPage.meta;
      const totalPages = Math.ceil(lastPage.meta.total / pageSize);
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 10_000,
  });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  const sentinelRef = useInfiniteScroll(
    () => fetchNextPage(),
    !!hasNextPage,
    isFetchingNextPage
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success("Midia excluida com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir midia");
    },
  });

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: "Excluir midia",
        description: "Tem certeza que deseja excluir esta midia? Esta acao nao pode ser desfeita.",
        confirmLabel: "Excluir",
        variant: "destructive",
      });
      if (ok) deleteMutation.mutate(id);
    },
    [confirm, deleteMutation]
  );

  const handleUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const entries = fileArray.map((file) => ({
        file,
        progress: 0,
        error: validateFile(file) ?? undefined,
        done: false,
      }));

      setUploadQueue((prev) => [...prev, ...entries]);
      setShowUpload(true);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        if (entry.error) {
          errorCount++;
          continue;
        }

        try {
          await apiUpload("/media/upload", entry.file, (percent) => {
            setUploadQueue((prev) => {
              const updated = [...prev];
              const idx = prev.length - entries.length + i;
              if (updated[idx]) {
                updated[idx] = { ...updated[idx]!, progress: percent };
              }
              return updated;
            });
          });

          setUploadQueue((prev) => {
            const updated = [...prev];
            const idx = prev.length - entries.length + i;
            if (updated[idx]) {
              updated[idx] = { ...updated[idx]!, progress: 100, done: true };
            }
            return updated;
          });
          successCount++;
        } catch (err: unknown) {
          errorCount++;
          const msg = err instanceof Error ? err.message : "Falha no upload";
          setUploadQueue((prev) => {
            const updated = [...prev];
            const idx = prev.length - entries.length + i;
            if (updated[idx]) {
              updated[idx] = { ...updated[idx]!, error: msg };
            }
            return updated;
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["media"] });

      if (successCount > 0) {
        toast.success(`${successCount} arquivo(s) enviado(s) com sucesso`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} arquivo(s) com erro no upload`);
      }
    },
    [queryClient, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        handleUploadFiles(e.dataTransfer.files);
      }
    },
    [handleUploadFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Biblioteca de Midias</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie imagens e videos para suas playlists
          </p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleUploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Search com debounce */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar midias..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Upload zone + queue */}
      {showUpload && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileUp className="h-4 w-4" /> Upload de Midias
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowUpload(false);
                setUploadQueue([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {uploadQueue.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="truncate flex-1">{entry.file.name}</span>
              {entry.error ? (
                <span className="text-red-500 text-xs shrink-0">{entry.error}</span>
              ) : entry.done ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Concluido
                </Badge>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                  <span className="text-xs w-10 text-right">{entry.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Arraste arquivos aqui ou{" "}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-primary underline"
          >
            clique para selecionar
          </button>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, GIF, WEBP (max 10MB) ou MP4, WEBM (max 500MB)
        </p>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <CardGridSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhuma midia encontrada"
          description="Faca upload do seu primeiro arquivo para comecar"
          actionLabel="Upload"
          onAction={() => fileInputRef.current?.click()}
        />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <MediaCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>

          {/* Sentinel para paginacao infinita */}
          {hasNextPage && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <div className="text-sm text-muted-foreground">Carregando mais...</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
