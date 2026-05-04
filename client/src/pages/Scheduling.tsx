import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import DashboardNav from "@/components/DashboardNav";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  XCircle,
  User,
  Phone,
  Scissors,
  Package,
  Gift,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

// Numeric input helper
function NumericInput({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  ...props
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  [key: string]: any;
}) {
  const [displayValue, setDisplayValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={isFocused ? displayValue : value.toString()}
      onFocus={(e) => {
        setIsFocused(true);
        if (value === 0) setDisplayValue("");
        else setDisplayValue(value.toString());
        e.target.select();
      }}
      onBlur={() => {
        setIsFocused(false);
        if (displayValue === "" || isNaN(parseFloat(displayValue))) {
          onChange(0);
          setDisplayValue("0");
        }
      }}
      onChange={(e) => {
        setDisplayValue(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) onChange(parsed);
      }}
      {...props}
    />
  );
}

type StatusType = "scheduled" | "in_progress" | "completed" | "cancelled";

const statusConfig: Record<
  StatusType,
  { label: string; color: string; bgColor: string; icon: any }
> = {
  scheduled: {
    label: "Agendado",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    icon: Calendar,
  },
  in_progress: {
    label: "Em Atendimento",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    icon: PlayCircle,
  },
  completed: {
    label: "Finalizado",
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/30",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
    icon: XCircle,
  },
};

export default function Scheduling() {
  const [match, params] = useRoute("/dashboard/:branchId/scheduling");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;

  // Get user info
  const localUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = localUser?.role;
  const userBarberId = localUser?.barberId;

  // Selected date for viewing
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Filter tab
  const [activeTab, setActiveTab] = useState<
    "all" | "scheduled" | "in_progress" | "completed"
  >("all");

  // Dialog states
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedScheduling, setSelectedScheduling] = useState<any>(null);

  // New scheduling form
  const [newForm, setNewForm] = useState({
    barberId: "",
    clientName: "",
    clientPhone: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "10:00",
    notes: "",
  });

  // Complete form (finalization)
  const [completeForm, setCompleteForm] = useState({
    type: "service" as "service" | "product",
    serviceId: "",
    productId: "",
    productQuantity: 1,
    discount: 0,
    tip: 0,
    commissionPercentage: 30,
    paymentMethod: "cash" as "credit" | "debit" | "pix" | "cash",
    notes: "",
  });

  // Extra service items for multi-service support
  type ExtraItem = { serviceId: string; commissionPercentage: number; discount: number };
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);

  // Queries
  const { data: branch } = trpc.branches.getById.useQuery(
    { id: branchId! },
    { enabled: !!branchId }
  );

  const { data: barbers } = trpc.barbers.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const { data: services } = trpc.services.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const { data: productsList } = trpc.products.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const dateObj = useMemo(() => new Date(selectedDate + "T12:00:00"), [selectedDate]);

  const {
    data: schedulingList,
    isLoading,
    refetch,
  } = trpc.scheduling.listByBranch.useQuery(
    { branchId: branchId!, date: dateObj },
    { enabled: !!branchId }
  );

  // Mutations
  const createMutation = trpc.scheduling.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      resetNewForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao criar agendamento"),
  });

  const updateStatusMutation = trpc.scheduling.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar status"),
  });

  const addItemMutation = trpc.appointmentItems.addItem.useMutation();

  const createAppointmentMutation = trpc.appointments.create.useMutation({
    onSuccess: async (data) => {
      // Save extra service items
      if (extraItems.length > 0 && data?.id) {
        for (const item of extraItems) {
          if (item.serviceId) {
            const svc = services?.find((s) => s.id === parseInt(item.serviceId));
            if (!svc) continue;
            try {
              await addItemMutation.mutateAsync({
                appointmentId: data.id,
                serviceId: parseInt(item.serviceId),
                serviceName: svc.name,
                servicePrice: parseFloat(svc.price.toString()),
                discount: item.discount || 0,
                commissionPercentage: item.commissionPercentage,
              });
            } catch (e) {
              // continue even if one item fails
            }
          }
        }
      }
      toast.success("Atendimento finalizado com sucesso!");
      setIsCompleteDialogOpen(false);
      setSelectedScheduling(null);
      resetCompleteForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao finalizar atendimento"),
  });

  const deleteMutation = trpc.scheduling.delete.useMutation({
    onSuccess: () => {
      toast.success("Agendamento cancelado!");
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao cancelar"),
  });

  // Helpers
  const resetNewForm = () => {
    setNewForm({
      barberId: "",
      clientName: "",
      clientPhone: "",
      scheduledDate: selectedDate,
      scheduledTime: "10:00",
      notes: "",
    });
    setIsNewDialogOpen(false);
  };

  const resetCompleteForm = () => {
    setCompleteForm({
      type: "service",
      serviceId: "",
      productId: "",
      productQuantity: 1,
      discount: 0,
      tip: 0,
      commissionPercentage: 30,
      paymentMethod: "cash" as "credit" | "debit" | "pix" | "cash",
      notes: "",
    });
    setExtraItems([]);
  };

  const handleCreateScheduling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !newForm.barberId || !newForm.clientName.trim()) return;

    const dateTime = new Date(
      `${newForm.scheduledDate}T${newForm.scheduledTime}`
    );

    createMutation.mutate({
      branchId,
      barberId: parseInt(newForm.barberId),
      clientName: newForm.clientName.trim(),
      clientPhone: newForm.clientPhone || undefined,
      scheduledDate: dateTime,
      notes: newForm.notes || undefined,
    });
  };

  const handleStartService = (item: any) => {
    updateStatusMutation.mutate(
      { id: item.id, status: "in_progress" },
      {
        onSuccess: () => toast.success(`${item.clientName} agora está em atendimento!`),
      }
    );
  };

  const handleOpenComplete = (item: any) => {
    setSelectedScheduling(item);
    // Pre-fill commission percentage from barber
    const barber = barbers?.find((b) => b.id === item.barberId);
    if (barber) {
      setCompleteForm((prev) => ({
        ...prev,
        commissionPercentage: parseFloat(
          barber.commissionPercentage?.toString() || "30"
        ),
      }));
    }
    setIsCompleteDialogOpen(true);
  };

  const handleCompleteService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !selectedScheduling) return;

    if (completeForm.type === "service" && !completeForm.serviceId) {
      toast.error("Selecione um serviço");
      return;
    }
    if (completeForm.type === "product" && !completeForm.productId) {
      toast.error("Selecione um produto");
      return;
    }

    createAppointmentMutation.mutate({
      branchId,
      barberId: selectedScheduling.barberId,
      type: completeForm.type,
      serviceId:
        completeForm.type === "service"
          ? parseInt(completeForm.serviceId)
          : undefined,
      productId:
        completeForm.type === "product"
          ? parseInt(completeForm.productId)
          : undefined,
      productQuantity:
        completeForm.type === "product"
          ? completeForm.productQuantity
          : undefined,
      appointmentDate: new Date(),
      clientName: selectedScheduling.clientName,
      discount: completeForm.discount,
      tip: completeForm.type === "service" ? completeForm.tip : 0,
      commissionPercentage: completeForm.commissionPercentage,
      notes: completeForm.notes,
      schedulingId: selectedScheduling.id,
      paymentMethod: completeForm.paymentMethod,
    });
  };

  const handleCancelScheduling = (item: any) => {
    if (confirm(`Cancelar agendamento de ${item.clientName}?`)) {
      updateStatusMutation.mutate({ id: item.id, status: "cancelled" });
    }
  };

  // Navigate dates
  const goToPrevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (!schedulingList) return [];
    let items = schedulingList;
    // If barber role, only show their own
    if (userRole === "barber" && userBarberId) {
      items = items.filter((i) => i.barberId === userBarberId);
    }
    if (activeTab !== "all") {
      items = items.filter((i) => i.status === activeTab);
    }
    return items;
  }, [schedulingList, activeTab, userRole, userBarberId]);

  // Counts
  const counts = useMemo(() => {
    if (!schedulingList) return { all: 0, scheduled: 0, in_progress: 0, completed: 0 };
    const items = userRole === "barber" && userBarberId
      ? schedulingList.filter((i) => i.barberId === userBarberId)
      : schedulingList;
    return {
      all: items.length,
      scheduled: items.filter((i) => i.status === "scheduled").length,
      in_progress: items.filter((i) => i.status === "in_progress").length,
      completed: items.filter((i) => i.status === "completed").length,
    };
  }, [schedulingList, userRole, userBarberId]);

  // Calculate preview totals for complete form
  let itemPrice = 0;
  if (completeForm.type === "service" && completeForm.serviceId) {
    const selectedService = services?.find(
      (s) => s.id === parseInt(completeForm.serviceId)
    );
    itemPrice = selectedService
      ? parseFloat(selectedService.price.toString())
      : 0;
  } else if (completeForm.type === "product" && completeForm.productId) {
    const selectedProduct = productsList?.find(
      (p) => p.id === parseInt(completeForm.productId)
    );
    itemPrice = selectedProduct
      ? parseFloat(selectedProduct.price.toString()) * completeForm.productQuantity
      : 0;
  }
  const finalPreview = itemPrice - completeForm.discount;
  const tipPreview = completeForm.type === "service" ? completeForm.tip : 0;
  const commissionPreview =
    (finalPreview * completeForm.commissionPercentage) / 100;

  // Extra items preview
  const extraItemsPreview = extraItems.map((item) => {
    const svc = services?.find((s) => s.id === parseInt(item.serviceId));
    const price = svc ? parseFloat(svc.price.toString()) : 0;
    const commission = (price * item.commissionPercentage) / 100;
    return { svc, price, commission, commissionPercentage: item.commissionPercentage };
  });
  const extraTotalPrice = extraItemsPreview.reduce((sum, i) => sum + i.price, 0);
  const extraTotalCommission = extraItemsPreview.reduce((sum, i) => sum + i.commission, 0);
  const grandTotal = finalPreview + extraTotalPrice;
  const grandCommission = commissionPreview + extraTotalCommission;

  if (!branchId) {
    setLocation("/");
    return null;
  }

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const label = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (isToday) return `Hoje - ${label}`;
    if (isTomorrow) return `Amanhã - ${label}`;
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const canManage = userRole === "admin" || userRole === "owner" || userRole === "user" || userRole === "barber";

  return (
    <div className="flex">
      <DashboardNav branchId={branchId} branchName={branch?.name || "Unidade"} />

      <main className="flex-1 ml-0 lg:ml-64 bg-background min-h-screen pt-14 lg:pt-0">
        {/* Header */}
        <div className="bg-card border-b border-border p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl lg:text-3xl font-bold text-foreground">
                Agenda
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {branch?.name}
              </p>
            </div>
            {canManage && (
              <Dialog
                open={isNewDialogOpen}
                onOpenChange={(open) => {
                  if (!open) resetNewForm();
                  setIsNewDialogOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2" size="sm">
                    <Plus className="w-4 h-4" />
                    Novo Agendamento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Agendamento</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateScheduling} className="space-y-4">
                    <div>
                      <Label>Cliente *</Label>
                      <Input
                        placeholder="Nome do cliente"
                        value={newForm.clientName}
                        onChange={(e) =>
                          setNewForm({ ...newForm, clientName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Telefone do Cliente</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={newForm.clientPhone}
                        onChange={(e) =>
                          setNewForm({ ...newForm, clientPhone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Barbeiro *</Label>
                      <Select
                        value={newForm.barberId}
                        onValueChange={(value) =>
                          setNewForm({ ...newForm, barberId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um barbeiro" />
                        </SelectTrigger>
                        <SelectContent>
                          {barbers?.map((barber) => (
                            <SelectItem
                              key={barber.id}
                              value={barber.id.toString()}
                            >
                              {barber.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data *</Label>
                        <Input
                          type="date"
                          value={newForm.scheduledDate}
                          onChange={(e) =>
                            setNewForm({
                              ...newForm,
                              scheduledDate: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Horário *</Label>
                        <Input
                          type="time"
                          value={newForm.scheduledTime}
                          onChange={(e) =>
                            setNewForm({
                              ...newForm,
                              scheduledTime: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={newForm.notes}
                        onChange={(e) =>
                          setNewForm({ ...newForm, notes: e.target.value })
                        }
                        placeholder="Anotações sobre o agendamento"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Agendando...
                        </>
                      ) : (
                        "Agendar"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={goToPrevDay}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="text-xs"
            >
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextDay}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <span className="text-sm text-muted-foreground ml-2 hidden sm:inline">
              {formatDateLabel(selectedDate)}
            </span>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="border-b border-border bg-card/50">
          <div className="flex overflow-x-auto px-4 lg:px-6">
            {(
              [
                { key: "all", label: "Todos", count: counts.all },
                {
                  key: "scheduled",
                  label: "Agendados",
                  count: counts.scheduled,
                },
                {
                  key: "in_progress",
                  label: "Em Atendimento",
                  count: counts.in_progress,
                },
                {
                  key: "completed",
                  label: "Finalizados",
                  count: counts.completed,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}{" "}
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 lg:p-6">
          {/* Mobile date label */}
          <p className="text-sm font-medium text-foreground mb-4 sm:hidden">
            {formatDateLabel(selectedDate)}
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="space-y-3">
              {filteredItems.map((item: any) => {
                const status = statusConfig[item.status as StatusType];
                const StatusIcon = status?.icon || Calendar;
                return (
                  <Card
                    key={item.id}
                    className={`p-4 lg:p-5 border ${status?.bgColor || "border-border"} transition-all`}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status?.color} ${status?.bgColor}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status?.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatTime(item.scheduledDate)}
                          </span>
                        </div>

                        {/* Client Info */}
                        <h3 className="text-base lg:text-lg font-bold text-foreground flex items-center gap-2">
                          <User className="w-4 h-4 text-primary shrink-0" />
                          {item.clientName}
                        </h3>
                        {item.clientPhone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <Phone className="w-3.5 h-3.5" />
                            {item.clientPhone}
                          </p>
                        )}

                        {/* Barber */}
                        <p className="text-sm text-muted-foreground mt-1">
                          <Scissors className="w-3.5 h-3.5 inline mr-1" />
                          Barbeiro:{" "}
                          <span className="font-medium text-foreground">
                            {item.barberName || "Desconhecido"}
                          </span>
                        </p>

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 rounded px-2 py-1">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                        {item.status === "scheduled" && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 sm:flex-none gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => handleStartService(item)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <PlayCircle className="w-4 h-4" />
                              Iniciar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 sm:flex-none gap-1.5 border-red-400/30 text-red-400 hover:bg-red-400/10"
                              onClick={() => handleCancelScheduling(item)}
                            >
                              <XCircle className="w-4 h-4" />
                              Cancelar
                            </Button>
                          </>
                        )}
                        {item.status === "in_progress" && (
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none gap-1.5 bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => handleOpenComplete(item)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Finalizar
                          </Button>
                        )}
                        {item.status === "completed" && (
                          <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Concluído
                          </div>
                        )}
                        {item.status === "cancelled" && (
                          <div className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                            <XCircle className="w-4 h-4" />
                            Cancelado
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 lg:p-12 text-center">
              <Calendar className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                Nenhum agendamento para{" "}
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
              {canManage && (
                <Button
                  onClick={() => setIsNewDialogOpen(true)}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Agendamento
                </Button>
              )}
            </Card>
          )}
        </div>
      </main>

      {/* Complete/Finalize Dialog */}
      <Dialog
        open={isCompleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCompleteDialogOpen(false);
            setSelectedScheduling(null);
            resetCompleteForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Finalizar Atendimento
              {selectedScheduling && (
                <span className="block text-sm font-normal text-muted-foreground mt-1">
                  Cliente: {selectedScheduling.clientName} | Barbeiro:{" "}
                  {selectedScheduling.barberName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCompleteService} className="space-y-4">
            {/* Tipo: Serviço ou Produto */}
            <div>
              <Label>Tipo de Venda</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={
                    completeForm.type === "service" ? "default" : "outline"
                  }
                  className="flex-1 gap-2"
                  onClick={() =>
                    setCompleteForm({
                      ...completeForm,
                      type: "service",
                      productId: "",
                      productQuantity: 1,
                    })
                  }
                >
                  <Scissors className="w-4 h-4" />
                  Serviço
                </Button>
                <Button
                  type="button"
                  variant={
                    completeForm.type === "product" ? "default" : "outline"
                  }
                  className="flex-1 gap-2"
                  onClick={() =>
                    setCompleteForm({
                      ...completeForm,
                      type: "product",
                      serviceId: "",
                      tip: 0,
                    })
                  }
                >
                  <Package className="w-4 h-4" />
                  Produto
                </Button>
              </div>
            </div>

            {/* Serviço principal + extras */}
            {completeForm.type === "service" && (
              <div className="space-y-3">
                {/* Serviço principal */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Serviço Principal *</Label>
                    <Select
                      value={completeForm.serviceId}
                      onValueChange={(value) =>
                        setCompleteForm({ ...completeForm, serviceId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services?.map((service) => (
                          <SelectItem key={service.id} value={service.id.toString()}>
                            {service.name} - R$ {parseFloat(service.price.toString()).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Serviços extras */}
                {extraItems.map((item, idx) => (
                  <div key={idx} className="space-y-2 bg-secondary/30 rounded-lg p-2">
                    <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Serviço {idx + 2}</Label>
                      <Select
                        value={item.serviceId}
                        onValueChange={(value) => {
                          const updated = [...extraItems];
                          const svc = services?.find((s) => s.id === parseInt(value));
                          const barber = barbers?.find((b) => b.id === selectedScheduling?.barberId);
                          updated[idx] = {
                            serviceId: value,
                            commissionPercentage: barber
                              ? parseFloat(barber.commissionPercentage?.toString() || "30")
                              : 30,
                            discount: updated[idx]?.discount || 0,
                          };
                          setExtraItems(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {services?.map((service) => (
                            <SelectItem key={service.id} value={service.id.toString()}>
                              {service.name} - R$ {parseFloat(service.price.toString()).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="border-red-400/30 text-red-400 hover:bg-red-400/10 shrink-0"
                      onClick={() => setExtraItems(extraItems.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    </div>
                    {/* Desconto individual por serviço extra */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Desconto (R$):</Label>
                      <NumericInput
                        value={item.discount}
                        onChange={(val) => {
                          const updated = [...extraItems];
                          updated[idx] = { ...updated[idx], discount: Math.max(0, val) };
                          setExtraItems(updated);
                        }}
                        min={0}
                        step="0.01"
                        className="h-7 text-xs w-24"
                      />
                    </div>
                  </div>
                ))}

                {/* Botão adicionar serviço */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-dashed"
                  onClick={() => {
                    const barber = barbers?.find((b) => b.id === selectedScheduling?.barberId);
                    setExtraItems([
                      ...extraItems,
                      {
                        serviceId: "",
                        commissionPercentage: barber
                          ? parseFloat(barber.commissionPercentage?.toString() || "30")
                          : 30,
                        discount: 0,
                      },
                    ]);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Serviço
                </Button>
              </div>
            )}

            {/* Produto */}
            {completeForm.type === "product" && (
              <>
                <div>
                  <Label>Produto *</Label>
                  <Select
                    value={completeForm.productId}
                    onValueChange={(value) =>
                      setCompleteForm({ ...completeForm, productId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productsList
                        ?.filter((p) => (p.quantity || 0) > 0)
                        .map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id.toString()}
                          >
                            {product.name} - R${" "}
                            {parseFloat(product.price.toString()).toFixed(2)}{" "}
                            (Est: {product.quantity})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <NumericInput
                    value={completeForm.productQuantity}
                    onChange={(val) =>
                      setCompleteForm({
                        ...completeForm,
                        productQuantity: Math.max(1, val),
                      })
                    }
                    min={1}
                  />
                </div>
              </>
            )}

            {/* Comissão */}
            <div>
              <Label>Comissão do Barbeiro (%)</Label>
              {completeForm.type === "service" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={`${completeForm.commissionPercentage}%`}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Definido pelo admin</span>
                </div>
              ) : (
                <NumericInput
                  value={completeForm.commissionPercentage}
                  onChange={(val) =>
                    setCompleteForm({
                      ...completeForm,
                      commissionPercentage: Math.min(100, Math.max(0, val)),
                    })
                  }
                  min={0}
                  max={100}
                />
              )}
            </div>

            {/* Desconto */}
            <div>
              <Label>Desconto (R$)</Label>
              <NumericInput
                value={completeForm.discount}
                onChange={(val) =>
                  setCompleteForm({
                    ...completeForm,
                    discount: Math.max(0, val),
                  })
                }
                min={0}
                step="0.01"
              />
            </div>

            {/* Gorjeta */}
            {completeForm.type === "service" && (
              <div>
                <Label className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-yellow-400" />
                  Gorjeta (R$)
                </Label>
                <NumericInput
                  value={completeForm.tip}
                  onChange={(val) =>
                    setCompleteForm({
                      ...completeForm,
                      tip: Math.max(0, val),
                    })
                  }
                  min={0}
                  step="0.01"
                />
              </div>
            )}

            {/* Tipo de Pagamento */}
            <div>
              <Label>Tipo de Pagamento</Label>
              <Select
                value={completeForm.paymentMethod}
                onValueChange={(val) =>
                  setCompleteForm({
                    ...completeForm,
                    paymentMethod: val as "credit" | "debit" | "pix" | "cash",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div>
              <Label>Observações</Label>
              <Textarea
                value={completeForm.notes}
                onChange={(e) =>
                  setCompleteForm({ ...completeForm, notes: e.target.value })
                }
                placeholder="Anotações sobre o atendimento"
              />
            </div>

            {/* Preview */}
            {(completeForm.serviceId || completeForm.productId) && (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-sm">
                {/* Serviço principal */}
                <div className="flex justify-between text-muted-foreground">
                  <span>{completeForm.type === "service" ? "Serviço principal" : "Produto"}:</span>
                  <span>R$ {itemPrice.toFixed(2)}</span>
                </div>
                {completeForm.discount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Desconto:</span>
                    <span>- R$ {completeForm.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-blue-400">
                  <span>Comissão ({completeForm.commissionPercentage}%):</span>
                  <span>R$ {commissionPreview.toFixed(2)}</span>
                </div>

                {/* Serviços extras */}
                {extraItemsPreview.map((ep, idx) => ep.svc && (
                  <div key={idx} className="border-t border-border/50 pt-1 mt-1">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Serviço {idx + 2}: {ep.svc.name}</span>
                      <span>R$ {ep.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-400">
                      <span>Comissão ({ep.commissionPercentage}%):</span>
                      <span>R$ {ep.commission.toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                {/* Total geral */}
                <div className="flex justify-between font-bold text-foreground border-t border-border pt-1 mt-1">
                  <span>Total Geral:</span>
                  <span>R$ {grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-blue-400 font-medium">
                  <span>Comissão Total:</span>
                  <span>R$ {grandCommission.toFixed(2)}</span>
                </div>
                {tipPreview > 0 && (
                  <div className="flex justify-between text-yellow-400">
                    <span>Gorjeta:</span>
                    <span>R$ {tipPreview.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={createAppointmentMutation.isPending}
            >
              {createAppointmentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Finalizar Atendimento
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
