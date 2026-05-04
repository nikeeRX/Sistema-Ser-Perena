import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import DashboardNav from "@/components/DashboardNav";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, CheckCircle, User, Scissors, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type ExtraItem = {
  serviceName: string;
  servicePrice: string;
  discount: string;
  commissionAmount: string;
};

type CommissionRow = {
  id: number;
  barberId: number;
  appointmentId: number;
  commissionAmount: string | number;
  commissionDate: Date;
  status: string;
  paymentMethod: string | null;
  clientName: string | null;
  notes: string | null;
  servicePrice: string | number | null;
  barberCommission: string | number | null;
  extraItems: ExtraItem[];
};

export default function Commissions() {
  const [match, params] = useRoute("/dashboard/:branchId/commissions");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const localUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = localUser?.role;
  const userBarberId = localUser?.barberId;
  const isBarberUser = userRole === "barber" && !!userBarberId;

  const [selectedBarberId, setSelectedBarberId] = useState<number | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [expandedBarbers, setExpandedBarbers] = useState<Record<number, boolean>>({});

  const { data: branch } = trpc.branches.getById.useQuery(
    { id: branchId! },
    { enabled: !!branchId }
  );

  const { data: barberCommissions, isLoading: isLoadingBarber, refetch: refetchBarber } = trpc.commissions.getByBarber.useQuery(
    {
      barberId: userBarberId!,
      startDate: new Date(dateRange.start),
      endDate: new Date(dateRange.end),
    },
    { enabled: !!branchId && isBarberUser }
  );

  const { data: branchCommissions, isLoading: isLoadingBranch, refetch: refetchBranch } = trpc.commissions.getByBranch.useQuery(
    {
      branchId: branchId!,
      startDate: new Date(dateRange.start),
      endDate: new Date(dateRange.end),
    },
    { enabled: !!branchId && !isBarberUser }
  );

  const commissions = (isBarberUser ? barberCommissions : branchCommissions) as CommissionRow[] | undefined;
  const isLoading = isBarberUser ? isLoadingBarber : isLoadingBranch;
  const refetch = isBarberUser ? refetchBarber : refetchBranch;

  const { data: barbers } = trpc.barbers.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const updateStatusMutation = trpc.commissions.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Comissão marcada como paga!");
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao marcar como paga"),
  });

  if (!branchId) {
    setLocation("/");
    return null;
  }

  const getBarberName = (id: number) => barbers?.find(b => b.id === id)?.name || "Desconhecido";

  const paymentLabels: Record<string, string> = {
    credit: "Crédito", debit: "Débito", pix: "Pix", cash: "Dinheiro",
  };
  const paymentColors: Record<string, string> = {
    credit: "bg-purple-500/20 text-purple-300",
    debit: "bg-blue-500/20 text-blue-300",
    pix: "bg-emerald-500/20 text-emerald-300",
    cash: "bg-amber-500/20 text-amber-300",
  };

  // Parse main service name from notes
  const parseMainServiceName = (notes: string | null) => {
    if (!notes) return "Serviço";
    const text = notes.replace(/^\[(Serviço|Produto)\]\s*/, "");
    const [servicesPart] = text.split(" - ");
    return servicesPart ? servicesPart.split(" + ")[0] : "Serviço";
  };

  // Filter
  let filteredCommissions = (!isBarberUser && selectedBarberId)
    ? commissions?.filter((com) => com.barberId === selectedBarberId)
    : commissions;
  if (selectedPaymentMethod) {
    filteredCommissions = filteredCommissions?.filter((com) => com.paymentMethod === selectedPaymentMethod);
  }

  // Group by barber
  const commissionsByBarber = filteredCommissions?.reduce((acc: Record<number, {
    barberId: number;
    barberName: string;
    total: number;
    pending: number;
    paid: number;
    commissions: CommissionRow[];
  }>, com) => {
    const bid = com.barberId;
    if (!acc[bid]) {
      acc[bid] = { barberId: bid, barberName: getBarberName(bid), total: 0, pending: 0, paid: 0, commissions: [] };
    }
    // Total commission = main commission + extra items commissions
    const mainComm = parseFloat(com.commissionAmount.toString());
    const extraComm = com.extraItems.reduce((s, i) => s + parseFloat(i.commissionAmount), 0);
    const totalComm = mainComm + extraComm;

    acc[bid].total += totalComm;
    if (com.status === "pending") {
      acc[bid].pending += totalComm;
    } else {
      acc[bid].paid += totalComm;
    }
    acc[bid].commissions.push(com);
    return acc;
  }, {}) || {};

  const toggleBarber = (barberId: number) => {
    setExpandedBarbers(prev => ({ ...prev, [barberId]: !prev[barberId] }));
  };

  return (
    <div className="flex">
      <DashboardNav branchId={branchId} branchName={branch?.name || "Unidade"} />

      <main className="flex-1 ml-0 lg:ml-64 bg-background min-h-screen pt-14 lg:pt-0">
        <div className="bg-card border-b border-border p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <div>
              <h1 className="text-xl lg:text-3xl font-bold text-foreground">Comissões</h1>
              <p className="text-muted-foreground text-sm mt-1">{branch?.name}</p>
            </div>
            <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-blue-400" />
          </div>

          <div className="flex gap-3 lg:gap-4 items-end flex-wrap">
            <div>
              <Label>Data Inicial</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
            {!isBarberUser && (
              <div>
                <Label>Barbeiro</Label>
                <select
                  value={selectedBarberId || ""}
                  onChange={(e) => setSelectedBarberId(e.target.value ? parseInt(e.target.value) : null)}
                  className="px-3 py-2 border border-border bg-card text-foreground rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Todos os barbeiros</option>
                  {barbers?.map((barber) => (
                    <option key={barber.id} value={barber.id}>{barber.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label>Pagamento</Label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="px-3 py-2 border border-border bg-card text-foreground rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos</option>
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
                <option value="pix">Pix</option>
                <option value="cash">Dinheiro</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : Object.keys(commissionsByBarber).length > 0 ? (
            <div className="space-y-4 lg:space-y-6">
              {Object.values(commissionsByBarber).map((barberData) => {
                const isExpanded = expandedBarbers[barberData.barberId] !== false; // default expanded
                return (
                  <Card key={barberData.barberId} className="overflow-hidden">
                    {/* Barber header — clickable to collapse */}
                    <button
                      className="w-full p-4 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-secondary/30 transition-colors text-left"
                      onClick={() => toggleBarber(barberData.barberId)}
                    >
                      <div>
                        <h2 className="text-lg lg:text-xl font-bold text-foreground">{barberData.barberName}</h2>
                        <p className="text-muted-foreground text-sm mt-0.5">
                          {barberData.commissions.length} atendimento(s) · {barberData.commissions.reduce((s, c) => s + 1 + c.extraItems.length, 0)} serviço(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left sm:text-right">
                          <p className="text-2xl lg:text-3xl font-bold text-foreground">
                            R$ {barberData.total.toFixed(2)}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-yellow-400">Pendente: R$ {barberData.pending.toFixed(2)}</span>
                            <span className="text-green-400">Pago: R$ {barberData.paid.toFixed(2)}</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border divide-y divide-border">
                        {barberData.commissions.map((com) => {
                          const mainServiceName = parseMainServiceName(com.notes);
                          const mainPrice = parseFloat(com.servicePrice?.toString() || "0");
                          const mainComm = parseFloat(com.barberCommission?.toString() || com.commissionAmount.toString());
                          const date = new Date(com.commissionDate).toLocaleDateString("pt-BR");

                          // Build list of all service lines for this commission
                          type ServiceLine = { key: string; name: string; price: number; commission: number; isExtra: boolean };
                          const serviceLines: ServiceLine[] = [
                            { key: `main-${com.id}`, name: mainServiceName, price: mainPrice, commission: mainComm, isExtra: false },
                            ...com.extraItems.map((item, idx) => ({
                              key: `extra-${com.id}-${idx}`,
                              name: item.serviceName,
                              price: parseFloat(item.servicePrice) - parseFloat(item.discount || "0"),
                              commission: parseFloat(item.commissionAmount),
                              isExtra: true,
                            })),
                          ];

                          const totalComm = serviceLines.reduce((s, l) => s + l.commission, 0);
                          const totalPrice = serviceLines.reduce((s, l) => s + l.price, 0);

                          return (
                            <div key={com.id} className="p-4 lg:p-5">
                              {/* Appointment header */}
                              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {com.clientName && (
                                    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                                      {com.clientName}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">{date}</span>
                                  {com.paymentMethod && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${paymentColors[com.paymentMethod] || "bg-secondary text-foreground"}`}>
                                      {paymentLabels[com.paymentMethod] || com.paymentMethod}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {com.status === "paid" ? (
                                    <div className="flex items-center gap-1 text-green-400">
                                      <CheckCircle className="w-4 h-4" />
                                      <span className="text-xs font-medium">Pago</span>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7 px-2"
                                      onClick={() => updateStatusMutation.mutate({ commissionId: com.id, status: "paid" })}
                                      disabled={updateStatusMutation.isPending}
                                    >
                                      {updateStatusMutation.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        "Marcar como Pago"
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Service lines */}
                              <div className="space-y-1.5 bg-secondary/30 rounded-md p-3">
                                {serviceLines.map((line) => (
                                  <div key={line.key} className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Scissors className="w-3 h-3 text-muted-foreground shrink-0" />
                                      <span className="text-sm text-foreground truncate">{line.name}</span>
                                      {line.isExtra && (
                                        <span className="text-xs text-muted-foreground shrink-0">(extra)</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 text-right">
                                      <span className="text-xs text-muted-foreground">R$ {line.price.toFixed(2)}</span>
                                      <span className="text-sm font-medium text-blue-400">comissão R$ {line.commission.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))}
                                {serviceLines.length > 1 && (
                                  <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border/50">
                                    <span className="text-xs font-medium text-muted-foreground">Total do atendimento</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground">R$ {totalPrice.toFixed(2)}</span>
                                      <span className="text-sm font-bold text-blue-400">comissão R$ {totalComm.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 lg:p-12 text-center">
              <TrendingUp className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma comissão neste período</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
