import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Scissors, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function formatCPF(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) =>
    d ? `${a}.${b}.${c}-${d}` : `${a}.${b}.${c}`
  );
}

function formatCNPJ(digits: string): string {
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) =>
    e ? `${a}.${b}.${c}/${d}-${e}` : `${a}.${b}.${c}/${d}`
  );
}

function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length === 0) return "";
  if (digits.length <= 11) return formatCPF(digits);
  return formatCNPJ(digits);
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[9]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return parseInt(digits[10]) === check;
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(digits[12]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(digits[13]) === check;
}

function validateDocument(value: string): { valid: boolean; type: "cpf" | "cnpj" | null; error: string } {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return { valid: false, type: null, error: "CPF ou CNPJ é obrigatório" };
  if (digits.length <= 11) {
    if (digits.length < 11) return { valid: false, type: "cpf", error: "CPF incompleto. Digite 11 dígitos" };
    if (!validateCPF(digits)) return { valid: false, type: "cpf", error: "CPF inválido" };
    return { valid: true, type: "cpf", error: "" };
  }
  if (digits.length < 14) return { valid: false, type: "cnpj", error: "CNPJ incompleto. Digite 14 dígitos" };
  if (!validateCNPJ(digits)) return { valid: false, type: "cnpj", error: "CNPJ inválido" };
  return { valid: true, type: "cnpj", error: "" };
}

export default function Register() {
  const [formData, setFormData] = useState({
    email: "",
    document: "",
    password: "",
    confirmPassword: "",
    name: "",
    numUnits: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [, setLocation] = useLocation();

  // Read selected plan from URL query param
  const selectedPlan = useMemo(() => new URLSearchParams(window.location.search).get("plan") || "equipe", []);

  // Fetch plans dynamically from database
  const { data: plansData } = trpc.plans.list.useQuery();

  // Build dynamic plan labels from DB data
  const planLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (plansData) {
      for (const plan of plansData) {
        if (plan.priceInCents > 0) {
          labels[plan.slug] = `${plan.name} — R$ ${(plan.priceInCents / 100).toFixed(0)}/mês`;
        } else {
          labels[plan.slug] = `${plan.name} — Sob consulta`;
        }
      }
    }
    return labels;
  }, [plansData]);

  const signupMutation = trpc.authLocal.signup.useMutation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.email) { setError("Email é obrigatório"); setLoading(false); return; }

    const docValidation = validateDocument(formData.document);
    if (!docValidation.valid) { setError(docValidation.error); setLoading(false); return; }

    if (formData.password.length < 6) { setError("Senha deve ter pelo menos 6 caracteres"); setLoading(false); return; }
    if (formData.password !== formData.confirmPassword) { setError("As senhas não conferem"); setLoading(false); return; }

    const cleanDigits = formData.document.replace(/\D/g, "");

    try {
      await signupMutation.mutateAsync({
        email: formData.email,
        cnpj: cleanDigits,
        password: formData.password,
        name: formData.name || "Estabelecimento",
        numUnits: formData.numUnits,
      });
      setSuccess(true);
      toast.success("Cadastro realizado! Redirecionando para o pagamento...");

      // After signup, go to Stripe checkout for the selected plan
      if (selectedPlan && selectedPlan !== "rede") {
        setCheckoutLoading(true);
        try {
          const res = await fetch("/api/stripe/create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId: selectedPlan,
              email: formData.email,
              name: formData.name || "Estabelecimento",
              origin: window.location.origin,
            }),
          });
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        } catch {
          // Checkout failed, just redirect to login
        } finally {
          setCheckoutLoading(false);
        }
      }
      setTimeout(() => setLocation("/login"), 3000);
    } catch (err: any) {
      const errorMessage = err?.message || "Erro ao registrar";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Cadastro Realizado!</h2>
          {checkoutLoading ? (
            <>
              <div className="flex items-center justify-center gap-2 text-amber-400 mb-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Abrindo checkout do plano {planLabels[selectedPlan] || selectedPlan}...</span>
              </div>
              <p className="text-slate-400 text-sm">Uma nova aba será aberta para o pagamento.</p>
            </>
          ) : (
            <p className="text-slate-400 mb-6">Redirecionando para login...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/8 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link href="/plans">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Escolher outro plano
          </Button>
        </Link>

        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/25">
            <Scissors className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2 text-center">Barbearia Control</h1>
        <p className="text-muted-foreground text-center mb-8">Crie sua conta de estabelecimento</p>

        {/* Selected plan indicator */}
        {selectedPlan && planLabels[selectedPlan] && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Plano selecionado</p>
              <p className="text-white font-bold">{planLabels[selectedPlan]}</p>
            </div>
            <Link href="/plans">
              <button className="text-amber-400 hover:text-amber-300 text-xs underline">Trocar</button>
            </Link>
          </div>
        )}

        <Card className="bg-card border border-border p-8 shadow-lg">
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Email do Estabelecimento</label>
              <Input type="email" placeholder="seu@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={loading} required />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">CPF ou CNPJ</label>
              <Input
                type="text"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={formData.document}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
                  setFormData({ ...formData, document: raw.length > 0 ? formatDocument(raw) : "" });
                }}
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                {formData.document.replace(/\D/g, "").length <= 11
                  ? "Digite seu CPF (11 dígitos) ou CNPJ (14 dígitos)"
                  : "CNPJ detectado"}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Nome do Estabelecimento</label>
              <Input type="text" placeholder="Barbearia XYZ" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={loading} />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Quantas Unidades/Filiais você tem?</label>
              <select
                value={formData.numUnits}
                onChange={(e) => setFormData({ ...formData, numUnits: parseInt(e.target.value) })}
                disabled={loading}
                className="w-full px-4 py-2 bg-card border border-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? "Unidade" : "Unidades"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Senha</label>
              <Input type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} disabled={loading} required />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Confirmar Senha</label>
              <Input type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} disabled={loading} required />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold mt-6">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando Conta...
                </>
              ) : (
                `Criar conta e ir para pagamento`
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-muted-foreground text-sm">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
                Faça login
              </Link>
            </p>
          </div>
        </Card>

        <p className="text-muted-foreground/60 text-sm mt-6 text-center">
          Sistema seguro de controle de produção para barbearias
        </p>
      </div>
    </div>
  );
}
