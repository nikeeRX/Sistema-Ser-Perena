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
import { Loader2, Plus, Edit2, Trash2, Package } from "lucide-react";
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

export default function Products() {
  const [match, params] = useRoute("/dashboard/:branchId/products");
  const [, setLocation] = useLocation();
  const branchId = params?.branchId ? parseInt(params.branchId) : null;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", price: 0, commissionPercentage: 10, quantity: 0,
  });

  const { data: branch } = trpc.branches.getById.useQuery(
    { id: branchId! },
    { enabled: !!branchId }
  );

  const { data: productsList, isLoading, refetch } = trpc.products.listByBranch.useQuery(
    { branchId: branchId! },
    { enabled: !!branchId }
  );

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Produto criado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao criar produto"),
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!");
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao atualizar produto"),
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Produto excluído com sucesso!");
      refetch();
    },
    onError: (error) => toast.error(error.message || "Erro ao excluir produto"),
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", price: 0, commissionPercentage: 10, quantity: 0 });
    setEditingProduct(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;
    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        name: formData.name,
        description: formData.description,
        price: formData.price.toString(),
        commissionPercentage: formData.commissionPercentage.toString(),
        quantity: formData.quantity,
      });
    } else {
      createMutation.mutate({
        branchId,
        name: formData.name,
        description: formData.description,
        price: formData.price.toString(),
        commissionPercentage: formData.commissionPercentage.toString(),
        quantity: formData.quantity,
      });
    }
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: parseFloat(product.price.toString()),
      commissionPercentage: parseFloat((product.commissionPercentage || "10").toString()),
      quantity: product.quantity || 0,
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
            <h1 className="text-xl lg:text-3xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground text-sm mt-1">{branch?.name}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm">
                <Plus className="w-4 h-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Produto</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Pomada Premium" required />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição do produto" />
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
                    <Label htmlFor="quantity">Quantidade em Estoque</Label>
                    <NumericInput
                      id="quantity"
                      value={formData.quantity}
                      onChange={(val) => setFormData({ ...formData, quantity: Math.max(0, Math.round(val)) })}
                      min={0}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="commission">Comissão do Barbeiro (%)</Label>
                  <NumericInput
                    id="commission"
                    value={formData.commissionPercentage}
                    onChange={(val) => setFormData({ ...formData, commissionPercentage: Math.min(100, Math.max(0, val)) })}
                    min={0}
                    max={100}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />{editingProduct ? "Salvando..." : "Criando..."}</>
                  ) : (
                    editingProduct ? "Salvar Alterações" : "Criar Produto"
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
          ) : productsList && productsList.length > 0 ? (
            <div className="grid gap-3 lg:gap-4">
              {productsList.map((product) => {
                const isLowStock = (product.quantity || 0) < 5;
                return (
                <Card key={product.id} className={`p-4 lg:p-6 ${isLowStock ? 'border-yellow-500/40' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base lg:text-lg font-bold text-foreground">{product.name}</h3>
                        {isLowStock && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Estoque baixo</span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-muted-foreground text-sm mt-1">{product.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 lg:gap-4 mt-3 text-xs lg:text-sm text-muted-foreground">
                        <span>Preço: R$ {parseFloat(product.price.toString()).toFixed(2)}</span>
                        <span>Comissão: {product.commissionPercentage}%</span>
                        <span className={`font-medium ${(product.quantity || 0) > 0 ? (isLowStock ? 'text-yellow-400' : 'text-green-500') : 'text-red-500'}`}>
                          <Package className="w-3 h-3 inline mr-1" />
                          Estoque: {product.quantity || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        if (confirm("Tem certeza que deseja excluir este produto?")) {
                          deleteMutation.mutate({ id: product.id });
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 lg:p-12 text-center">
              <Package className="w-10 h-10 lg:w-12 lg:h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum produto cadastrado</p>
              <Button onClick={() => setIsDialogOpen(true)}>Cadastrar Primeiro Produto</Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
