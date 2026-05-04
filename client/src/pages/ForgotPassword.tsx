import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Scissors, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"owner" | "barber">("owner");
  const [sent, setSent] = useState(false);

  const requestReset = trpc.passwordReset.requestReset.useMutation({
    onSuccess: () => {
      setSent(true);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar solicitação");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    requestReset.mutate({
      email,
      userType,
      origin: window.location.origin,
    });
  };

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
              {sent ? "Solicitação Enviada!" : "Esqueci minha senha"}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {sent
                ? "Verifique as notificações do sistema para obter o link de redefinição."
                : "Informe seu e-mail para receber o link de redefinição de senha."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <p className="text-gray-300 text-sm">
                  Se o e-mail <strong className="text-white">{email}</strong> estiver cadastrado, você receberá o link de redefinição nas notificações do sistema em instantes.
                </p>
                <p className="text-gray-500 text-xs">
                  O link é válido por 1 hora.
                </p>
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold"
                  onClick={() => setLocation(userType === "barber" ? "/barbeiro-login" : "/login")}
                >
                  Voltar ao Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de usuário */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Tipo de conta</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUserType("owner")}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        userType === "owner"
                          ? "bg-amber-500 text-gray-950 border-amber-500"
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      Dono / Gerente
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType("barber")}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        userType === "barber"
                          ? "bg-amber-500 text-gray-950 border-amber-500"
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600"
                      }`}
                    >
                      Barbeiro
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold"
                  disabled={requestReset.isPending}
                >
                  {requestReset.isPending ? "Enviando..." : "Enviar link de redefinição"}
                </Button>

                <div className="text-center">
                  <Link
                    href={userType === "barber" ? "/barbeiro-login" : "/login"}
                    className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-amber-400 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar ao login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
