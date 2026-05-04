import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Scissors, Loader2, CheckCircle, ArrowRight, Building2, User, Lock, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Step = "email" | "confirm" | "password" | "login" | "success";

export default function BarberLogin() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [barbershopInfo, setBarbershopInfo] = useState<{ barberName: string; branchName: string; barberId: number; branchId: number } | null>(null);
  const [isLogin, setIsLogin] = useState(false); // true = login, false = criar conta

  const lookupMutation = trpc.barberAuth.lookupByEmail.useMutation({
    onSuccess: (data: { barberId: number; barberName: string; branchId: number; branchName: string; hasAccount: boolean }) => {
      setBarbershopInfo({ barberName: data.barberName, branchName: data.branchName, barberId: data.barberId, branchId: data.branchId });
      setIsLogin(data.hasAccount);
      setStep("confirm");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao buscar email"),
  });

  const registerMutation = trpc.barberAuth.register.useMutation({
    onSuccess: () => {
      // After registration, do login to get session
      loginMutation.mutate({ email, password });
    },
    onError: (err) => toast.error(err.message || "Erro ao criar conta"),
  });

  const loginMutation = trpc.barberAuth.login.useMutation({
    onSuccess: (data) => {
      const branchId = data.user.branchId;
      localStorage.setItem("user", JSON.stringify(data.user));
      if (branchId) localStorage.setItem("selectedBranchId", String(branchId));
      toast.success("Login realizado com sucesso!");
      setStep("success");
      setTimeout(() => {
        setLocation(`/dashboard/${branchId}/scheduling`);
      }, 1000);
    },
    onError: (err) => toast.error(err.message || "Email ou senha incorretos"),
  });

  const handleEmailLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    lookupMutation.mutate({ email });
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershopInfo) return;
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    registerMutation.mutate({
      email,
      password,
      barberId: barbershopInfo.barberId,
      branchId: barbershopInfo.branchId ?? 0,
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Scissors className="w-5 h-5 text-slate-900" />
              </div>
              <span className="font-bold text-white text-xl tracking-tight">BarberCtrl</span>
            </div>
          </Link>
          <p className="text-slate-400 text-sm mt-3">Área exclusiva para barbeiros</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 p-6 sm:p-8 shadow-2xl">

          {/* Step 1: Email */}
          {step === "email" && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Acesso do Barbeiro</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Digite o email que o dono da barbearia cadastrou para você
                </p>
              </div>
              <form onSubmit={handleEmailLookup} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-slate-300">Seu email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold gap-2"
                  disabled={lookupMutation.isPending}
                >
                  {lookupMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Buscando...</>
                  ) : (
                    <>Continuar <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </form>
              <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                <p className="text-slate-500 text-sm">
                  É dono de barbearia?{" "}
                  <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium">
                    Entrar aqui
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* Step 2: Confirm barbershop */}
          {step === "confirm" && barbershopInfo && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">
                  {isLogin ? "Bem-vindo de volta!" : "Encontramos você!"}
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  {isLogin ? "Confirme seus dados e entre com sua senha" : "Confirme os dados e crie sua senha de acesso"}
                </p>
              </div>

              {/* Barbershop info card */}
              <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{barbershopInfo.barberName}</p>
                    <p className="text-slate-400 text-xs">{email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>Barbearia: <strong className="text-white">{barbershopInfo.branchName}</strong></span>
                </div>
              </div>

              {isLogin ? (
                /* Login form */
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="password" className="text-slate-300">Sua senha</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold gap-2"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Entrando...</>
                    ) : (
                      <>Entrar <ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                  <div className="text-center pt-1">
                    <Link href="/esqueci-senha" className="text-xs text-slate-400 hover:text-amber-400 transition-colors underline-offset-2 hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                </form>
              ) : (
                /* Register form */
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div>
                    <Label htmlFor="password" className="text-slate-300">Crie uma senha</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-slate-300">Confirme a senha</Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold gap-2"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Criando conta...</>
                    ) : (
                      <>Criar minha conta <ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                </form>
              )}

              <button
                onClick={() => { setStep("email"); setPassword(""); setConfirmPassword(""); }}
                className="mt-4 text-slate-500 text-sm hover:text-slate-300 w-full text-center"
              >
                ← Usar outro email
              </button>
            </>
          )}

          {/* Step 3: Success */}
          {step === "success" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Conta criada!</h2>
              <p className="text-slate-400 text-sm">Redirecionando para sua agenda...</p>
              <Loader2 className="w-5 h-5 animate-spin text-amber-400 mx-auto mt-4" />
            </div>
          )}
        </Card>

        {/* Info box */}
        {step === "email" && (
          <div className="mt-4 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-500 text-xs text-center">
              Seu acesso é criado pelo dono da barbearia. Se seu email não for encontrado, peça para ele te cadastrar na aba <strong className="text-slate-400">Barbeiros</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
