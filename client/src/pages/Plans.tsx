import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  Scissors, Users, CheckCircle2, ArrowLeft, ArrowRight,
  MessageCircle, Zap, Star, Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Plans() {
  const [, setLocation] = useLocation();
  const { data: plansData, isLoading: plansLoading } = trpc.plans.list.useQuery();

  const handleSelectPlan = (planSlug: string, priceInCents: number) => {
    if (priceInCents === 0) {
      window.open("https://wa.me/5561995414168", "_blank");
      return;
    }
    setLocation(`/register?plan=${planSlug}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Scissors className="w-4 h-4 text-slate-900" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">BarberCtrl</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">7 dias grátis em todos os planos</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Escolha o plano ideal para sua barbearia
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Selecione o plano que melhor se encaixa no tamanho da sua equipe.
          </p>
        </div>

        {/* Plans grid */}
        {plansLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start mb-10">
          {(plansData || []).map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                plan.isHighlighted
                  ? "bg-amber-500/5 border-amber-500/50 shadow-xl shadow-amber-500/10 scale-[1.02]"
                  : "bg-slate-900 border-slate-800 hover:border-slate-600"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${
                  plan.isHighlighted ? "bg-amber-500 text-slate-900" : "bg-slate-700 text-slate-300"
                }`}>
                  {plan.badge}
                </div>
              )}

              {/* Header */}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-slate-400 text-xs mt-0.5">{plan.subtitle}</p>
                <div className="inline-flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1 mt-3">
                  <Users className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold">{plan.barbers}</span>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                {plan.priceInCents > 0 ? (
                  <>
                    {plan.originalPriceInCents && (
                      <p className="text-slate-500 text-sm line-through mb-0.5">R$ {(plan.originalPriceInCents / 100).toFixed(0)}/mês</p>
                    )}
                    <div className="flex items-end gap-1">
                      <span className="text-slate-400 text-sm">R$</span>
                      <span className="text-4xl font-extrabold text-white">{(plan.priceInCents / 100).toFixed(0)}</span>
                      <span className="text-slate-400 text-sm mb-1">/mês</span>
                    </div>
                    {plan.originalPriceInCents && (
                      <p className="text-emerald-400 text-xs mt-1 font-medium">
                        Economia de R$ {((plan.originalPriceInCents - plan.priceInCents) / 100).toFixed(0)}/mês
                      </p>
                    )}

                  </>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-extrabold text-white">Sob consulta</span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <Button
                onClick={() => handleSelectPlan(plan.slug, plan.priceInCents)}
                className={`w-full mb-6 font-semibold gap-2 ${
                  plan.isHighlighted
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
                    : "border-slate-700 text-white hover:bg-slate-800"
                }`}
                variant={plan.isHighlighted ? "default" : "outline"}
              >
                {plan.priceInCents === 0 ? (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    Falar com especialista
                  </>
                ) : (
                  <>
                    Escolher este plano
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {(Array.isArray(plan.features) ? plan.features : []).map((feat: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.isHighlighted ? "text-amber-400" : "text-emerald-400"}`} />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        )}

        {/* Trust signals */}
        <div className="text-center space-y-4">

          <div className="flex items-center justify-center gap-6 text-slate-500 text-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Cancele quando quiser
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Sem fidelidade
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              Suporte por WhatsApp
            </span>
          </div>
          <p className="text-slate-600 text-xs">
            Já tem uma conta?{" "}
            <Link href="/login">
              <span className="text-amber-400 hover:text-amber-300 cursor-pointer">Faça login aqui</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
