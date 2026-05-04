import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Scissors, AlertCircle, CheckCircle, Copy } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function TokenActivation() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activated, setActivated] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    branchId: number;
    expiresAt: Date;
  } | null>(null);
  const [, setLocation] = useLocation();

  const handleActivateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!token.trim()) {
      setError("Por favor, cole o token de acesso");
      setLoading(false);
      return;
    }

    try {
      // Fazer requisição direta ao backend
      const response = await fetch('/api/trpc/authLocal.validateToken?input=' + encodeURIComponent(JSON.stringify({ token: token.trim() })));
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error?.message || "Token inválido");
      }
      
      const result = data.result?.data;

      if (result.valid) {
        setTokenInfo({
          branchId: result.branchId,
          expiresAt: new Date(result.expiresAt || new Date()),
        });
        setActivated(true);
        toast.success("Token ativado com sucesso!");

        // Salvar token no localStorage
        localStorage.setItem("accessToken", token.trim());
        localStorage.setItem("tokenBranchId", result.branchId.toString());
        localStorage.setItem("tokenExpiresAt", (result.expiresAt || new Date()).toString());

        setTimeout(() => {
          setLocation(`/dashboard/${result.branchId}`);
        }, 2000);
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Token inválido ou expirado";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado para a área de transferência!");
  };

  if (activated && tokenInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Token Ativado!</h2>
          <p className="text-slate-400 mb-4">Seu acesso foi liberado com sucesso</p>

          <Card className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 mb-6">
            <div className="text-left space-y-3">
              <div>
                <p className="text-sm text-slate-400">Unidade</p>
                <p className="text-lg font-semibold text-white">#{tokenInfo.branchId}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Válido até</p>
                <p className="text-lg font-semibold text-white">
                  {new Date(tokenInfo.expiresAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </Card>

          <p className="text-slate-500 text-sm">Redirecionando para o dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
            <Scissors className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white mb-2 text-center">Ativar Acesso</h1>
        <p className="text-slate-400 text-center mb-8">Cole seu token de acesso para liberar as funcionalidades</p>

        <Card className="bg-slate-800/50 backdrop-blur border border-slate-700 p-8">
          <form onSubmit={handleActivateToken} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Token de Acesso</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Cole seu token aqui..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 flex-1"
                  required
                />
                {token && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToken}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">Você recebeu este token por email do administrador</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ativando...
                </>
              ) : (
                "Ativar Token"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                <strong>Sem token?</strong> Entre em contato com o administrador para receber seu token de acesso.
              </p>
            </div>
          </div>
        </Card>

        <p className="text-slate-500 text-sm mt-6 text-center">
          Seu acesso será liberado após ativar o token
        </p>
      </div>
    </div>
  );
}
