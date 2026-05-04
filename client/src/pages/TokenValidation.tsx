import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Scissors, AlertCircle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function TokenValidation() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [, setLocation] = useLocation();

  const validateTokenMutation = trpc.authLocal.validateToken.useQuery(
    { token },
    { enabled: false }
  );

  const handleValidateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const result = await validateTokenMutation.refetch();
      if (result.data) {
        // Armazenar token no localStorage
        localStorage.setItem("accessToken", token);
        localStorage.setItem("branchId", String(result.data.branchId));
        setSuccess(true);
        toast.success("Token validado com sucesso!");
        setTimeout(() => {
          setLocation("/units");
        }, 1500);
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Token inválido ou expirado";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
            <Scissors className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Barbearia Control</h1>
        <p className="text-slate-400 text-center mb-8">Valide seu token de acesso</p>

        {/* Token Card */}
        <Card className="bg-slate-800/50 backdrop-blur border border-slate-700 p-8">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Token Validado!</h2>
              <p className="text-slate-400">Redirecionando...</p>
            </div>
          ) : (
            <form onSubmit={handleValidateToken} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Token Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Token de Acesso</label>
                <Input
                  type="text"
                  placeholder="Cole seu token aqui..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={loading}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 font-mono text-sm"
                  required
                />
              </div>

              {/* Validate Button */}
              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Validar Token"
                )}
              </Button>
            </form>
          )}

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-slate-400 text-xs text-center">
              Se você não tem um token, solicite ao administrador da sua unidade
            </p>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-slate-500 text-sm mt-6 text-center">
          Sistema seguro de controle de produção para barbearias
        </p>
      </div>
    </div>
  );
}
