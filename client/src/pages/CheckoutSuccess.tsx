import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Scissors, Loader2, AlertCircle, MessageCircle, ArrowRight, PartyPopper } from "lucide-react";

interface SessionData {
  status: string;
  email: string;
  planId: string;
  planName: string;
  accessToken: string | null;
}

export default function CheckoutSuccess() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  useEffect(() => {
    if (!sessionId) {
      setError("Sessão de pagamento não encontrada.");
      setLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      try {
        const res = await fetch(`/api/stripe/session/${sessionId}`);
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        setSession(data);

        if (!data.accessToken && attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError("Erro ao buscar detalhes do pagamento.");
        setLoading(false);
      }
    };

    poll();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
          <Scissors className="w-4 h-4 text-slate-900" />
        </div>
        <span className="font-bold text-white text-lg">BarberCtrl</span>
      </div>

      <div className="w-full max-w-md">
        {loading ? (
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Confirmando seu pagamento...</h2>
            <p className="text-slate-400 text-sm">Aguarde enquanto configuramos sua conta.</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Algo deu errado</h2>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <a href="https://wa.me/5561995414168" target="_blank" rel="noopener noreferrer">
              <Button className="bg-green-600 hover:bg-green-500 gap-2">
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </Button>
            </a>
          </div>
        ) : session ? (
          <div>
            {/* Success header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Pagamento confirmado!</h1>
              <p className="text-slate-400 text-sm">
                Bem-vindo ao BarberCtrl — Plano <span className="text-amber-400 font-semibold">{session.planName}</span>
              </p>
            </div>

            {/* Auto-activation info */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <PartyPopper className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <h3 className="text-emerald-300 font-bold">Conta ativada automaticamente!</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Seu acesso já está liberado. Basta fazer login com o email <span className="text-amber-400 font-medium">{session.email}</span> e a senha que você cadastrou. Seu plano de <span className="text-amber-400 font-medium">30 dias</span> já começou a contar.
              </p>
            </div>

            {/* Quick steps */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-4 font-semibold">Próximos passos</p>
              <ol className="space-y-3">
                {[
                  "Faça login com seu email e senha",
                  "Selecione sua unidade para acessar o painel",
                  "Cadastre seus barbeiros, serviços e produtos",
                  "Comece a registrar atendimentos e acompanhar comissões",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3">
              <Link href="/login">
                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold gap-2">
                  Acessar o sistema agora
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a
                href="https://wa.me/5561995414168?text=Ol%C3%A1%2C%20acabei%20de%20assinar%20o%20BarberCtrl%20e%20preciso%20de%20ajuda"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Preciso de ajuda — WhatsApp
                </Button>
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
