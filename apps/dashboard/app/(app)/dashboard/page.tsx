"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Monitor,
  WifiOff,
  AlertTriangle,
  Image,
  List,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

interface DashboardStats {
  screens: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
  content: { total: number };
  playlists: { total: number };
  schedules: { active: number };
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  className,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get<{ data: DashboardStats }>("/monitoring/stats"),
    refetchInterval: 30_000,
  });

  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your digital signage network
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Online Screens"
          value={stats?.screens.online ?? 0}
          icon={Monitor}
          description={`of ${stats?.screens.total ?? 0} total screens`}
          className="border-green-200"
        />
        <StatCard
          title="Offline Screens"
          value={stats?.screens.offline ?? 0}
          icon={WifiOff}
          description="Not connected"
        />
        <StatCard
          title="Error Screens"
          value={stats?.screens.error ?? 0}
          icon={AlertTriangle}
          description="Require attention"
          className={
            (stats?.screens.error ?? 0) > 0 ? "border-red-200" : undefined
          }
        />
        <StatCard
          title="Total Content"
          value={stats?.content.total ?? 0}
          icon={Image}
          description="Active items"
        />
        <StatCard
          title="Playlists"
          value={stats?.playlists.total ?? 0}
          icon={List}
          description="Configured playlists"
        />
        <StatCard
          title="Active Schedules"
          value={stats?.schedules.active ?? 0}
          icon={Calendar}
          description="Running schedules"
        />
      </div>
    </div>
  );
}
