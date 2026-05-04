import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Scissors, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [userType, setUserType] = useState<"owner" | "barber">("owner");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  // Extract token and type from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const type = params.get("type") as "owner" | "barber" | null;
    if (t) setToken(t);
    if (type === "owner" || type === "barber") setUserType(type);
  }, []);

  const validateToken = trpc.passwordReset.validateToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const resetPassword = trpc.passwordReset.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => {
        setLocation(userType === "barber" ? "/barbeiro-login" : "/login");
      }, 3000);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao redefinir senha");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    resetPassword.mutate({ token, newPassword });
  };

  const isTokenValid = validateToken.data?.valid;
  const isLoading = validateToken.isLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="bg-amber-500 p-2 rounded-lg">
              <Scissors className="h-6 w-6 text-gray-950" />
            </div>
            <span className="text-2xl font-bold text-white">BarberCtrl</span>
          </div>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-xl">
              {done ? "Senha Redefinida!" : "Redefinir Senha"}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {done ? "Você será redirecionado para o login em instantes." : "Digite sua nova senha abaixo."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Verificando link...</div>
            ) : done ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <p className="text-gray-300 text-sm">
                  Sua senha foi redefinida com sucesso. Redirecionando para o login...
                </p>
              </div>
            ) : !isTokenValid ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <XCircle className="h-16 w-16 text-red-500" />
                </div>
                <p className="text-gray-300 text-sm">
                  Este link é inválido ou já expirou. Solicite um novo link de redefinição.
                </p>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold"
                  onClick={() => setLocation("/esqueci-senha")}
                >
                  Solicitar novo link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-gray-300">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-300">Confirmar nova senha</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-red-400 text-xs">As senhas não coincidem</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold"
                  disabled={resetPassword.isPending || newPassword !== confirmPassword}
                >
                  {resetPassword.isPending ? "Redefinindo..." : "Redefinir senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
