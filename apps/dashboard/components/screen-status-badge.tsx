import { Badge } from "./ui/badge";

interface ScreenStatusBadgeProps {
  status: "ONLINE" | "OFFLINE" | "ERROR";
  showDot?: boolean;
}

export function ScreenStatusBadge({
  status,
  showDot = true,
}: ScreenStatusBadgeProps) {
  const config = {
    ONLINE: {
      variant: "success" as const,
      label: "Conectado",
      dotColor: "bg-green-500",
    },
    OFFLINE: {
      variant: "secondary" as const,
      label: "Desconectado",
      dotColor: "bg-gray-400",
    },
    ERROR: {
      variant: "destructive" as const,
      label: "Erro",
      dotColor: "bg-red-500",
    },
  };

  const { variant, label, dotColor } = config[status];

  return (
    <Badge variant={variant} className="gap-1.5">
      {showDot && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor} ${
            status === "ONLINE" ? "animate-pulse" : ""
          }`}
        />
      )}
      {label}
    </Badge>
  );
}
