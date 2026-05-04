import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Calendar, Scissors, Package, Gift, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

// Helper: limpa o 0 ao focar no campo numérico
function NumericInput({ value, onChange, min, max, step, placeholder, ...props }: {
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
        if (value === 0) {
          setDisplayValue("");
        } else {
          setDisplayValue(value.toString());
        }
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
        if (!isNaN(parsed)) {
          onChange(parsed);
        }
      }}
      {...props}
    />
  );
}

// Tipo de item de serviço no formulário
interface ServiceItem {
  id: string; // temp id for list key
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  discount: number;
}

export default function Appointments() {
  const [match, params] = useRoute("/dashboard/:branchId/appointments");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Role check: only owner/admin can edit commission
  const localUser = JSON.parse(localStorage.getItem("user") || "{}");
  const canEditCommission = localUser?.role === "admin" || localUser?.role === "owner";

  // Lista de serviços adicionados ao atendimento
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [currentServiceId, setCurrentServiceId] = useState("");

  const [formData, setFormData] = useState({
    barberId: "",
    clientName: "",
    type: "service" as "service" | "product",
    productId: "",
    productQuantity: 1,
    appointmentDate: new Date().toISOString().split("T")[0],
    appointmentTime: "10:00",
    discount: 0,
    tip: 0,
    commissionPercentage: 30,
    paymentMethod: "cash" as "credit" | "debit" | "pix" | "cash",
    notes: "",
  });

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

  const { data: appointments, isLoading: appointmentsLoading, refetch } = trpc.appointments.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const addItemMutation = trpc.appointmentItems.addItem.useMutation();

  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: async (result) => {
      // If multiple services, save extra items
      if (formData.type === "service" && serviceItems.length > 1) {
        const extraItems = serviceItems.slice(1);
        for (const item of extraItems) {
          await addItemMutation.mutateAsync({
            appointmentId: (result as any).id,
            serviceName: item.serviceName,
            servicePrice: item.servicePrice,
            discount: item.discount || 0,
            commissionPercentage: formData.commissionPercentage,
          });
        }
      }
      toast.success("Atendimento registrado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao registrar atendimento"),
  });

  const resetForm = () => {
    setFormData({
      barberId: "",
      clientName: "",
      type: "service",
      productId: "",
      productQuantity: 1,
      appointmentDate: new Date().toISOString().split("T")[0],
      appointmentTime: "10:00",
      discount: 0,
      tip: 0,
      commissionPercentage: 30,
      paymentMethod: "cash" as "credit" | "debit" | "pix" | "cash",
      notes: "",
    });
    setServiceItems([]);
    setCurrentServiceId("");
    setIsDialogOpen(false);
  };

  // Adicionar serviço à lista
  const addServiceToList = () => {
    if (!currentServiceId) return;
    const selectedService = services?.find(s => s.id === parseInt(currentServiceId));
    if (!selectedService) return;
    // Avoid duplicates
    if (serviceItems.find(i => i.serviceId === currentServiceId)) {
      toast.error("Este serviço já foi adicionado");
      return;
    }
    setServiceItems([...serviceItems, {
      id: `${currentServiceId}-${Date.now()}`,
      serviceId: currentServiceId,
      serviceName: selectedService.name,
      servicePrice: parseFloat(selectedService.price.toString()),
      discount: 0,
    }]);
    setCurrentServiceId("");
  };

  const removeServiceItem = (id: string) => {
    setServiceItems(serviceItems.filter(i => i.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !formData.barberId) return;

    if (formData.type === "service" && serviceItems.length === 0) {
      toast.error("Adicione pelo menos um serviço");
      return;
    }
    if (formData.type === "product" && !formData.productId) {
      toast.error("Selecione um produto");
      return;
    }

    const dateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);

    if (formData.type === "service") {
      // First service is the "main" appointment
      const firstService = serviceItems[0];
      const allServiceNames = serviceItems.map(i => i.serviceName).join(" + ");
      createMutation.mutate({
        branchId,
        barberId: parseInt(formData.barberId),
        clientName: formData.clientName || undefined,
        type: "service",
        serviceId: parseInt(firstService.serviceId),
        appointmentDate: dateTime,
        discount: formData.discount,
        tip: formData.tip,
        commissionPercentage: formData.commissionPercentage,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes ? `${allServiceNames} - ${formData.notes}` : allServiceNames,
      });
    } else {
      createMutation.mutate({
        branchId,
        barberId: parseInt(formData.barberId),
        clientName: formData.clientName || undefined,
        type: "product",
        productId: parseInt(formData.productId),
        productQuantity: formData.productQuantity,
        appointmentDate: dateTime,
        discount: formData.discount,
        tip: 0,
        commissionPercentage: formData.commissionPercentage,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      });
    }
  };

  if (!branchId) {
    setLocation("/");
    return null;
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const getBarberName = (id: number) => barbers?.find(b => b.id === id)?.name || "Desconhecido";

  // Calculate preview totals (sum of all service items with individual discounts)
  // First item uses formData.discount; extras use item.discount
  const totalServicesPrice = serviceItems.reduce((sum, item, idx) => {
    const itemDiscount = idx === 0 ? formData.discount : (item.discount || 0);
    return sum + item.servicePrice - itemDiscount;
  }, 0);
  let itemPrice = 0;
  if (formData.type === "service") {
    itemPrice = totalServicesPrice;
  } else if (formData.type === "product" && formData.productId) {
    const selectedProduct = productsList?.find(p => p.id === parseInt(formData.productId));
    itemPrice = selectedProduct ? parseFloat(selectedProduct.price.toString()) * formData.productQuantity : 0;
  }
  // For products, apply single discount
  const finalPreview = formData.type === "product" ? itemPrice - formData.discount : itemPrice;
  const tipPreview = formData.type === "service" ? formData.tip : 0;
  const commissionPreview = (finalPreview * formData.commissionPercentage) / 100;
  const netPreview = finalPreview - commissionPreview;

  // Generate PDF for an appointment
  const generatePDF = (apt: any) => {
    const barberName = getBarberName(apt.barberId);
    const aptDate = formatDate(apt.appointmentDate);
    const mainFinalPrice = parseFloat(apt.finalPrice?.toString() || apt.servicePrice.toString());
    const mainCommission = parseFloat(apt.barberCommission.toString());
    const discount = parseFloat(apt.discount?.toString() || "0");
    const tip = parseFloat((apt as any).tip?.toString() || "0");
    const isProduct = apt.notes?.startsWith("[Produto]");
    const paymentLabels: Record<string, string> = { credit: "Crédito", debit: "Débito", pix: "Pix", cash: "Dinheiro" };
    const paymentLabel = paymentLabels[apt.paymentMethod] || apt.paymentMethod || "Dinheiro";
    const clientName = (apt as any).clientName;

    // Parse notes for obs text
    const notesText = apt.notes?.replace(/^\[(Serviço|Produto)\]\s*/, "") || "";
    const [servicesPart, ...notesParts] = notesText.split(" - ");
    const obsText = notesParts.join(" - ");

    // Build service list from extraItems (accurate data) or fallback to notes
    const extraItems: Array<{serviceName: string; servicePrice: string; discount: string; commissionAmount: string}> = apt.extraItems || [];
    const mainServiceName = servicesPart ? servicesPart.split(" + ")[0] : "Serviço";
    const mainServicePrice = parseFloat(apt.servicePrice?.toString() || "0");

    // Build all services list with individual prices
    type ServiceLine = { name: string; price: number; disc: number; commission: number };
    let allServices: ServiceLine[] = [];
    if (!isProduct) {
      if (extraItems.length > 0) {
        // Main service
        allServices.push({ name: mainServiceName, price: mainServicePrice, disc: discount, commission: mainCommission });
        // Extra items
        extraItems.forEach(item => {
          const itemPrice = parseFloat(item.servicePrice.toString());
          const itemDisc = parseFloat(item.discount?.toString() || "0");
          const itemComm = parseFloat(item.commissionAmount.toString());
          allServices.push({ name: item.serviceName, price: itemPrice, disc: itemDisc, commission: itemComm });
        });
      } else {
        // Fallback: parse from notes
        const names = servicesPart ? servicesPart.split(" + ") : ["Serviço"];
        allServices = names.map((n: string) => ({ name: n, price: 0, disc: 0, commission: 0 }));
      }
    }

    // Totals
    const extraTotal = extraItems.reduce((s, i) => s + parseFloat(i.servicePrice.toString()) - parseFloat(i.discount?.toString() || "0"), 0);
    const extraCommission = extraItems.reduce((s, i) => s + parseFloat(i.commissionAmount.toString()), 0);
    const totalFinalPrice = extraItems.length > 0 ? mainFinalPrice + extraTotal : mainFinalPrice;
    const totalCommission = extraItems.length > 0 ? mainCommission + extraCommission : mainCommission;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante de Atendimento</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #fff; color: #111; font-size: 13px; }
    .receipt { max-width: 320px; margin: 0 auto; padding: 20px 16px; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 12px; }
    .logo { font-size: 20px; font-weight: bold; letter-spacing: 2px; }
    .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
    .section { margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .row.bold { font-weight: bold; }
    .row.total { font-size: 15px; font-weight: bold; border-top: 2px dashed #333; padding-top: 6px; margin-top: 4px; }
    .row.commission { color: #1a56db; }
    .row.tip { color: #b45309; }
    .row.discount { color: #dc2626; }
    .row.net { color: #16a34a; font-weight: bold; }
    .divider { border-top: 1px dashed #aaa; margin: 8px 0; }
    .services-title { font-size: 11px; color: #555; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .service-item { display: flex; justify-content: space-between; padding: 2px 0 2px 8px; }
    .service-item .svc-name { flex: 1; margin-right: 8px; }
    .service-item .svc-disc { color: #dc2626; font-size: 11px; }
    .footer { text-align: center; font-size: 10px; color: #888; margin-top: 12px; border-top: 1px dashed #aaa; padding-top: 8px; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">✂ BARBERCTRL</div>
      <div class="subtitle">Comprovante de Atendimento</div>
    </div>

    <div class="section">
      ${clientName ? `<div class="row bold"><span>Cliente:</span><span>${clientName}</span></div>` : ''}
      <div class="row"><span>Data:</span><span>${aptDate}</span></div>
      <div class="row"><span>Barbeiro:</span><span>${barberName}</span></div>
      <div class="row"><span>Pagamento:</span><span>${paymentLabel}</span></div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="services-title">${isProduct ? "Produto" : "Serviços"}</div>
      ${isProduct
        ? `<div class="service-item"><span class="svc-name">${mainServiceName}</span><span>R$ ${totalFinalPrice.toFixed(2)}</span></div>`
        : allServices.map((svc, i) => {
            const svcFinal = svc.price > 0 ? svc.price - svc.disc : 0;
            const priceStr = svc.price > 0 ? `R$ ${svcFinal.toFixed(2)}` : '';
            const discStr = svc.disc > 0 ? `<span class="svc-disc"> (-R$ ${svc.disc.toFixed(2)})</span>` : '';
            return `<div class="service-item"><span class="svc-name">${i + 1}. ${svc.name}${discStr}</span><span>${priceStr}</span></div>`;
          }).join("")
      }
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="row total"><span>Total:</span><span>R$ ${totalFinalPrice.toFixed(2)}</span></div>
      ${!isProduct ? `<div class="row commission"><span>Comissão barbeiro:</span><span>R$ ${totalCommission.toFixed(2)}</span></div>` : ""}
      ${tip > 0 ? `<div class="row tip"><span>Gorjeta:</span><span>R$ ${tip.toFixed(2)}</span></div>` : ""}
      <div class="row net"><span>Líquido barbearia:</span><span>R$ ${(totalFinalPrice - totalCommission).toFixed(2)}</span></div>
    </div>

    ${obsText ? `<div class="divider"></div><div class="section"><div class="services-title">Observações</div><div style="padding: 2px 0;">${obsText}</div></div>` : ""}

    <div class="footer">
      Obrigado pela preferência!<br>
      BarberCtrl — Sistema de Gestão para Barbearias
    </div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  return (
    <div className="flex">
      <DashboardNav branchId={branchId} branchName={branch?.name || "Unidade"} />

      <main className="flex-1 ml-0 lg:ml-64 bg-background min-h-screen pt-14 lg:pt-0">
        <div className="bg-card border-b border-border p-4 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-3xl font-bold text-foreground">Atendimentos</h1>
            <p className="text-muted-foreground text-sm mt-1">{branch?.name}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm">
                <Plus className="w-4 h-4" />
                Novo Atendimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Atendimento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome do Cliente */}
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="Ex: João Silva (opcional)"
                  />
                </div>

                {/* Barbeiro */}
                <div>
                  <Label>Barbeiro</Label>
                  <Select
                    value={formData.barberId}
                    onValueChange={(value) => {
                      const selectedBarber = barbers?.find(b => b.id.toString() === value);
                      const barberCommission = selectedBarber?.commissionPercentage
                        ? parseFloat(selectedBarber.commissionPercentage.toString())
                        : 30;
                      setFormData({ ...formData, barberId: value, commissionPercentage: barberCommission });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um barbeiro" />
                    </SelectTrigger>
                    <SelectContent>
                      {barbers?.map((barber) => (
                        <SelectItem key={barber.id} value={barber.id.toString()}>{barber.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipo: Serviço ou Produto */}
                <div>
                  <Label>Tipo de Venda</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      variant={formData.type === "service" ? "default" : "outline"}
                      className="flex-1 gap-2"
                      onClick={() => { setFormData({ ...formData, type: "service", productId: "", productQuantity: 1 }); setServiceItems([]); setCurrentServiceId(""); }}
                    >
                      <Scissors className="w-4 h-4" />
                      Serviço
                    </Button>
                    <Button
                      type="button"
                      variant={formData.type === "product" ? "default" : "outline"}
                      className="flex-1 gap-2"
                      onClick={() => { setFormData({ ...formData, type: "product", tip: 0 }); setServiceItems([]); setCurrentServiceId(""); }}
                    >
                      <Package className="w-4 h-4" />
                      Produto
                    </Button>
                  </div>
                </div>

                {/* Serviços (múltiplos) */}
                {formData.type === "service" && (
                  <div className="space-y-2">
                    <Label>Serviços realizados</Label>
                    {/* Lista de serviços adicionados */}
                    {serviceItems.length > 0 && (
                      <div className="space-y-2 bg-secondary/30 rounded-lg p-2">
                        {serviceItems.map((item, idx) => (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1">
                                <span className="text-muted-foreground text-xs">{idx + 1}.</span>
                                <span className="font-medium">{item.serviceName}</span>
                                <span className="text-muted-foreground">— R$ {item.servicePrice.toFixed(2)}</span>
                                {idx > 0 && item.discount > 0 && (
                                  <span className="text-red-400 text-xs">(-R$ {item.discount.toFixed(2)})</span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeServiceItem(item.id)}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Desconto individual para serviços extras (a partir do 2º) */}
                            {idx > 0 && (
                              <div className="flex items-center gap-2 pl-4">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Desconto (R$):</Label>
                                <NumericInput
                                  value={item.discount}
                                  onChange={(val) => {
                                    const updated = serviceItems.map(i =>
                                      i.id === item.id ? { ...i, discount: Math.max(0, val) } : i
                                    );
                                    setServiceItems(updated);
                                  }}
                                  min={0}
                                  step="0.01"
                                  className="h-7 text-xs w-24"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Adicionar serviço */}
                    <div className="flex gap-2">
                      <Select value={currentServiceId} onValueChange={setCurrentServiceId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {services?.map((service) => (
                            <SelectItem key={service.id} value={service.id.toString()}>
                              {service.name} — R$ {parseFloat(service.price.toString()).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addServiceToList}
                        disabled={!currentServiceId}
                        className="shrink-0 gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </Button>
                    </div>
                    {serviceItems.length === 0 && (
                      <p className="text-xs text-muted-foreground">Adicione um ou mais serviços (ex: barba + cabelo + sobrancelha)</p>
                    )}
                  </div>
                )}

                {/* Produto */}
                {formData.type === "product" && (
                  <>
                    <div>
                      <Label>Produto</Label>
                      <Select value={formData.productId} onValueChange={(value) => setFormData({ ...formData, productId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productsList?.filter(p => (p.quantity || 0) > 0).map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name} — R$ {parseFloat(product.price.toString()).toFixed(2)} (Est: {product.quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantidade</Label>
                      <NumericInput
                        value={formData.productQuantity}
                        onChange={(val) => setFormData({ ...formData, productQuantity: Math.max(1, val) })}
                        min={1}
                      />
                    </div>
                  </>
                )}

                {/* Data e Hora */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={formData.appointmentDate} onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Hora</Label>
                    <Input type="time" value={formData.appointmentTime} onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })} required />
                  </div>
                </div>

                {/* Comissão do Barbeiro - só serviço, travado para barbeiro */}
                {formData.type === "service" && (
                  <div>
                    <Label className="flex items-center gap-2">
                      Comissão sobre Serviço (%)
                      {!canEditCommission && (
                        <span className="text-xs text-muted-foreground">(definido pelo dono)</span>
                      )}
                    </Label>
                    <NumericInput
                      value={formData.commissionPercentage}
                      onChange={(val) => {
                        if (!canEditCommission) return;
                        setFormData({ ...formData, commissionPercentage: Math.min(100, Math.max(0, val)) });
                      }}
                      min={0}
                      max={100}
                      disabled={!canEditCommission}
                      className={!canEditCommission ? "opacity-60 cursor-not-allowed" : ""}
                    />
                    {canEditCommission && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Preenchido automaticamente com a comissão do barbeiro. Altere se necessário.
                      </p>
                    )}
                  </div>
                )}

                {/* Desconto */}
                <div>
                  <Label>Desconto (R$)</Label>
                  <NumericInput
                    value={formData.discount}
                    onChange={(val) => setFormData({ ...formData, discount: Math.max(0, val) })}
                    min={0}
                    step="0.01"
                  />
                </div>

                {/* Gorjeta (apenas para Serviço) */}
                {formData.type === "service" && (
                  <div>
                    <Label className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-yellow-400" />
                      Gorjeta (R$)
                    </Label>
                    <NumericInput
                      value={formData.tip}
                      onChange={(val) => setFormData({ ...formData, tip: Math.max(0, val) })}
                      min={0}
                      step="0.01"
                      placeholder="Valor da gorjeta"
                    />
                  </div>
                )}

                {/* Tipo de Pagamento */}
                <div>
                  <Label>Tipo de Pagamento</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(val) =>
                      setFormData({
                        ...formData,
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
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Anotações sobre o atendimento" />
                </div>

                {/* Preview */}
                {(serviceItems.length > 0 || formData.productId) && (
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-sm">
                    {formData.type === "service" && serviceItems.map((item, idx) => (
                      <div key={item.id} className="flex justify-between text-muted-foreground">
                        <span>{idx + 1}. {item.serviceName}:</span>
                        <span>R$ {item.servicePrice.toFixed(2)}</span>
                      </div>
                    ))}
                    {formData.type === "product" && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Produto:</span>
                        <span>R$ {itemPrice.toFixed(2)}</span>
                      </div>
                    )}
                    {formData.discount > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>Desconto:</span>
                        <span>- R$ {formData.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground border-t border-border pt-1">
                      <span>Total:</span>
                      <span className="font-bold text-foreground">R$ {finalPreview.toFixed(2)}</span>
                    </div>
                    {formData.type === "service" && (
                      <div className="flex justify-between text-blue-400">
                        <span>Comissão ({formData.commissionPercentage}%):</span>
                        <span>R$ {commissionPreview.toFixed(2)}</span>
                      </div>
                    )}
                    {tipPreview > 0 && (
                      <div className="flex justify-between text-yellow-400">
                        <span>Gorjeta:</span>
                        <span>R$ {tipPreview.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-green-400 border-t border-border pt-1">
                      <span>Líquido Barbearia:</span>
                      <span>R$ {netPreview.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Registrando...</>
                  ) : (
                    "Registrar Atendimento"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-4 lg:p-6">
          {appointmentsLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : appointments && appointments.length > 0 ? (
            <div className="grid gap-3 lg:gap-4">
              {appointments.map((apt) => {
                const isProduct = apt.notes?.startsWith("[Produto]");
                const tipValue = parseFloat((apt as any).tip?.toString() || "0");
                const notesText = apt.notes?.replace(/^\[(Serviço|Produto)\]\s*/, "") || "";
                const [servicesPart, ...notesParts] = notesText.split(" - ");
                const obsText = notesParts.join(" - ");
                // Use extraItems from backend for accurate totals
                const extraItems: Array<{serviceName: string; servicePrice: string; discount: string; commissionAmount: string}> = (apt as any).extraItems || [];
                const mainServiceName = servicesPart ? servicesPart.split(" + ")[0] : "";
                // Build full service name list
                const allServiceNames = extraItems.length > 0
                  ? [mainServiceName, ...extraItems.map(i => i.serviceName)].filter(Boolean)
                  : (servicesPart ? servicesPart.split(" + ") : []);
                // Calculate totals including extra items
                const mainFinalPrice = parseFloat((apt as any).finalPrice?.toString() || apt.servicePrice.toString());
                const mainCommission = parseFloat(apt.barberCommission.toString());
                const extraTotal = extraItems.reduce((s, i) => s + parseFloat(i.servicePrice.toString()) - parseFloat(i.discount?.toString() || "0"), 0);
                const extraCommission = extraItems.reduce((s, i) => s + parseFloat(i.commissionAmount.toString()), 0);
                const totalFinalPrice = extraItems.length > 0 ? mainFinalPrice + extraTotal : mainFinalPrice;
                const totalCommission = extraItems.length > 0 ? mainCommission + extraCommission : mainCommission;
                return (
                  <Card key={apt.id} className="p-4 lg:p-6">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isProduct ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                              <Package className="w-3 h-3" /> Produto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                              <Scissors className="w-3 h-3" /> Serviço
                            </span>
                          )}
                          {allServiceNames.length > 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                              {allServiceNames.length} serviços
                            </span>
                          )}
                          {tipValue > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-300">
                              <Gift className="w-3 h-3" /> Gorjeta: R$ {tipValue.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {/* Lista de serviços */}
                        {allServiceNames.length > 0 && (
                          <div className="mt-1">
                            {allServiceNames.length === 1 ? (
                              <h3 className="text-base lg:text-lg font-bold text-foreground">{allServiceNames[0]}</h3>
                            ) : (
                              <div className="space-y-0.5">
                                {allServiceNames.map((name: string, idx: number) => (
                                  <p key={idx} className="text-sm font-medium text-foreground">
                                    {idx + 1}. {name}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 space-y-1 text-xs lg:text-sm text-muted-foreground">
                          {(apt as any).clientName && (
                          <p>Cliente: <span className="font-medium text-foreground">{(apt as any).clientName}</span></p>
                        )}
                        <p>Barbeiro: <span className="font-medium text-foreground">{getBarberName(apt.barberId)}</span></p>
                          {apt.paymentMethod && (
                            <p className="flex items-center gap-1">
                              Pagamento: <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                apt.paymentMethod === 'credit' ? 'bg-purple-500/20 text-purple-300' :
                                apt.paymentMethod === 'debit' ? 'bg-blue-500/20 text-blue-300' :
                                apt.paymentMethod === 'pix' ? 'bg-emerald-500/20 text-emerald-300' :
                                'bg-amber-500/20 text-amber-300'
                              }`}>
                                {apt.paymentMethod === 'credit' ? 'Crédito' :
                                 apt.paymentMethod === 'debit' ? 'Débito' :
                                 apt.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'}
                              </span>
                            </p>
                          )}
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(apt.appointmentDate)}
                          </p>
                          {apt.discount && parseFloat(apt.discount.toString()) > 0 && (
                            <p className="text-red-400">Desconto: R$ {parseFloat(apt.discount.toString()).toFixed(2)}</p>
                          )}
                          {obsText && (
                            <p>Obs: {obsText}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-2">
                        <p className="text-xl lg:text-2xl font-bold text-green-400">
                          R$ {totalFinalPrice.toFixed(2)}
                        </p>
                        <p className="text-xs lg:text-sm text-blue-400">
                          Comissão: R$ {totalCommission.toFixed(2)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => generatePDF(apt)}
                        >
                          <FileText className="w-3 h-3" />
                          Comprovante
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 lg:p-12 text-center">
              <Calendar className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum atendimento registrado</p>
              <Button onClick={() => setIsDialogOpen(true)}>Registrar Primeiro Atendimento</Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
