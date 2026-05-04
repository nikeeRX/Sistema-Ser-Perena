import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle, Shield, ArrowLeft, Key, Building2, Users, Store, BarChart3, Trash2, Lock, Unlock, Edit, Eye, EyeOff, Mail, X, CreditCard, RefreshCw, CalendarPlus, Clock, AlertTriangle, Package, Plus, Star, ToggleLeft, ToggleRight } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminPanel() {
  const [branchId, setBranchId] = useState<number | "">("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "tokens" | "users" | "subscriptions" | "plans">("dashboard");
  const [, setLocation] = useLocation();

  // Edit state
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<"password" | "email" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Extend/Renew state
  const [extendingTokenId, setExtendingTokenId] = useState<number | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [renewingTokenId, setRenewingTokenId] = useState<number | null>(null);
  const [renewDays, setRenewDays] = useState(30);
  const [editingDurationTokenId, setEditingDurationTokenId] = useState<number | null>(null);
  const [editDurationDays, setEditDurationDays] = useState(30);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado. Apenas administradores.");
      setLocation("/units");
    }
  }, [isAdmin, setLocation]);

  const { data: branches, isLoading: branchesLoading } = trpc.branches.list.useQuery();
  const generateTokenMutation = trpc.authLocal.generateToken.useMutation();

  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.listUsers.useQuery(
    { adminUserId: user.id },
    { enabled: isAdmin }
  );

  const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubs } = trpc.admin.listSubscriptions.useQuery(
    { adminUserId: user.id },
    { enabled: isAdmin }
  );

  const changePasswordMutation = trpc.admin.changePassword.useMutation();
  const changeEmailMutation = trpc.admin.changeEmail.useMutation();
  const deleteUserMutation = trpc.admin.deleteUser.useMutation();
  const toggleTokenMutation = trpc.admin.toggleToken.useMutation();
  const deleteBranchMutation = trpc.admin.deleteBranch.useMutation();
  const extendTokenMutation = trpc.admin.extendToken.useMutation();
  const renewTokenMutation = trpc.admin.renewToken.useMutation();
  const deleteTokenMutation = trpc.admin.deleteToken.useMutation();
  const updateTokenDurationMutation = trpc.admin.updateTokenDuration.useMutation();

  // Plans state
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({
    slug: "", name: "", subtitle: "", barbers: "", maxBarbers: 1,
    priceReais: "", originalPriceReais: "", features: "",
    isActive: true, isHighlighted: false, badge: "", sortOrder: 0,
  });

  const { data: adminPlans, isLoading: plansLoading, refetch: refetchPlans } = trpc.admin.listPlans.useQuery(
    { adminUserId: user.id },
    { enabled: isAdmin }
  );
  const createPlanMutation = trpc.admin.createPlan.useMutation();
  const updatePlanMutation = trpc.admin.updatePlan.useMutation();
  const deletePlanMutation = trpc.admin.deletePlan.useMutation();

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = planForm.features.split("\n").map(f => f.trim()).filter(Boolean);
    const priceInCents = planForm.priceReais ? Math.round(parseFloat(planForm.priceReais) * 100) : 0;
    const originalPriceInCents = planForm.originalPriceReais ? Math.round(parseFloat(planForm.originalPriceReais) * 100) : undefined;
    const payload = {
      adminUserId: user.id,
      slug: planForm.slug,
      name: planForm.name,
      subtitle: planForm.subtitle || undefined,
      barbers: planForm.barbers || undefined,
      maxBarbers: planForm.maxBarbers,
      priceInCents,
      originalPriceInCents,
      features,
      isActive: planForm.isActive,
      isHighlighted: planForm.isHighlighted,
      badge: planForm.badge || undefined,
      sortOrder: planForm.sortOrder,
    };
    try {
      if (editingPlan) {
        await updatePlanMutation.mutateAsync({ ...payload, planId: editingPlan.id });
        toast.success("Plano atualizado!");
      } else {
        await createPlanMutation.mutateAsync(payload);
        toast.success("Plano criado!");
      }
      refetchPlans();
      setShowPlanForm(false);
      setEditingPlan(null);
      setPlanForm({ slug: "", name: "", subtitle: "", barbers: "", maxBarbers: 1, priceReais: "", originalPriceReais: "", features: "", isActive: true, isHighlighted: false, badge: "", sortOrder: 0 });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar plano");
    }
  };

  const handleDeletePlan = async (planId: number, planName: string) => {
    if (!confirm(`Excluir o plano "${planName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deletePlanMutation.mutateAsync({ adminUserId: user.id, planId });
      toast.success("Plano excluído!");
      refetchPlans();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir plano");
    }
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setPlanForm({
      slug: plan.slug,
      name: plan.name,
      subtitle: plan.subtitle || "",
      barbers: plan.barbers || "",
      maxBarbers: plan.maxBarbers,
      priceReais: plan.priceInCents > 0 ? (plan.priceInCents / 100).toFixed(2) : "",
      originalPriceReais: plan.originalPriceInCents ? (plan.originalPriceInCents / 100).toFixed(2) : "",
      features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
      isActive: plan.isActive,
      isHighlighted: plan.isHighlighted,
      badge: plan.badge || "",
      sortOrder: plan.sortOrder,
    });
    setShowPlanForm(true);
  };

  const handleDeleteBranch = async (branchId: number, branchName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a unidade "${branchName}"?\n\nTodos os dados (barbeiros, serviços, atendimentos, tokens) serão removidos permanentemente.`)) return;
    try {
      await deleteBranchMutation.mutateAsync({ adminUserId: user.id, branchId });
      toast.success("Unidade excluída com sucesso!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir unidade");
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (branchId === "") { toast.error("Selecione uma unidade"); return; }
    setLoading(true);
    try {
      const result = await generateTokenMutation.mutateAsync({
        branchId: Number(branchId),
        expiresInDays,
        adminUserId: user.id,
      });
      setGeneratedToken(result.token);
      toast.success("Token gerado com sucesso!");
      refetchUsers();
      refetchSubs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar token");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      toast.success("Token copiado!");
    }
  };

  const handleChangePassword = async (targetUserId: number) => {
    if (newPassword.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    try {
      await changePasswordMutation.mutateAsync({ adminUserId: user.id, targetUserId, newPassword });
      toast.success("Senha alterada com sucesso!");
      closeEdit();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    }
  };

  const handleChangeEmail = async (targetUserId: number) => {
    if (!newEmail || !newEmail.includes("@")) { toast.error("Digite um email válido"); return; }
    try {
      await changeEmailMutation.mutateAsync({ adminUserId: user.id, targetUserId, newEmail });
      toast.success("Email alterado com sucesso!");
      closeEdit();
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar email");
    }
  };

  const handleDeleteUser = async (targetUserId: number, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\n\nTodos os tokens e associações serão removidos. Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteUserMutation.mutateAsync({ adminUserId: user.id, targetUserId });
      toast.success("Usuário excluído com sucesso!");
      refetchUsers();
      refetchSubs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuário");
    }
  };

  const handleToggleToken = async (tokenId: number, currentActive: boolean | null) => {
    const newActive = !currentActive;
    try {
      await toggleTokenMutation.mutateAsync({ adminUserId: user.id, tokenId, isActive: newActive });
      toast.success(newActive ? "Token reativado!" : "Token bloqueado!");
      refetchUsers();
      refetchSubs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar token");
    }
  };

  const handleExtendToken = async (tokenId: number) => {
    if (extendDays < 1) { toast.error("Informe pelo menos 1 dia"); return; }
    try {
      await extendTokenMutation.mutateAsync({ adminUserId: user.id, tokenId, extraDays: extendDays });
      toast.success(`Prazo estendido em ${extendDays} dias!`);
      setExtendingTokenId(null);
      setExtendDays(30);
      refetchSubs();
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao estender prazo");
    }
  };

  const handleRenewToken = async (tokenId: number) => {
    if (renewDays < 1) { toast.error("Informe pelo menos 1 dia"); return; }
    try {
      await renewTokenMutation.mutateAsync({ adminUserId: user.id, tokenId, durationDays: renewDays });
      toast.success(`Plano renovado por ${renewDays} dias!`);
      setRenewingTokenId(null);
      setRenewDays(30);
      refetchSubs();
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao renovar plano");
    }
  };

  const handleDeleteToken = async (tokenId: number, userName: string) => {
    if (!confirm(`Excluir a assinatura de "${userName}"?\n\nO cliente perderá acesso imediatamente. Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteTokenMutation.mutateAsync({ adminUserId: user.id, tokenId });
      toast.success("Assinatura excluída!");
      refetchSubs();
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir assinatura");
    }
  };

  const handleUpdateDuration = async (tokenId: number) => {
    if (editDurationDays < 1) { toast.error("Informe pelo menos 1 dia"); return; }
    try {
      await updateTokenDurationMutation.mutateAsync({ adminUserId: user.id, tokenId, durationDays: editDurationDays });
      toast.success(`Licença atualizada para ${editDurationDays} dias!`);
      setEditingDurationTokenId(null);
      setEditDurationDays(30);
      refetchSubs();
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar duração");
    }
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditMode(null);
    setNewPassword("");
    setNewEmail("");
    setShowPassword(false);
  };

  const startEdit = (userId: number, mode: "password" | "email", currentEmail?: string) => {
    setEditingUser(userId);
    setEditMode(mode);
    setNewPassword("");
    setNewEmail(currentEmail || "");
    setShowPassword(false);
  };

  const formatDocument = (doc: string | null) => {
    if (!doc || doc === "-") return "-";
    const digits = doc.replace(/\D/g, "");
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return doc;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3" />Ativo</span>;
      case "expired":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400"><AlertTriangle className="w-3 h-3" />Expirado</span>;
      case "inactive":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400"><Lock className="w-3 h-3" />Bloqueado</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3" />Pendente</span>;
      default:
        return null;
    }
  };

  if (!isAdmin) return null;

  const totalBranches = branches?.length || 0;
  const totalUsers = allUsers?.length || 0;
  const activeSubs = subscriptions?.filter(s => s.status === "active").length || 0;
  const expiredSubs = subscriptions?.filter(s => s.status === "expired").length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Button onClick={() => setLocation("/units")} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Painel Admin</h1>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["dashboard", "subscriptions", "users", "tokens", "plans"] as const).map((tab) => {
              const icons = { dashboard: BarChart3, subscriptions: CreditCard, users: Users, tokens: Key, plans: Package };
              const labels = { dashboard: "Dashboard", subscriptions: "Assinaturas", users: "Usuários", tokens: "Gerar Token", plans: "Planos" };
              const Icon = icons[tab];
              return (
                <Button key={tab} variant={activeTab === tab ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab)}>
                  <Icon className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{labels[tab]}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6">

        {/* ===== DASHBOARD TAB ===== */}
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium">Unidades</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{totalBranches}</p>
                  </div>
                  <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary opacity-80" />
                </div>
              </Card>
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium">Clientes</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{totalUsers}</p>
                  </div>
                  <Users className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500 opacity-80" />
                </div>
              </Card>
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium">Ativos</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-400 mt-1">{activeSubs}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-500 opacity-80" />
                </div>
              </Card>
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium">Expirados</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-400 mt-1">{expiredSubs}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500 opacity-80" />
                </div>
              </Card>
            </div>

            {/* Branches List */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Unidades Cadastradas
              </h2>
              {branchesLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : branches && branches.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nome</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((branch) => (
                        <tr key={branch.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-4 text-sm text-foreground font-mono">#{branch.id}</td>
                          <td className="py-3 px-4 text-sm text-foreground font-medium">{branch.name}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground hidden sm:table-cell">{branch.email || "-"}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground hidden md:table-cell">{branch.phone || "-"}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setBranchId(branch.id); setActiveTab("tokens"); }}>
                                <Key className="w-3 h-3 mr-1" />Token
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteBranch(branch.id, branch.name)} disabled={deleteBranchMutation.isPending}>
                                <Trash2 className="w-3 h-3 mr-1" />Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma unidade cadastrada ainda</p>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ===== SUBSCRIPTIONS TAB ===== */}
        {activeTab === "subscriptions" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-primary" />
                Gerenciamento de Assinaturas
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Controle planos, prazos e renovações dos clientes</p>
            </div>

            {subsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-4">
                {subscriptions.map((sub: any) => (
                  <Card key={sub.tokenId} className={`p-4 sm:p-6 border-l-4 ${
                    sub.status === "active" ? "border-l-green-500" :
                    sub.status === "expired" ? "border-l-red-500" :
                    sub.status === "inactive" ? "border-l-gray-500" :
                    "border-l-yellow-500"
                  }`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">{sub.userName}</h3>
                          {getStatusBadge(sub.status)}
                          {sub.planName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Star className="w-2.5 h-2.5" />{sub.planName}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                          <p className="text-muted-foreground"><span className="text-foreground font-medium">Email:</span> {sub.userEmail}</p>
                          <p className="text-muted-foreground"><span className="text-foreground font-medium">CPF/CNPJ:</span> {formatDocument(sub.userCnpj)}</p>
                          <p className="text-muted-foreground"><span className="text-foreground font-medium">Unidade:</span> {sub.branchName}</p>
                          <p className="text-muted-foreground"><span className="text-foreground font-medium">Plano:</span>{" "}{sub.planName ? <span className="text-amber-400 font-semibold">{sub.planName}</span> : <span className="italic">Sem plano</span>}{" "}&bull;{" "}{sub.durationDays || 30} dias</p>
                          <p className="text-muted-foreground">
                            <span className="text-foreground font-medium">Ativado:</span>{" "}
                            {sub.activatedAt ? new Date(sub.activatedAt).toLocaleDateString("pt-BR") : "Aguardando"}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="text-foreground font-medium">Expira:</span>{" "}
                            {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("pt-BR") : "-"}
                            {sub.daysRemaining !== null && sub.status === "active" && (
                              <span className={`ml-2 font-semibold ${sub.daysRemaining <= 5 ? "text-yellow-400" : "text-green-400"}`}>
                                ({sub.daysRemaining} dias restantes)
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">Token: {sub.token.substring(0, 16)}...</p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => { setExtendingTokenId(sub.tokenId); setExtendDays(30); }}
                        >
                          <CalendarPlus className="w-3 h-3 mr-1" />Estender
                        </Button>
                        {(sub.status === "expired" || sub.status === "inactive") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                            onClick={() => { setRenewingTokenId(sub.tokenId); setRenewDays(30); }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />Renovar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={sub.status === "inactive" ? "default" : "destructive"}
                          onClick={() => handleToggleToken(sub.tokenId, sub.status !== "inactive")}
                          disabled={toggleTokenMutation.isPending}
                        >
                          {sub.status === "inactive" ? (
                            <><Unlock className="w-3 h-3 mr-1" />Reativar</>
                          ) : (
                            <><Lock className="w-3 h-3 mr-1" />Bloquear</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { navigator.clipboard.writeText(sub.token); toast.success("Token copiado!"); }}
                        >
                          <Copy className="w-3 h-3 mr-1" />Copiar Token
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          onClick={() => { setEditingDurationTokenId(sub.tokenId); setEditDurationDays(sub.durationDays || 30); }}
                        >
                          <Clock className="w-3 h-3 mr-1" />Alterar Dias
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleDeleteToken(sub.tokenId, sub.userName)}
                          disabled={deleteTokenMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />Excluir
                        </Button>
                      </div>
                    </div>

                    {/* Edit Duration Form */}
                    {editingDurationTokenId === sub.tokenId && (
                      <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-amber-400">Alterar duração da licença de {sub.userName}</p>
                          <button onClick={() => setEditingDurationTokenId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="1"
                            max="3650"
                            value={editDurationDays}
                            onChange={(e) => setEditDurationDays(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">dias totais (a partir da ativação)</span>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateDuration(sub.tokenId)}
                            disabled={updateTokenDurationMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            {updateTokenDurationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">A data de expiração será recalculada a partir da data de ativação original do cliente.</p>
                      </div>
                    )}

                    {/* Extend Form */}
                    {extendingTokenId === sub.tokenId && (
                      <div className="mt-4 bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-green-400">Estender prazo de {sub.userName}</p>
                          <button onClick={() => setExtendingTokenId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={extendDays}
                            onChange={(e) => setExtendDays(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">dias adicionais</span>
                          <Button
                            size="sm"
                            onClick={() => handleExtendToken(sub.tokenId)}
                            disabled={extendTokenMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {extendTokenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">O prazo será adicionado a partir da data de expiração atual (ou de hoje, se já expirou).</p>
                      </div>
                    )}

                    {/* Renew Form */}
                    {renewingTokenId === sub.tokenId && (
                      <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-blue-400">Renovar plano de {sub.userName}</p>
                          <button onClick={() => setRenewingTokenId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={renewDays}
                            onChange={(e) => setRenewDays(Number(e.target.value))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">dias a partir de hoje</span>
                          <Button
                            size="sm"
                            onClick={() => handleRenewToken(sub.tokenId)}
                            disabled={renewTokenMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {renewTokenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">O plano será renovado a partir de hoje com a duração informada. O token será reativado automaticamente.</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">As assinaturas aparecem aqui quando clientes ativam tokens ou pagam via Stripe</p>
              </Card>
            )}
          </>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === "users" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                Gerenciamento de Usuários
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Gerencie contas, senhas, emails e tokens dos estabelecimentos</p>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : allUsers && allUsers.length > 0 ? (
              <div className="space-y-4">
                {allUsers.map((u: any) => (
                  <Card key={u.id} className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-foreground truncate">{u.name || "Sem nome"}</h3>
                        <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          CPF/CNPJ: {formatDocument(u.cnpj)} | Login: {u.loginMethod || "local"} | Criado: {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap shrink-0">
                        <Button size="sm" variant="outline" onClick={() => startEdit(u.id, "email", u.email)}>
                          <Mail className="w-3 h-3 mr-1" />Email
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(u.id, "password")}>
                          <Edit className="w-3 h-3 mr-1" />Senha
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(u.id, u.name || u.email)} disabled={deleteUserMutation.isPending}>
                          {deleteUserMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3 mr-1" />Excluir</>}
                        </Button>
                      </div>
                    </div>

                    {/* Edit Password */}
                    {editingUser === u.id && editMode === "password" && (
                      <div className="bg-secondary/50 rounded-lg p-4 mb-4 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-foreground">Nova senha para {u.name || u.email}:</p>
                          <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <Button size="sm" onClick={() => handleChangePassword(u.id)} disabled={changePasswordMutation.isPending}>
                            {changePasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Edit Email */}
                    {editingUser === u.id && editMode === "email" && (
                      <div className="bg-secondary/50 rounded-lg p-4 mb-4 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-foreground">Novo email para {u.name || u.email}:</p>
                          <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex gap-2">
                          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novo@email.com" className="flex-1" />
                          <Button size="sm" onClick={() => handleChangeEmail(u.id)} disabled={changeEmailMutation.isPending}>
                            {changeEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tokens */}
                    {u.tokens && u.tokens.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Tokens:</p>
                        <div className="space-y-2">
                          {u.tokens.map((t: any) => (
                            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-secondary/30 rounded-lg px-4 py-2 border border-border/50">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${t.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                  {t.isActive ? "Ativo" : "Bloqueado"}
                                </span>
                                <span className="text-sm text-foreground">{t.branchName}</span>
                                <code className="text-xs text-muted-foreground font-mono">{t.token.substring(0, 12)}...</code>
                                <span className="text-xs text-muted-foreground">
                                  {t.activatedAt
                                    ? `Ativado: ${new Date(t.activatedAt).toLocaleDateString("pt-BR")} | Expira: ${t.expiresAt ? new Date(t.expiresAt).toLocaleDateString("pt-BR") : "-"}`
                                    : "Aguardando ativação"
                                  }
                                </span>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(t.token); toast.success("Token copiado!"); }}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant={t.isActive ? "destructive" : "default"} onClick={() => handleToggleToken(t.id, t.isActive)} disabled={toggleTokenMutation.isPending}>
                                  {t.isActive ? <><Lock className="w-3 h-3 mr-1" />Bloquear</> : <><Unlock className="w-3 h-3 mr-1" />Reativar</>}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Nenhum token gerado para este usuário</p>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum usuário cadastrado ainda</p>
              </Card>
            )}
          </>
        )}

        {/* ===== PLANS TAB ===== */}
        {activeTab === "plans" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Gerenciar Planos</h2>
                <p className="text-muted-foreground text-sm mt-1">Planos exibidos na página de contratação</p>
              </div>
              <Button onClick={() => { setEditingPlan(null); setPlanForm({ slug: "", name: "", subtitle: "", barbers: "", maxBarbers: 1, priceReais: "", originalPriceReais: "", features: "", isActive: true, isHighlighted: false, badge: "", sortOrder: 0 }); setShowPlanForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />Novo Plano
              </Button>
            </div>

            {showPlanForm && (
              <Card className="p-6 mb-6 border-primary/30">
                <h3 className="text-lg font-bold mb-4">{editingPlan ? "Editar Plano" : "Novo Plano"}</h3>
                <form onSubmit={handleSavePlan} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium">Slug (ID único)</label><Input value={planForm.slug} onChange={e => setPlanForm(p => ({ ...p, slug: e.target.value }))} placeholder="ex: equipe" required disabled={!!editingPlan} /></div>
                  <div><label className="text-sm font-medium">Nome</label><Input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="ex: Equipe" required /></div>
                  <div><label className="text-sm font-medium">Subtítulo</label><Input value={planForm.subtitle} onChange={e => setPlanForm(p => ({ ...p, subtitle: e.target.value }))} placeholder="Para barbearias em crescimento" /></div>
                  <div><label className="text-sm font-medium">Barbeiros (texto)</label><Input value={planForm.barbers} onChange={e => setPlanForm(p => ({ ...p, barbers: e.target.value }))} placeholder="2 a 5 barbeiros" /></div>
                  <div><label className="text-sm font-medium">Máx. Barbeiros</label><Input type="number" min={1} value={planForm.maxBarbers} onChange={e => setPlanForm(p => ({ ...p, maxBarbers: Number(e.target.value) }))} /></div>
                  <div><label className="text-sm font-medium">Preço Mensal (R$)</label><Input type="number" min={0} step="0.01" value={planForm.priceReais} onChange={e => setPlanForm(p => ({ ...p, priceReais: e.target.value }))} placeholder="ex: 119.00" /><p className="text-xs text-muted-foreground mt-1">Digite o valor em reais (ex: 59.00 para R$ 59,00). Deixe vazio ou 0 para "Sob consulta".</p></div>
                  <div><label className="text-sm font-medium">Preço Original (R$)</label><Input type="number" min={0} step="0.01" value={planForm.originalPriceReais} onChange={e => setPlanForm(p => ({ ...p, originalPriceReais: e.target.value }))} placeholder="Deixe vazio para não exibir" /><p className="text-xs text-muted-foreground mt-1">Preço riscado (antes do desconto). Deixe vazio se não quiser exibir.</p></div>
                  <div><label className="text-sm font-medium">Badge</label><Input value={planForm.badge} onChange={e => setPlanForm(p => ({ ...p, badge: e.target.value }))} placeholder="ex: Mais popular" /></div>
                  <div><label className="text-sm font-medium">Ordem</label><Input type="number" value={planForm.sortOrder} onChange={e => setPlanForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} /></div>
                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={planForm.isActive} onChange={e => setPlanForm(p => ({ ...p, isActive: e.target.checked }))} /><span className="text-sm">Ativo</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={planForm.isHighlighted} onChange={e => setPlanForm(p => ({ ...p, isHighlighted: e.target.checked }))} /><span className="text-sm">Destaque</span></label>
                  </div>
                  <div className="sm:col-span-2"><label className="text-sm font-medium">Funcionalidades (uma por linha)</label><textarea className="w-full mt-1 px-3 py-2 bg-card border border-input rounded-md text-sm min-h-[120px] resize-y" value={planForm.features} onChange={e => setPlanForm(p => ({ ...p, features: e.target.value }))} placeholder="1 barbeiro cadastrado&#10;Controle de comissões&#10;App mobile (PWA)" /></div>
                  <div className="sm:col-span-2 flex gap-3">
                    <Button type="submit" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>{createPlanMutation.isPending || updatePlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Plano"}</Button>
                    <Button type="button" variant="outline" onClick={() => { setShowPlanForm(false); setEditingPlan(null); }}>Cancelar</Button>
                  </div>
                </form>
              </Card>
            )}

            {plansLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminPlans?.map((plan: any) => (
                  <Card key={plan.id} className={`p-5 border ${plan.isHighlighted ? "border-primary" : "border-border"} ${!plan.isActive ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{plan.name}</h3>
                          {plan.isHighlighted && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          {!plan.isActive && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Inativo</span>}
                        </div>
                        <p className="text-muted-foreground text-sm">{plan.subtitle}</p>
                        {plan.badge && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">{plan.badge}</span>}
                      </div>
                    </div>
                    <div className="mb-3">
                      <span className="text-2xl font-bold">{plan.priceInCents === 0 ? "Sob consulta" : `R$ ${(plan.priceInCents / 100).toFixed(2)}`}</span>
                      {plan.originalPriceInCents && <span className="text-muted-foreground text-sm line-through ml-2">R$ {(plan.originalPriceInCents / 100).toFixed(2)}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{plan.barbers} • máx {plan.maxBarbers} barbeiros</p>
                    <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                      {(Array.isArray(plan.features) ? plan.features : []).slice(0, 4).map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400 shrink-0" />{f}</li>
                      ))}
                      {plan.features?.length > 4 && <li className="text-muted-foreground">+{plan.features.length - 4} mais...</li>}
                    </ul>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditPlan(plan)}><Edit className="w-3 h-3 mr-1" />Editar</Button>
                      <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300" onClick={() => handleDeletePlan(plan.id, plan.name)}><Trash2 className="w-3 h-3 mr-1" />Excluir</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== TOKEN GENERATION TAB ===== */}
        {activeTab === "tokens" && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-card border border-border p-6 sm:p-8 mb-8 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <Key className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">Gerar Novo Token</h2>
              </div>

              <form onSubmit={handleGenerateToken} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Unidade do Cliente</label>
                  {branchesLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Carregando unidades...</div>
                  ) : (
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-4 py-2 bg-card border border-input text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Selecione uma unidade...</option>
                      {branches?.map((branch) => (
                        <option key={branch.id} value={branch.id}>#{branch.id} - {branch.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Dias de Validade</label>
                  <Input type="number" min="1" max="365" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">O prazo começa a contar apenas quando o cliente usar o token pela primeira vez</p>
                </div>

                <Button type="submit" disabled={loading || branchId === ""} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</> : <><Key className="w-4 h-4 mr-2" />Gerar Token</>}
                </Button>
              </form>

              {generatedToken && (
                <div className="mt-8 pt-8 border-t border-border">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-400 font-medium">Token gerado com sucesso!</p>
                      <p className="text-green-400/80 text-sm">Copie e envie para o cliente ativar o acesso</p>
                    </div>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 flex items-center justify-between gap-4">
                    <code className="text-primary text-sm break-all font-mono">{generatedToken}</code>
                    <Button onClick={handleCopyToken} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
                      <Copy className="w-4 h-4 mr-2" />Copiar
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card className="bg-card border border-border p-6 shadow-lg">
              <h3 className="text-foreground font-bold mb-3">Como funciona?</h3>
              <ol className="space-y-2 text-muted-foreground text-sm">
                <li className="flex gap-3"><span className="text-primary font-bold">1.</span>O cliente paga o plano pelo site ou negocia diretamente com você</li>
                <li className="flex gap-3"><span className="text-primary font-bold">2.</span>Se pagou pelo Stripe, o token é gerado e ativado automaticamente</li>
                <li className="flex gap-3"><span className="text-primary font-bold">3.</span>Se negociou direto, gere o token aqui e envie por WhatsApp/email</li>
                <li className="flex gap-3"><span className="text-primary font-bold">4.</span>Gerencie prazos e renovações na aba "Assinaturas"</li>
              </ol>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
