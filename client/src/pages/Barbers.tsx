import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import DashboardNav from "@/components/DashboardNav";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Edit2, Trash2, Users, UserCheck, UserX, Info, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Barbers() {
  const [match, params] = useRoute("/dashboard/:branchId/barbers");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", commissionPercentage: "30" });

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Reset password dialog state
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Check if current user is admin or owner
  const localUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = localUser?.role === "admin";
  const isOwner = localUser?.role === "owner";
  const canManageBarbers = isAdmin || isOwner;

  // Check barber limit based on active plan
  const { data: limitData } = trpc.barbers.checkLimit.useQuery(
    { branchId: branchId!, userId: localUser?.id || 0 },
    { enabled: !!branchId && !!localUser?.id }
  );

  const { data: branch } = trpc.branches.getById.useQuery(
    { id: branchId! },
    { enabled: !!branchId }
  );

  const { data: barbersList, isLoading, refetch } = trpc.barbers.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const createMutation = trpc.barbers.create.useMutation({
    onSuccess: () => {
      toast.success("Barbeiro criado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao criar barbeiro"),
  });

  const updateMutation = trpc.barbers.update.useMutation({
    onSuccess: () => {
      toast.success("Barbeiro atualizado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar barbeiro"),
  });

  const deleteMutation = trpc.barbers.delete.useMutation({
    onSuccess: () => {
      toast.success("Barbeiro excluído com sucesso! O login dele foi removido.");
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao excluir barbeiro"),
  });

  const resetPasswordMutation = trpc.barbers.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setIsResetDialogOpen(false);
      setResetTarget(null);
      setNewPassword("");
    },
    onError: (error: any) => toast.error(error.message || "Erro ao redefinir senha"),
  });

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", commissionPercentage: "30" });
    setEditingBarber(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    if (editingBarber) {
      updateMutation.mutate({
        id: editingBarber.id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        commissionPercentage: formData.commissionPercentage,
      });
    } else {
      createMutation.mutate({
        branchId,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        commissionPercentage: formData.commissionPercentage,
        origin: window.location.origin,
      });
    }
  };

  const openEdit = (barber: any) => {
    setEditingBarber(barber);
    setFormData({
      name: barber.name,
      phone: barber.phone || "",
      email: barber.email || "",
      commissionPercentage: barber.commissionPercentage?.toString() || "30",
    });
    setIsDialogOpen(true);
  };

  const openDeleteConfirm = (barber: any) => {
    setDeleteTarget(barber);
    setIsDeleteDialogOpen(true);
  };

  const openResetPassword = (barber: any) => {
    setResetTarget(barber);
    setNewPassword("");
    setIsResetDialogOpen(true);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    resetPasswordMutation.mutate({
      barberId: resetTarget.id,
      newPassword,
    });
  };

  if (!branchId) {
    setLocation("/");
    return null;
  }

  return (
    <div className="flex">
      <DashboardNav branchId={branchId} branchName={branch?.name || "Unidade"} />

      <main className="flex-1 ml-0 lg:ml-64 bg-background min-h-screen pt-14 lg:pt-0">
        <div className="bg-card border-b border-border p-4 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-foreground">Barbeiros</h1>
            <p className="text-muted-foreground text-sm mt-1">{branch?.name}</p>
          </div>
          {canManageBarbers && (
          <div className="flex flex-col items-end gap-1">
            {limitData && (
              <p className={`text-xs ${
                limitData.canAdd ? "text-muted-foreground" : "text-destructive font-medium"
              }`}>
                {limitData.max === 999
                  ? `${limitData.current} barbeiro(s) cadastrado(s)`
                  : `${limitData.current}/${limitData.max} barbeiros${limitData.planName ? ` (Plano ${limitData.planName})` : ""}`
                }
              </p>
            )}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button
                className="gap-2"
                size="sm"
                disabled={limitData ? (!limitData.canAdd && !editingBarber) : false}
                title={limitData && !limitData.canAdd ? `Limite de barbeiros atingido para o Plano ${limitData.planName}. Faça upgrade para adicionar mais.` : undefined}
              >
                <Plus className="w-4 h-4" />
                {limitData && !limitData.canAdd ? "Limite atingido" : "Novo Barbeiro"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBarber ? "Editar Barbeiro" : "Novo Barbeiro"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="email">Email <span className="text-red-400">*</span></Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                  <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    O barbeiro usará este email para criar o login dele em <strong>/barbeiro-login</strong>
                  </p>
                </div>
                <div>
                  <Label htmlFor="commissionPercentage">Comissão sobre Serviços (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="commissionPercentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commissionPercentage}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                        setFormData({ ...formData, commissionPercentage: val.toString() });
                      }}
                      className="w-24"
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                    <span className="text-xs text-muted-foreground">(padrão: 30%)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Percentual que o barbeiro recebe sobre cada serviço realizado.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />{editingBarber ? "Salvando..." : "Criando..."}</>
                  ) : (
                    editingBarber ? "Salvar Alterações" : "Criar Barbeiro"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
          )}
        </div>

        <div className="p-4 lg:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : barbersList && barbersList.length > 0 ? (
            <div className="grid gap-3 lg:gap-4">
              {barbersList.map((barber) => (
                <Card key={barber.id} className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base lg:text-lg font-bold text-foreground">{barber.name}</h3>
                      {barber.phone && <p className="text-muted-foreground text-sm">{barber.phone}</p>}
                      {barber.email ? (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-muted-foreground text-sm">{barber.email}</p>
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />Pode criar login
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <UserX className="w-3 h-3" />Sem email — sem login
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Comissão serviços:</span>
                        <span className="text-xs font-semibold text-amber-400">{barber.commissionPercentage ?? 30}%</span>
                      </div>
                    </div>
                    {canManageBarbers && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openResetPassword(barber)} title="Redefinir senha">
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(barber)} title="Editar barbeiro">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDeleteConfirm(barber)} title="Excluir barbeiro"
                        className="border-red-400/30 text-red-400 hover:bg-red-400/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 lg:p-12 text-center">
              <Users className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum barbeiro cadastrado</p>
              {canManageBarbers && <Button onClick={() => setIsDialogOpen(true)}>Cadastrar Primeiro Barbeiro</Button>}
            </Card>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Excluir Barbeiro
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>
                Tem certeza que deseja excluir <strong className="text-foreground">{deleteTarget?.name}</strong>?
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                <p className="text-red-400 font-medium text-sm">Esta ação irá:</p>
                <ul className="text-red-400/80 text-sm list-disc list-inside space-y-0.5">
                  <li>Remover o barbeiro do sistema</li>
                  <li>Excluir o login de acesso dele</li>
                  <li>Revogar o acesso a todas as unidades</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta ação não pode ser desfeita. Os agendamentos e atendimentos anteriores serão mantidos no histórico.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Excluindo...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />Excluir Barbeiro</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={(open) => { setIsResetDialogOpen(open); if (!open) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Redefinir Senha
            </DialogTitle>
            <DialogDescription className="text-left pt-1">
              Defina uma nova senha para <strong className="text-foreground">{resetTarget?.name}</strong>
              {resetTarget?.email && <span className="text-muted-foreground"> ({resetTarget.email})</span>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsResetDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending || newPassword.length < 6}>
                {resetPasswordMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redefinindo...</>
                ) : (
                  "Redefinir Senha"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
