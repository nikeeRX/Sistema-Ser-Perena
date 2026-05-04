import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scissors, MapPin, Phone, Users, LogOut, Key, Loader2, CheckCircle, AlertCircle, Shield, Clock, RefreshCw, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function UnitSelection() {
  const [, setLocation] = useLocation();
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const logoutMutation = trpc.auth.logout.useMutation();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";
  const isBarber = user?.role === "barber";
  const isOwner = user?.role === "owner";
  const isPrivileged = isAdmin || isOwner;
  const userId = user?.id;

  const { data: allBranches, isLoading: allLoading } = trpc.branches.list.useQuery(undefined, { enabled: isAdmin });
  const { data: userBranches, isLoading: userLoading } = trpc.branches.getByUser.useQuery(
    { userId: userId || 0 },
    { enabled: !isAdmin && !!userId }
  );

  const branches = isAdmin ? allBranches : userBranches;
  const isLoading = isAdmin ? allLoading : userLoading;

  // Token state
  const [tokenInput, setTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);

  // Check token status from backend
  const { data: tokenStatus, isLoading: tokenStatusLoading } = trpc.authLocal.checkTokenStatus.useQuery(
    { userId: userId || 0 },
    { enabled: !isAdmin && !isBarber && !!userId }
  );

  // Derived states
  const hasActiveToken = tokenStatus?.hasActiveToken ?? false;
  const isExpired = tokenStatus?.isExpired ?? false;
  const hasToken = tokenStatus?.hasToken ?? false;
  const daysRemaining = tokenStatus?.daysRemaining ?? null;

  useEffect(() => {
    if (selectedBranch) {
      if (isBarber) {
        setLocation(`/dashboard/${selectedBranch}/scheduling`);
      } else {
        setLocation(`/dashboard/${selectedBranch}`);
      }
    }
  }, [selectedBranch, setLocation]);

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } catch (err: any) { /* ignore */ }
    localStorage.removeItem("user");
    localStorage.removeItem("tokenActivated");
    setLocation("/");
  };

  const handleActivateToken = async () => {
    if (!tokenInput.trim()) { setTokenError("Digite o token de acesso"); return; }
    setTokenLoading(true);
    setTokenError("");

    try {
      const batchInput = encodeURIComponent(JSON.stringify({ "0": { json: { token: tokenInput.trim(), userId: userId } } }));
      const response = await fetch(`/api/trpc/authLocal.validateToken?batch=1&input=${batchInput}`);
      const data = await response.json();

      if (data?.[0]?.result?.data?.json?.valid) {
        localStorage.setItem("tokenActivated", "true");
        toast.success("Token ativado com sucesso! Acesso liberado!");
        setTokenInput("");
        // Reload to refresh token status
        window.location.reload();
      } else {
        setTokenError("Token inválido ou expirado");
        toast.error("Token inválido ou expirado");
      }
    } catch (err: any) {
      setTokenError("Token inválido ou expirado");
      toast.error("Token inválido ou expirado");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRenew = async () => {
    setRenewLoading(true);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: "equipe", // Default plan for renewal
          email: user?.email || "",
          name: user?.name || "",
          origin: window.location.origin,
        }),
      });
      const data = await response.json();
      if (data.url) {
        // Use location.href instead of window.open to avoid mobile popup blockers
        window.location.href = data.url;
      } else {
        toast.error("Erro ao criar sessão de renovação");
      }
    } catch (err) {
      toast.error("Erro ao conectar com o sistema de pagamento");
    } finally {
      setRenewLoading(false);
    }
  };

  if (isLoading || tokenStatusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-foreground font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  // Determine access: admin/barber always has access, owners/users need active token
  const hasAccess = isAdmin || isBarber || hasActiveToken;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/8 rounded-full blur-3xl"></div>
      </div>

      {/* Top Bar */}
      <div className="relative z-10 w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl">
            <Scissors className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-foreground font-bold text-lg">Barbearia Control</p>
            <p className="text-muted-foreground text-xs">{user?.email || "Usuário"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button onClick={() => setLocation("/admin")} variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
              <Shield className="w-4 h-4 mr-2" />
              Admin
            </Button>
          )}
          <Button onClick={handleLogout} variant="outline" size="sm" className="border-red-400/30 text-red-400 hover:bg-red-400/10">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl">

        {/* ── PLANO EXPIRADO ── */}
        {!isAdmin && isExpired && (
          <Card className="bg-red-500/10 border border-red-500/30 p-6 mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <Clock className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-red-300 font-bold text-lg">Plano Expirado</h3>
                <p className="text-red-400/80 text-sm mt-1">
                  Seu plano venceu{tokenStatus?.expiresAt ? ` em ${new Date(tokenStatus.expiresAt).toLocaleDateString("pt-BR")}` : ""}. 
                  Renove agora para continuar usando o sistema sem perder seus dados.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRenew}
                disabled={renewLoading}
                className="bg-red-500 text-white hover:bg-red-600 flex-1"
              >
                {renewLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Renovar Plano
              </Button>
              <Button
                onClick={() => window.open("https://wa.me/5561995414168?text=Ol%C3%A1%2C%20meu%20plano%20expirou%20e%20preciso%20de%20ajuda", "_blank")}
                variant="outline"
                className="border-red-400/30 text-red-400 hover:bg-red-400/10"
              >
                Falar no WhatsApp
              </Button>
            </div>
          </Card>
        )}

        {/* ── TOKEN ATIVO — info de dias restantes ── */}
        {!isAdmin && hasActiveToken && daysRemaining !== null && (
          <div className={`border rounded-lg p-4 mb-8 flex items-center gap-3 ${
            daysRemaining <= 5 
              ? "bg-amber-500/10 border-amber-500/30" 
              : "bg-green-500/10 border-green-500/30"
          }`}>
            {daysRemaining <= 5 ? (
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${daysRemaining <= 5 ? "text-amber-400" : "text-green-400"}`}>
                {daysRemaining <= 5 
                  ? `Atenção: seu plano vence em ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""}!`
                  : `Plano ativo — ${daysRemaining} dia${daysRemaining !== 1 ? "s" : ""} restante${daysRemaining !== 1 ? "s" : ""}`
                }
              </p>
              {tokenStatus?.expiresAt && (
                <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  Vence em {new Date(tokenStatus.expiresAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            {daysRemaining <= 5 && (
              <Button
                onClick={handleRenew}
                disabled={renewLoading}
                size="sm"
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                {renewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Renovar"}
              </Button>
            )}
          </div>
        )}

        {/* ── SEM TOKEN — precisa ativar (manual, para quem não pagou via Stripe) ── */}
        {!isAdmin && !hasToken && !isExpired && (
          <Card className="bg-amber-500/10 border border-amber-500/30 p-6 mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-lg">
                <Key className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-amber-300 font-bold text-lg">Ativação de Token Necessária</h3>
                <p className="text-amber-400/80 text-sm mt-1">
                  Para acessar o sistema, ative seu token de acesso ou contrate um plano.
                </p>
              </div>
            </div>

            {tokenError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-destructive text-sm">{tokenError}</p>
              </div>
            )}

            <div className="flex gap-3 mb-3">
              <Input
                type="text"
                placeholder="Cole seu token de acesso aqui..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                disabled={tokenLoading}
                className="flex-1"
              />
              <Button
                onClick={handleActivateToken}
                disabled={tokenLoading || !tokenInput.trim()}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                {tokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ativar"}
              </Button>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs">ou</p>
              <Button
                onClick={handleRenew}
                disabled={renewLoading}
                variant="outline"
                size="sm"
                className="mt-2 border-primary/50 text-primary hover:bg-primary/10"
              >
                {renewLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Contratar um Plano
              </Button>
            </div>
          </Card>
        )}

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Selecione uma Unidade</h1>
          <p className="text-muted-foreground">Escolha a unidade que deseja gerenciar</p>
        </div>

        {hasAccess ? (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {branches?.map((branch) => (
              <Card
                key={branch.id}
                className="p-8 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] bg-card border-border hover:border-primary/50"
                onClick={() => setSelectedBranch(branch.id)}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Scissors className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Unidade</p>
                    <p className="text-2xl font-bold text-foreground">#{branch.id}</p>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-4">{branch.name}</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{branch.address || "Endereço não informado"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Phone className="w-5 h-5 text-primary/70 flex-shrink-0" />
                    <span className="text-sm">{branch.phone || "Telefone não informado"}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setSelectedBranch(branch.id)}
                    disabled={selectedBranch === branch.id}
                  >
                    {selectedBranch === branch.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Abrindo...</>
                    ) : (
                      <><Users className="w-4 h-4 mr-2" />Acessar Unidade</>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="p-4 bg-secondary rounded-full inline-block mb-4">
              <Key className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-muted-foreground mb-2">Acesso Bloqueado</h3>
            <p className="text-muted-foreground/70 max-w-md mx-auto">
              {isExpired 
                ? "Seu plano expirou. Renove acima para continuar usando o sistema."
                : "Ative seu token de acesso ou contrate um plano para desbloquear o sistema."
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
