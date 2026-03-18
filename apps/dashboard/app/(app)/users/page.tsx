"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  ADMIN: "bg-orange-100 text-orange-800",
  MANAGER: "bg-blue-100 text-blue-800",
  OPERATOR: "bg-green-100 text-green-800",
  VIEWER: "bg-gray-100 text-gray-800",
};

export default function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ data: User[] }>("/users"),
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os membros da equipe e suas permissões
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Convidar Usuário
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Carregando usuários...
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        roleColors[user.role] ?? "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "success" : "secondary"}>
                      {user.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString("pt-BR")}
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
