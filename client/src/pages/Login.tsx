import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Scissors, AlertCircle, ArrowLeft, Download, Smartphone } from "lucide-react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) { setIsInstalled(true); return; }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (isIOS) { setShowIOSHint(true); return; }
    if (!deferredPrompt) { setShowIOSHint(true); return; }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
    promptRef.current = null;
  };

  return { isInstalled, isIOS, showIOSHint, setShowIOSHint, install, canInstall: !!deferredPrompt || isIOS };
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const { isInstalled, isIOS, showIOSHint, setShowIOSHint, install } = useInstallPWA();

  const loginMutation = trpc.authLocal.login.useMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      localStorage.setItem("user", JSON.stringify(result));
      // Persist token activation status from backend
      if (result.hasActiveToken || result.role === "admin" || result.role === "barber") {
        localStorage.setItem("tokenActivated", "true");
      }
      toast.success("Login realizado com sucesso!");
      setLocation("/units");
    } catch (err: any) {
      setError(err.message || "Email ou senha incorretos");
      toast.error("Email ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>

        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-primary rounded-2xl shadow-lg shadow-primary/25">
            <Scissors className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2 text-center">Barbearia Control</h1>
        <p className="text-muted-foreground text-center mb-6">Faça login com seu email e senha</p>

        {/* Install App Banner */}
        {!isInstalled && (
          <div className="mb-5">
            {!showIOSHint ? (
              <button
                onClick={install}
                className="w-full flex items-center gap-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-3 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-amber-400">Instalar app no celular</p>
                  <p className="text-xs text-amber-400/60">Acesso rápido na tela inicial, funciona offline</p>
                </div>
                <Download className="w-4 h-4 text-amber-400/60 group-hover:text-amber-400 transition-colors shrink-0" />
              </button>
            ) : (
              /* iOS / manual instructions */
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-amber-400">
                    {isIOS ? "Instalar no iPhone/iPad:" : "Instalar no Android:"}
                  </p>
                  <button onClick={() => setShowIOSHint(false)} className="text-slate-500 hover:text-slate-300 text-xs">
                    Fechar
                  </button>
                </div>
                {isIOS ? (
                  <ol className="space-y-1.5">
                    <li className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      Toque em <strong className="text-white mx-1">Compartilhar ⬆️</strong> na barra do Safari
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      Toque em <strong className="text-white mx-1">"Adicionar à Tela de Início"</strong>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      Confirme tocando em <strong className="text-white mx-1">"Adicionar"</strong>
                    </li>
                  </ol>
                ) : (
                  <ol className="space-y-1.5">
                    <li className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                      Toque no menu <strong className="text-white mx-1">⋮</strong> no canto superior direito do Chrome
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                      Toque em <strong className="text-white mx-1">"Adicionar à tela inicial"</strong>
                    </li>
                    <li className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                      Confirme tocando em <strong className="text-white mx-1">"Instalar"</strong>
                    </li>
                  </ol>
                )}
              </div>
            )}
          </div>
        )}

        {/* Login Form */}
        <Card className="bg-card border border-border p-8 shadow-lg">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
            <div className="text-center pt-1">
              <Link href="/esqueci-senha" className="text-xs text-muted-foreground hover:text-amber-400 transition-colors underline-offset-2 hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-border space-y-3">
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-3">Não tem uma conta?</p>
              <Link href="/register">
                <Button variant="outline" className="w-full">
                  Criar Novo Estabelecimento
                </Button>
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
            </div>
            <Link href="/barbeiro-login">
              <Button variant="ghost" className="w-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20">
                <Scissors className="w-4 h-4 mr-2" />
                Sou barbeiro — acessar minha conta
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
