"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";

export default function SettingsPage() {
  const user = getUser();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Suas informações pessoais da conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input defaultValue={user?.name} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input defaultValue={user?.email} type="email" />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Input defaultValue={user?.role} disabled />
          </div>
          <Button>Salvar Alterações</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Atualize a senha da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha Atual</Label>
            <Input type="password" />
          </div>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input type="password" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar Nova Senha</Label>
            <Input type="password" />
          </div>
          <Button>Atualizar Senha</Button>
        </CardContent>
      </Card>
    </div>
  );
}
