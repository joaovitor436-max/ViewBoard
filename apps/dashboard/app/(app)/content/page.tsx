"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface ContentItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  durationSec: number;
  tags: string[];
  createdAt: string;
}

const contentTypeColors: Record<string, string> = {
  IMAGE: "bg-blue-100 text-blue-800",
  VIDEO: "bg-purple-100 text-purple-800",
  HTML: "bg-orange-100 text-orange-800",
  ANNOUNCEMENT: "bg-yellow-100 text-yellow-800",
  NEWS_FEED: "bg-green-100 text-green-800",
  WEATHER_WIDGET: "bg-sky-100 text-sky-800",
  CLOCK: "bg-gray-100 text-gray-800",
  TICKER: "bg-pink-100 text-pink-800",
};

export default function ContentPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["content", search],
    queryFn: () =>
      api.get<{ data: ContentItem[] }>("/content", { search: search || undefined }),
    staleTime: 10_000,
  });

  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Library</h1>
          <p className="text-muted-foreground">
            Manage images, videos, announcements and widgets
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Content
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search content..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No content found. Upload your first content item.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {item.name}
                  </CardTitle>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      contentTypeColors[item.type] ?? "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <CardDescription>
                  Duration: {item.durationSec}s &bull;{" "}
                  {new Date(item.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
