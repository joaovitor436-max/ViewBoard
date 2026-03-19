"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  Plus,
  Calendar,
  List,
  History,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

import "react-big-calendar/lib/css/react-big-calendar.css";

// ── Types ───────────────────────────────────────────────────────────

interface Schedule {
  id: string;
  name: string;
  startAt: string;
  endAt: string | null;
  priority: number;
  isActive: boolean;
  recurrence: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
  daysOfWeek: number[];
  playlist: { id: string; name: string };
  device: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
  screens: Array<{ screen: { id: string; name: string } }>;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  name: string;
  startAt: string;
  endAt: string | null;
  priority: number;
  color: string;
  playlistName: string;
  recurrence: string;
  daysOfWeek: number[];
  isActive: boolean;
  deviceName: string | null;
  groupName: string | null;
}

interface ScheduleLog {
  id: string;
  scheduleId: string;
  deviceId: string;
  executedAt: string;
  status: "SUCCESS" | "SKIPPED" | "ERROR";
  message: string | null;
  schedule: { name: string };
}

interface Playlist {
  id: string;
  name: string;
}

interface Device {
  id: string;
  name: string;
  status: string;
}

interface DeviceGroup {
  id: string;
  name: string;
  _count?: { devices: number };
}

interface ScheduleFormData {
  name: string;
  playlistId: string;
  startAt: string;
  endAt: string;
  recurrence: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
  daysOfWeek: number[];
  priority: number;
  deviceId: string;
  groupId: string;
  targetType: "device" | "group";
}

// ── Calendar Localizer ──────────────────────────────────────────────

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const calendarMessages = {
  allDay: "Dia inteiro",
  previous: "Anterior",
  next: "Próximo",
  today: "Hoje",
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Agenda",
  date: "Data",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "Sem agendamentos neste período.",
  showMore: (total: number) => `+${total} mais`,
};

// ── Priority colors ─────────────────────────────────────────────────

const PRIORITY_COLORS: Record<number, string> = {
  0: "#3b82f6", // blue
  1: "#22c55e", // green
  2: "#f59e0b", // amber
  3: "#ef4444", // red
  4: "#8b5cf6", // purple
  5: "#ec4899", // pink
};

function getPriorityColor(priority: number): string {
  return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS[0]!;
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
];

// ── Helper: format datetime-local ───────────────────────────────────

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISOString(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

// ── Component ───────────────────────────────────────────────────────

type TabView = "calendar" | "list" | "logs";

const emptyForm: ScheduleFormData = {
  name: "",
  playlistId: "",
  startAt: "",
  endAt: "",
  recurrence: "ONCE",
  daysOfWeek: [],
  priority: 0,
  deviceId: "",
  groupId: "",
  targetType: "device",
};

export default function SchedulesPage() {
  const queryClient = useQueryClient();

  // ── State ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabView>("calendar");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormData>(emptyForm);
  const [conflicts, setConflicts] = useState<Array<{ id: string; name: string }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const calendarMonth = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}`;

  // ── Queries ───────────────────────────────────────────────────────

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () =>
      api.get<{ data: Schedule[]; meta: { total: number } }>("/schedules", {
        pageSize: 100,
      }),
  });

  const { data: calendarData } = useQuery({
    queryKey: ["schedules-calendar", calendarMonth],
    queryFn: () =>
      api.get<{ data: CalendarEvent[] }>("/schedules/calendar", {
        month: calendarMonth,
      }),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["schedule-logs"],
    queryFn: () =>
      api.get<{ data: ScheduleLog[]; meta: { total: number } }>(
        "/schedules/logs",
        { pageSize: 50 }
      ),
    enabled: activeTab === "logs",
  });

  const { data: playlistsData } = useQuery({
    queryKey: ["playlists-select"],
    queryFn: () => api.get<{ data: Playlist[] }>("/playlists"),
    enabled: modalOpen,
  });

  const { data: devicesData } = useQuery({
    queryKey: ["devices-select"],
    queryFn: () => api.get<{ data: Device[] }>("/devices", { pageSize: 200 }),
    enabled: modalOpen,
  });

  const { data: groupsData } = useQuery({
    queryKey: ["device-groups-select"],
    queryFn: () =>
      api.get<{ data: DeviceGroup[] }>("/device-groups", { pageSize: 200 }),
    enabled: modalOpen,
  });

  const schedules = schedulesData?.data ?? [];
  const calendarEvents = calendarData?.data ?? [];
  const logs = logsData?.data ?? [];
  const playlists = playlistsData?.data ?? [];
  const devices = devicesData?.data ?? [];
  const groups = groupsData?.data ?? [];

  // ── Mutations ─────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post("/schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-calendar"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-calendar"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-calendar"] });
      setDeleteConfirm(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/schedules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules-calendar"] });
    },
  });

  // ── Calendar events ───────────────────────────────────────────────

  const bigCalendarEvents = useMemo(
    () =>
      calendarEvents.map((evt) => ({
        id: evt.id,
        title: evt.name,
        start: new Date(evt.startAt),
        end: evt.endAt ? new Date(evt.endAt) : new Date(new Date(evt.startAt).getTime() + 3600000),
        resource: evt,
      })),
    [calendarEvents]
  );

  const eventStyleGetter = useCallback(
    (event: (typeof bigCalendarEvents)[number]) => ({
      style: {
        backgroundColor: event.resource.color,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "none",
        fontSize: "0.75rem",
        padding: "2px 4px",
      },
    }),
    []
  );

  // ── Modal handlers ────────────────────────────────────────────────

  function openCreateModal(slotStart?: Date) {
    const now = slotStart ?? new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000); // +1h
    setForm({
      ...emptyForm,
      startAt: toDatetimeLocal(now.toISOString()),
      endAt: toDatetimeLocal(end.toISOString()),
    });
    setEditingId(null);
    setConflicts([]);
    setModalOpen(true);
  }

  function openEditModal(schedule: Schedule) {
    setForm({
      name: schedule.name,
      playlistId: schedule.playlist.id,
      startAt: toDatetimeLocal(schedule.startAt),
      endAt: schedule.endAt ? toDatetimeLocal(schedule.endAt) : "",
      recurrence: schedule.recurrence,
      daysOfWeek: schedule.daysOfWeek,
      priority: schedule.priority,
      deviceId: schedule.device?.id ?? "",
      groupId: schedule.group?.id ?? "",
      targetType: schedule.group ? "group" : "device",
    });
    setEditingId(schedule.id);
    setConflicts([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setConflicts([]);
  }

  function updateForm(patch: Partial<ScheduleFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  }

  async function checkConflictsForForm() {
    const targetDeviceId = form.targetType === "device" ? form.deviceId : "";
    if (!targetDeviceId || !form.startAt || !form.endAt) {
      setConflicts([]);
      return;
    }
    try {
      const res = await api.get<{
        data: Array<{ id: string; name: string }>;
      }>("/schedules/conflicts", {
        deviceId: targetDeviceId,
        startAt: toISOString(form.startAt),
        endAt: toISOString(form.endAt),
        excludeId: editingId ?? undefined,
      });
      setConflicts(res.data);
    } catch {
      setConflicts([]);
    }
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      name: form.name,
      playlistId: form.playlistId,
      startAt: toISOString(form.startAt),
      priority: form.priority,
      recurrence: form.recurrence,
    };

    if (form.endAt) payload.endAt = toISOString(form.endAt);
    if (form.recurrence === "WEEKLY" || form.recurrence === "CUSTOM") {
      payload.daysOfWeek = form.daysOfWeek;
    }
    if (form.targetType === "device" && form.deviceId) {
      payload.deviceId = form.deviceId;
    }
    if (form.targetType === "group" && form.groupId) {
      payload.groupId = form.groupId;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const canSubmit = form.name && form.playlistId && form.startAt && !isSubmitting;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground">
            Controle quando as playlists são exibidas nos dispositivos
          </p>
        </div>
        <Button onClick={() => openCreateModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        <Button
          variant={activeTab === "calendar" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("calendar")}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Calendário
        </Button>
        <Button
          variant={activeTab === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("list")}
        >
          <List className="mr-2 h-4 w-4" />
          Lista
        </Button>
        <Button
          variant={activeTab === "logs" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("logs")}
        >
          <History className="mr-2 h-4 w-4" />
          Histórico
        </Button>
      </div>

      {/* Calendar View */}
      {activeTab === "calendar" && (
        <Card>
          <CardContent className="p-4">
            <div style={{ height: 650 }}>
              <BigCalendar
                localizer={localizer}
                events={bigCalendarEvents}
                startAccessor="start"
                endAccessor="end"
                date={calendarDate}
                onNavigate={setCalendarDate}
                eventPropGetter={eventStyleGetter}
                messages={calendarMessages}
                culture="pt-BR"
                views={["month", "week", "day"]}
                selectable
                onSelectSlot={(slotInfo) => openCreateModal(slotInfo.start)}
                onSelectEvent={(event) => {
                  const schedule = schedules.find(
                    (s) => s.id === event.resource.id
                  );
                  if (schedule) openEditModal(schedule);
                }}
                tooltipAccessor={(event) => {
                  const r = event.resource;
                  const target = r.deviceName ?? r.groupName ?? "";
                  return `${r.name}\n${target}\nPrioridade: ${r.priority}`;
                }}
                popup
              />
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Prioridade:</span>
              {Object.entries(PRIORITY_COLORS).map(([p, color]) => (
                <span key={p} className="flex items-center gap-1">
                  <span
                    className="inline-block h-3 w-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                  {p}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {activeTab === "list" && (
        <>
          {schedulesLoading ? (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Carregando agendamentos...
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum agendamento configurado.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Playlist</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Recorrência</TableHead>
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
                      </TableCell>
                      <TableCell>{schedule.playlist.name}</TableCell>
                      <TableCell>
                        {schedule.device?.name ??
                          schedule.group?.name ??
                          schedule.screens
                            ?.map((s) => s.screen.name)
                            .join(", ") ??
                          "—"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(schedule.startAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {schedule.endAt
                          ? new Date(schedule.endAt).toLocaleString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {schedule.recurrence === "ONCE" && "Única vez"}
                          {schedule.recurrence === "DAILY" && "Diário"}
                          {schedule.recurrence === "WEEKLY" && "Semanal"}
                          {schedule.recurrence === "CUSTOM" && "Personalizado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white"
                          style={{
                            backgroundColor: getPriorityColor(schedule.priority),
                          }}
                        >
                          {schedule.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          className="cursor-pointer"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: schedule.id,
                              isActive: !schedule.isActive,
                            })
                          }
                        >
                          <Badge
                            variant={schedule.isActive ? "success" : "secondary"}
                          >
                            {schedule.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditModal(schedule)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => setDeleteConfirm(schedule.id)}
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
        </>
      )}

      {/* Logs View */}
      {activeTab === "logs" && (
        <>
          {logsLoading ? (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              Carregando histórico...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum registo de execução encontrado.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Agendamento</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(log.executedAt).toLocaleString("pt-BR")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.schedule?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.deviceId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {log.status === "SUCCESS" && (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Sucesso
                          </Badge>
                        )}
                        {log.status === "SKIPPED" && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Ignorado
                          </Badge>
                        )}
                        {log.status === "ERROR" && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Erro
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogClose onOpenChange={setModalOpen} />
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-name">Nome</Label>
              <Input
                id="sched-name"
                placeholder="Ex: Promoção Almoço"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
              />
            </div>

            {/* Playlist */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-playlist">Playlist</Label>
              <Select
                id="sched-playlist"
                value={form.playlistId}
                onChange={(e) => updateForm({ playlistId: e.target.value })}
                options={playlists.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                placeholder="Selecione uma playlist"
              />
            </div>

            {/* Target type */}
            <div className="space-y-1.5">
              <Label>Destino</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.targetType === "device" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateForm({ targetType: "device", groupId: "" })
                  }
                >
                  Dispositivo
                </Button>
                <Button
                  type="button"
                  variant={form.targetType === "group" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateForm({ targetType: "group", deviceId: "" })
                  }
                >
                  Grupo
                </Button>
              </div>
            </div>

            {/* Device or Group select */}
            {form.targetType === "device" ? (
              <div className="space-y-1.5">
                <Label htmlFor="sched-device">Dispositivo</Label>
                <Select
                  id="sched-device"
                  value={form.deviceId}
                  onChange={(e) => updateForm({ deviceId: e.target.value })}
                  options={devices.map((d) => ({
                    value: d.id,
                    label: `${d.name} (${d.status})`,
                  }))}
                  placeholder="Selecione um dispositivo"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="sched-group">Grupo</Label>
                <Select
                  id="sched-group"
                  value={form.groupId}
                  onChange={(e) => updateForm({ groupId: e.target.value })}
                  options={groups.map((g) => ({
                    value: g.id,
                    label: `${g.name}${g._count ? ` (${g._count.devices} disp.)` : ""}`,
                  }))}
                  placeholder="Selecione um grupo"
                />
              </div>
            )}

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sched-start">Início</Label>
                <Input
                  id="sched-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => updateForm({ startAt: e.target.value })}
                  onBlur={checkConflictsForForm}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-end">Fim</Label>
                <Input
                  id="sched-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => updateForm({ endAt: e.target.value })}
                  onBlur={checkConflictsForForm}
                />
              </div>
            </div>

            {/* Recurrence */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-recurrence">Recorrência</Label>
              <Select
                id="sched-recurrence"
                value={form.recurrence}
                onChange={(e) =>
                  updateForm({
                    recurrence: e.target.value as ScheduleFormData["recurrence"],
                  })
                }
                options={[
                  { value: "ONCE", label: "Única vez" },
                  { value: "DAILY", label: "Diário" },
                  { value: "WEEKLY", label: "Semanal" },
                  { value: "CUSTOM", label: "Personalizado" },
                ]}
              />
            </div>

            {/* Days of week (for WEEKLY / CUSTOM) */}
            {(form.recurrence === "WEEKLY" ||
              form.recurrence === "CUSTOM") && (
              <div className="space-y-1.5">
                <Label>Dias da semana</Label>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      className={`h-9 w-9 rounded-md text-xs font-medium border transition-colors ${
                        form.daysOfWeek.includes(Number(d.value))
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-accent"
                      }`}
                      onClick={() => toggleDay(Number(d.value))}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Priority */}
            <div className="space-y-1.5">
              <Label htmlFor="sched-priority">
                Prioridade (maior = mais importante)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="sched-priority"
                  type="number"
                  min={0}
                  max={10}
                  className="w-20"
                  value={form.priority}
                  onChange={(e) =>
                    updateForm({ priority: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <span
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white"
                  style={{
                    backgroundColor: getPriorityColor(form.priority),
                  }}
                >
                  {form.priority}
                </span>
              </div>
            </div>

            {/* Conflict warning */}
            {conflicts.length > 0 && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3">
                <div className="flex items-center gap-2 text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Conflitos detectados:</p>
                    <ul className="mt-1 list-disc list-inside">
                      {conflicts.map((c) => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">
                      O agendamento com maior prioridade terá precedência.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting
                ? "Salvando..."
                : editingId
                  ? "Guardar Alterações"
                  : "Criar Agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────── */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogClose
            onOpenChange={() => setDeleteConfirm(null)}
          />
          <DialogHeader>
            <DialogTitle>Eliminar Agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja eliminar este agendamento? Esta ação não pode
            ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
