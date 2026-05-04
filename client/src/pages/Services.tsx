import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import DashboardNav from "@/components/DashboardNav";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Edit2, Trash2, Scissors } from "lucide-react";
import { toast } from "sonner";

function NumericInput({ value, onChange, min, max, step, placeholder, id, required, ...props }: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  id?: string;
  required?: boolean;
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
      id={id}
      required={required}
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

export default function Services() {
  const [match, params] = useRoute("/dashboard/:branchId/services");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", price: 0, barberCommissionPercentage: 30,
  });

  const { data: branch } = trpc.branches.getById.useQuery(
    { id: branchId! },
    { enabled: !!branchId }
  );

  const { data: servicesList, isLoading, refetch } = trpc.services.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const createMutation = trpc.services.create.useMutation({
    onSuccess: () => {
      toast.success("Serviço criado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao criar serviço"),
  });

  const updateMutation = trpc.services.update.useMutation({
    onSuccess: () => {
      toast.success("Serviço atualizado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar serviço"),
  });

  const deleteMutation = trpc.services.delete.useMutation({
    onSuccess: () => {
      toast.success("Serviço excluído com sucesso!");
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao excluir serviço"),
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", price: 0, barberCommissionPercentage: 30 });
    setEditingService(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    if (editingService) {
      updateMutation.mutate({
        id: editingService.id,
        name: formData.name,
        description: formData.description,
        price: formData.price.toString(),
        barberCommissionPercentage: formData.barberCommissionPercentage.toString(),
      });
    } else {
      createMutation.mutate({
        branchId,
        name: formData.name,
        description: formData.description,
        price: formData.price.toString(),
        barberCommissionPercentage: formData.barberCommissionPercentage.toString(),
      });
    }
  };

  const openEdit = (service: any) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price: parseFloat(service.price.toString()),
      barberCommissionPercentage: parseFloat(service.barberCommissionPercentage.toString()),
    });
    setIsDialogOpen(true);
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
            <h1 className="text-xl lg:text-3xl font-bold text-foreground">Serviços</h1>
            <p className="text-muted-foreground text-sm mt-1">{branch?.name}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm">
                <Plus className="w-4 h-4" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Serviço</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Corte de Cabelo" required />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição do serviço" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Preço (R$)</Label>
                    <NumericInput
                      id="price"
                      value={formData.price}
                      onChange={(val) => setFormData({ ...formData, price: val })}
                      min={0}
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="commission">Comissão do Barbeiro (%)</Label>
                    <NumericInput
                      id="commission"
                      value={formData.barberCommissionPercentage}
                      onChange={(val) => setFormData({ ...formData, barberCommissionPercentage: Math.min(100, Math.max(0, val)) })}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />{editingService ? "Salvando..." : "Criando..."}</>
                  ) : (
                    editingService ? "Salvar Alterações" : "Criar Serviço"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-4 lg:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : servicesList && servicesList.length > 0 ? (
            <div className="grid gap-3 lg:gap-4">
              {servicesList.map((service) => (
                <Card key={service.id} className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base lg:text-lg font-bold text-foreground">{service.name}</h3>
                      {service.description && (
                        <p className="text-muted-foreground text-sm mt-1">{service.description}</p>
                      )}
                      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                        <span>Preço: R$ {parseFloat(service.price.toString()).toFixed(2)}</span>
                        <span>Comissão: {service.barberCommissionPercentage}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        if (confirm("Tem certeza que deseja excluir este serviço?")) {
                          deleteMutation.mutate({ id: service.id });
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 lg:p-12 text-center">
              <Scissors className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum serviço cadastrado</p>
              <Button onClick={() => setIsDialogOpen(true)}>Cadastrar Primeiro Serviço</Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
