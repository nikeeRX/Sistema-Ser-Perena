import { useLocation, useRoute } from "wouter";
import { useState, useMemo, useEffect } from "react";
import DashboardNav from "@/components/DashboardNav";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Users, Calendar, DollarSign, FileDown, Banknote, AlertTriangle, UserCircle, CreditCard, RefreshCw, Smartphone, Wallet, Coins } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [match, params] = useRoute("/dashboard/:branchId");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;

  const [startDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate] = useState(() => new Date());
  const [filterStart, setFilterStart] = useState(startDate.toISOString().split("T")[0]);
  const [filterEnd, setFilterEnd] = useState(endDate.toISOString().split("T")[0]);
  const [selectedBarber, setSelectedBarber] = useState<string>("all");

  const dateRange = useMemo(() => ({
    start: new Date(filterStart + "T00:00:00"),
    end: new Date(filterEnd + "T23:59:59"),
  }), [filterStart, filterEnd]);

  const { data: branch, isLoading: branchLoading } = trpc.branches.getById.useQuery(
    { id: branchId! },
    { enabled: !!branchId }
  );

  const { data: appointments, isLoading: appointmentsLoading } = trpc.appointments.listByBranch.useQuery(
    { branchId: branchId!, startDate: dateRange.start, endDate: dateRange.end },
    { enabled: !!branchId }
  );

  const { data: commissions, isLoading: commissionsLoading } = trpc.commissions.getByBranch.useQuery(
    { branchId: branchId!, startDate: dateRange.start, endDate: dateRange.end },
    { enabled: !!branchId }
  );

  const { data: barbers, isLoading: barbersLoading } = trpc.barbers.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const { data: products } = trpc.products.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const localUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const isOwnerOrAdmin = localUser?.role === "admin" || localUser?.role === "owner";
  const { data: tokenStatus } = trpc.authLocal.checkTokenStatus.useQuery(
    { userId: localUser?.id },
    { enabled: !!localUser?.id && isOwnerOrAdmin }
  );

  // Payment method breakdown - MUST be before any conditional returns
  const paymentBreakdown = useMemo(() => {
    if (!appointments) return [];
    const breakdown: Record<string, { label: string; total: number; count: number; color: string; icon: string }> = {
      credit: { label: "Crédito", total: 0, count: 0, color: "#8b5cf6", icon: "credit" },
      debit: { label: "Débito", total: 0, count: 0, color: "#3b82f6", icon: "debit" },
      pix: { label: "Pix", total: 0, count: 0, color: "#10b981", icon: "pix" },
      cash: { label: "Dinheiro", total: 0, count: 0, color: "#f59e0b", icon: "cash" },
    };
    for (const apt of appointments) {
      const method = (apt as any).paymentMethod || "cash";
      const revenue = parseFloat(apt.finalPrice?.toString() || apt.servicePrice.toString());
      if (breakdown[method]) {
        breakdown[method].total += revenue;
        breakdown[method].count += 1;
      } else {
        breakdown.cash.total += revenue;
        breakdown.cash.count += 1;
      }
    }
    return Object.values(breakdown).filter(b => b.count > 0);
  }, [appointments]);

  // Redirect if no branchId - use useEffect instead of conditional return
  useEffect(() => {
    if (!branchId) {
      setLocation("/");
    }
  }, [branchId, setLocation]);

  // Early returns AFTER all hooks
  if (!branchId) {
    return null;
  }

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Unidade não encontrada</p>
          <Button onClick={() => setLocation("/")} className="mt-4">Voltar</Button>
        </Card>
      </div>
    );
  }

  // Low stock products (< 5 units)
  const lowStockProducts = products?.filter((p: any) => (p.quantity ?? 0) < 5) || [];

  const totalRevenue = appointments?.reduce((sum, apt) => sum + parseFloat(apt.finalPrice?.toString() || apt.servicePrice.toString()), 0) || 0;
  const totalCommissions = commissions?.reduce((sum: number, com: any) => sum + parseFloat(com.commissionAmount.toString()), 0) || 0;
  const netRevenue = totalRevenue - totalCommissions;
  const appointmentCount = appointments?.length || 0;
  const barberCount = barbers?.length || 0;

  const chartData = appointments?.reduce((acc: any[], apt) => {
    const date = new Date(apt.appointmentDate).toLocaleDateString("pt-BR");
    const existing = acc.find(d => d.date === date);
    const revenue = parseFloat(apt.finalPrice?.toString() || apt.servicePrice.toString());
    if (existing) {
      existing.revenue += revenue;
      existing.count += 1;
    } else {
      acc.push({ date, revenue, count: 1 });
    }
    return acc;
  }, []) || [];

  const isLoading = branchLoading || appointmentsLoading || commissionsLoading || barbersLoading;

  const handleGeneratePdf = (barberId?: string) => {
    const p = new URLSearchParams({
      branchId: branchId!.toString(),
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
    });
    if (barberId && barberId !== "all") {
      p.set("barberId", barberId);
    }
    window.open(`/api/report/pdf?${p.toString()}`, '_blank');
  };

  return (
    <div className="flex">
      <DashboardNav branchId={branchId} branchName={branch.name} />

      <main className="flex-1 ml-0 lg:ml-64 bg-background min-h-screen pt-14 lg:pt-0">
        {/* Header */}
        <div className="bg-card border-b border-border p-4 lg:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl lg:text-3xl font-bold text-foreground">{branch.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">{branch.address}</p>
            </div>
            {/* Filters - responsive */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm text-muted-foreground">De:</Label>
                <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-36 lg:w-40 text-sm" />
                <Label className="text-sm text-muted-foreground">Até:</Label>
                <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-36 lg:w-40 text-sm" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => handleGeneratePdf()}
                  className="flex items-center gap-2 text-sm"
                  size="sm"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Relatório</span> PDF Geral
                </Button>
                {/* PDF por Barbeiro */}
                <Select value={selectedBarber} onValueChange={setSelectedBarber}>
                  <SelectTrigger className="w-36 lg:w-44 text-sm">
                    <SelectValue placeholder="Barbeiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {barbers?.map((b: any) => (
                      <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleGeneratePdf(selectedBarber)}
                  variant="outline"
                  className="flex items-center gap-2 text-sm"
                  size="sm"
                  disabled={selectedBarber === "all"}
                >
                  <UserCircle className="w-4 h-4" />
                  PDF Barbeiro
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <Card className="p-4 mb-4 border-yellow-500/50 bg-yellow-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-500 text-sm">Estoque Baixo</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lowStockProducts.map((p: any) => (
                      <span key={p.id} className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                        {p.name}: {p.quantity ?? 0} un.
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Plan Status Card - only for owner/admin */}
          {isOwnerOrAdmin && tokenStatus && (
            <Card className={`p-4 mb-4 border ${
              tokenStatus.isExpired ? "border-red-500/50 bg-red-500/10" :
              tokenStatus.daysRemaining !== null && tokenStatus.daysRemaining <= 7 ? "border-yellow-500/50 bg-yellow-500/10" :
              "border-primary/30 bg-primary/5"
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CreditCard className={`w-5 h-5 shrink-0 ${
                    tokenStatus.isExpired ? "text-red-400" :
                    tokenStatus.daysRemaining !== null && tokenStatus.daysRemaining <= 7 ? "text-yellow-400" :
                    "text-primary"
                  }`} />
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {tokenStatus.isExpired ? "Plano vencido" :
                       !tokenStatus.hasActiveToken ? "Sem plano ativo" :
                       tokenStatus.daysRemaining !== null && tokenStatus.daysRemaining <= 7 ? `Plano vence em ${tokenStatus.daysRemaining} dias` :
                       "Plano ativo"}
                    </p>
                    {tokenStatus.expiresAt && (
                      <p className="text-muted-foreground text-xs">
                        Validade: {new Date(tokenStatus.expiresAt).toLocaleDateString("pt-BR")}
                        {tokenStatus.daysRemaining !== null && tokenStatus.daysRemaining > 0 && ` • ${tokenStatus.daysRemaining} dias restantes`}
                      </p>
                    )}
                  </div>
                </div>
                {(tokenStatus.isExpired || !tokenStatus.hasActiveToken || (tokenStatus.daysRemaining !== null && tokenStatus.daysRemaining <= 7)) && (
                  <Button size="sm" className="gap-2" onClick={() => window.location.href = "/plans"}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    {tokenStatus.isExpired ? "Renovar plano" : "Ver planos"}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Stats Cards - responsive grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs lg:text-sm font-medium">Faturamento</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">R$ {totalRevenue.toFixed(2)}</p>
                </div>
                <DollarSign className="w-6 h-6 lg:w-8 lg:h-8 text-green-500 hidden sm:block" />
              </div>
            </Card>

            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs lg:text-sm font-medium">Comissões</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">R$ {totalCommissions.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-blue-500 hidden sm:block" />
              </div>
            </Card>

            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs lg:text-sm font-medium">Líquido</p>
                  <p className="text-lg lg:text-2xl font-bold text-green-400 mt-1 lg:mt-2">R$ {netRevenue.toFixed(2)}</p>
                </div>
                <Banknote className="w-6 h-6 lg:w-8 lg:h-8 text-emerald-500 hidden sm:block" />
              </div>
            </Card>

            <Card className="p-3 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs lg:text-sm font-medium">Atendimentos</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">{appointmentCount}</p>
                </div>
                <Calendar className="w-6 h-6 lg:w-8 lg:h-8 text-purple-500 hidden sm:block" />
              </div>
            </Card>

            <Card className="p-3 lg:p-6 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs lg:text-sm font-medium">Barbeiros</p>
                  <p className="text-lg lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">{barberCount}</p>
                </div>
                <Users className="w-6 h-6 lg:w-8 lg:h-8 text-orange-500 hidden sm:block" />
              </div>
            </Card>
          </div>

          {/* Payment Method Breakdown */}
          {paymentBreakdown.length > 0 && (
            <div className="mb-6">
              <h2 className="text-base lg:text-lg font-bold text-foreground mb-3">Faturamento por Tipo de Pagamento</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paymentBreakdown.map((pm) => (
                  <Card key={pm.label} className="p-3 lg:p-4" style={{ borderLeftWidth: 3, borderLeftColor: pm.color }}>
                    <div className="flex items-center gap-2 mb-1">
                      {pm.icon === "credit" && <CreditCard className="w-4 h-4" style={{ color: pm.color }} />}
                      {pm.icon === "debit" && <CreditCard className="w-4 h-4" style={{ color: pm.color }} />}
                      {pm.icon === "pix" && <Smartphone className="w-4 h-4" style={{ color: pm.color }} />}
                      {pm.icon === "cash" && <Wallet className="w-4 h-4" style={{ color: pm.color }} />}
                      <span className="text-xs text-muted-foreground font-medium">{pm.label}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">R$ {pm.total.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{pm.count} atendimento{pm.count !== 1 ? 's' : ''}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Charts - responsive */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <Card className="p-4 lg:p-6">
              <h2 className="text-base lg:text-lg font-bold text-foreground mb-4">Faturamento por Dia</h2>
              {isLoading ? (
                <div className="flex items-center justify-center h-60 lg:h-80">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#999" fontSize={11} />
                    <YAxis stroke="#999" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Faturamento (R$)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-4 lg:p-6">
              <h2 className="text-base lg:text-lg font-bold text-foreground mb-4">Atendimentos por Dia</h2>
              {isLoading ? (
                <div className="flex items-center justify-center h-60 lg:h-80">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="#999" fontSize={11} />
                    <YAxis stroke="#999" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="count" fill="#8b5cf6" name="Atendimentos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
