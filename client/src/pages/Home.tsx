import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Scissors, BarChart3, Users, Package, FileText,
  Smartphone, CheckCircle2, Star, ChevronDown, Menu, X,
  TrendingUp, Shield, Zap, Clock, ArrowRight, MessageCircle,
  Loader2, Tag, Gift, Copy
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Static Data ────────────────────────────────────────────────────────────

const features = [
  {
    icon: BarChart3,
    title: "Dashboard em tempo real",
    desc: "Veja o faturamento, comissões e atendimentos do dia em uma tela só. Sem planilha, sem papel.",
  },
  {
    icon: Users,
    title: "Gestão de barbeiros",
    desc: "Cadastre barbeiros, defina percentuais de comissão e acompanhe a produção individual.",
  },
  {
    icon: TrendingUp,
    title: "Comissões automáticas",
    desc: "O sistema calcula comissões, gorjetas e descontos automaticamente a cada atendimento.",
  },
  {
    icon: Package,
    title: "Controle de estoque",
    desc: "Gerencie produtos, receba alertas de estoque baixo e registre vendas avulsas.",
  },
  {
    icon: FileText,
    title: "Relatórios em PDF",
    desc: "Gere relatórios por período, por barbeiro ou por unidade com um clique.",
  },
  {
    icon: Smartphone,
    title: "App mobile (PWA)",
    desc: "Instale direto no celular sem precisar de loja. Funciona no Android e no iPhone.",
  },
  {
    icon: Shield,
    title: "Login específico para Barbeiros",
    desc: "Cada barbeiro acessa seu login após o dono da barbearia realizar seu cadastro em sua unidade. Sendo possível o controle de sua agenda e comissões",
  },
  {
    icon: Zap,
    title: "Multi-unidade",
    desc: "Gerencie várias unidades da sua barbearia sem trocar de conta.",
  },
];

const testimonials = [
  {
    name: "Rodrigo Mendes",
    role: "Dono — Barbearia Clássica, SP",
    text: "Antes eu controlava tudo em caderno e planilha. Hoje em 5 minutos sei exatamente quanto cada barbeiro produziu no mês.",
    stars: 5,
  },
  {
    name: "Felipe Costa",
    role: "Dono — BarberKing, RJ",
    text: "O relatório por barbeiro foi o que me vendeu. Agora no fechamento do mês é só gerar o PDF e mostrar pra cada um.",
    stars: 5,
  },
  {
    name: "Thiago Alves",
    role: "Dono — Studio Barber, MG",
    text: "Instalei no celular como app e uso direto do caixa. Simples, rápido e não trava. Recomendo demais.",
    stars: 5,
  },
];

const faqs = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. O sistema roda direto no navegador. No celular, você pode instalar como app (PWA) com um toque — sem precisar de Play Store ou App Store.",
  },
  {
    q: "Posso testar antes de pagar?",
    a: "Sim. Utilize o cupom TESTEGRATIS e tenha 7 dias de experiência gratuitamente.",
  },
  {
    q: "E se eu precisar de mais barbeiros depois?",
    a: "É só fazer upgrade de plano. Seus dados são mantidos e a migração é imediata.",
  },
  {
    q: "Funciona para mais de uma unidade?",
    a: "Sim. A partir do plano Profissional você gerencia até 2 unidades. No plano Rede, unidades ilimitadas.",
  },
  {
    q: "Como é o suporte?",
    a: "Suporte por WhatsApp em todos os planos. Nos planos Equipe e acima o atendimento é prioritário.",
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-950/95 backdrop-blur border-b border-slate-800 shadow-xl" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Scissors className="w-4 h-4 text-slate-900" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">BarberCtrl</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className="text-slate-400 hover:text-white text-sm transition-colors">Funcionalidades</a>
          <a href="#planos" className="text-slate-400 hover:text-white text-sm transition-colors">Planos</a>
          <a href="#faq" className="text-slate-400 hover:text-white text-sm transition-colors">FAQ</a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/barbeiro-login">
            <Button variant="ghost" size="sm" className="text-amber-400/70 hover:text-amber-400 text-xs">Sou barbeiro</Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">Entrar</Button>
          </Link>
          <Link href="/plans">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              Começar grátis
            </Button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-slate-950 border-t border-slate-800 px-4 py-4 space-y-3">
          <a href="#funcionalidades" className="block text-slate-400 hover:text-white text-sm py-2" onClick={() => setOpen(false)}>Funcionalidades</a>
          <a href="#planos" className="block text-slate-400 hover:text-white text-sm py-2" onClick={() => setOpen(false)}>Planos</a>
          <a href="#faq" className="block text-slate-400 hover:text-white text-sm py-2" onClick={() => setOpen(false)}>FAQ</a>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login"><Button variant="outline" className="w-full" size="sm">Entrar (Dono/Admin)</Button></Link>
            <Link href="/barbeiro-login"><Button variant="ghost" className="w-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10" size="sm">Sou barbeiro — acessar minha conta</Button></Link>
            <Link href="/plans"><Button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold" size="sm">Começar grátis</Button></Link>
          </div>
        </div>
      )}
    </header>
  );
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <div key={i} className="border border-slate-800 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left text-white hover:bg-slate-800/50 transition-colors"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span className="font-medium text-sm">{faq.q}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
          </button>
          {openIdx === i && (
            <div className="px-5 pb-4 text-slate-400 text-sm leading-relaxed">{faq.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // If already logged in, redirect to units
  useEffect(() => {
    const localUser = localStorage.getItem("user");
    if (localUser) {
      window.location.href = "/units";
    }
  }, []);

  // Fetch plans dynamically from database
  const { data: plansData, isLoading: plansLoading } = trpc.plans.list.useQuery();

  const handleCheckout = (planSlug: string, priceInCents: number) => {
    if (priceInCents === 0) {
      window.open("https://wa.me/5561995414168", "_blank");
      return;
    }
    window.location.href = `/register?plan=${planSlug}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/8 rounded-full blur-3xl" />
          <div className="absolute top-20 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">Sistema de gestão para barbearias</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Controle sua barbearia<br />
            <span className="text-amber-400">do celular, em segundos</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Registre atendimentos, calcule comissões, controle estoque e gere relatórios em PDF.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/plans">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 gap-2 text-base">
                Assinar agora
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#planos">
              <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 px-8 text-base">
                Ver planos e preços
              </Button>
            </a>
          </div>

          {/* Cupom TESTEGRATIS */}
          <div className="inline-flex items-center gap-2 mt-5 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2">
            <Gift className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-amber-300 text-sm">
              Utilize o cupom{" "}
              <button
                onClick={() => { navigator.clipboard.writeText("TESTEGRATIS"); }}
                className="font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded cursor-pointer hover:bg-amber-500/30 transition-colors inline-flex items-center gap-1"
                title="Copiar cupom"
              >
                TESTEGRATIS <Copy className="w-3 h-3" />
              </button>{" "}
              e tenha 7 dias de experiência gratuitamente
            </span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-3xl mx-auto mt-16 grid grid-cols-3 gap-px bg-slate-800 rounded-2xl overflow-hidden border border-slate-800">
          {[
            { value: "100%", label: "Sem papel ou planilha" },
            { value: "7 dias", label: "Grátis para testar" },
            { value: "2 min", label: "Para começar a usar" },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900 px-6 py-5 text-center">
              <p className="text-2xl font-bold text-amber-400">{s.value}</p>
              <p className="text-slate-400 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funcionalidades" className="py-24 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Tudo que sua barbearia precisa</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto">Desenvolvido especificamente para barbearias, completo e de fácil acesso.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/30 hover:bg-slate-800/50 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                  <f.icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm">{f.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANS (Dynamic from DB) ── */}
      <section id="planos" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">Planos e preços</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Escolha pelo tamanho da sua equipe</h2>
            <p className="text-slate-400 mt-3 max-w-xl mx-auto">Pague só pelo que você precisa. Upgrade ou downgrade a qualquer momento.</p>
            {/* Cupom banner na seção de planos */}
            <div className="inline-flex items-center gap-2 mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3">
              <Tag className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-300 text-sm">
                Utilize o cupom{" "}
                <button
                  onClick={() => { navigator.clipboard.writeText("TESTEGRATIS"); }}
                  className="font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded cursor-pointer hover:bg-amber-500/30 transition-colors inline-flex items-center gap-1"
                  title="Copiar cupom"
                >
                  TESTEGRATIS <Copy className="w-3 h-3" />
                </button>{" "}
                e tenha 7 dias de experiência gratuitamente
              </span>
            </div>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {(plansData || []).map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                  plan.isHighlighted
                    ? "bg-amber-500/5 border-amber-500/50 shadow-xl shadow-amber-500/10 scale-[1.02]"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
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
                  onClick={() => handleCheckout(plan.slug, plan.priceInCents)}
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
                      Assinar agora
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


        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-4 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">Depoimentos</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Donos de barbearia que já usam</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">"{t.text}"</p>
                <div className="mt-5">
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3">Dúvidas frequentes</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Perguntas e respostas</h2>
          </div>
          <FAQ />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Comece hoje, sem risco</h2>
          <p className="text-slate-400 text-lg mb-4">
            Use o cupom <span className="text-amber-400 font-bold">TESTEGRATIS</span> e tenha 7 dias de experiência gratuitamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/plans">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-10 gap-2 text-base">
                Criar minha conta grátis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="https://wa.me/5561995414168" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2 text-base">
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-slate-900" />
            </div>
            <span className="font-bold text-white">BarberCtrl</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 BarberCtrl · Sistema de gestão para barbearias</p>
          <div className="flex gap-5">
            <Link href="/login"><span className="text-slate-500 hover:text-white text-sm transition-colors cursor-pointer">Entrar</span></Link>
            <Link href="/barbeiro-login"><span className="text-amber-500/60 hover:text-amber-400 text-sm transition-colors cursor-pointer">Acesso Barbeiro</span></Link>
            <Link href="/plans"><span className="text-slate-500 hover:text-white text-sm transition-colors cursor-pointer">Cadastrar</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
