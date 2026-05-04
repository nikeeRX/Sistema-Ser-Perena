// Stripe Products & Prices for BarberCtrl plans
// These price IDs are created dynamically on first checkout if not set.
// After creating prices in Stripe dashboard, replace the priceId values.

export interface Plan {
  id: string;
  name: string;
  subtitle: string;
  barbers: string;
  priceInCents: number; // BRL cents
  priceId: string | null; // Stripe Price ID (set after creation)
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    subtitle: "Para o barbeiro autônomo",
    barbers: "1 barbeiro",
    priceInCents: 5900, // R$ 59,00
    priceId: null, // Will be set via env or Stripe dashboard
    features: [
      "1 barbeiro cadastrado",
      "1 unidade",
      "Registro de atendimentos ilimitado",
      "Controle de comissões",
      "Relatório PDF mensal",
      "Alerta de estoque",
      "App mobile (PWA)",
      "Suporte por WhatsApp",
    ],
  },
  {
    id: "equipe",
    name: "Equipe",
    subtitle: "Para barbearias em crescimento",
    barbers: "2 a 5 barbeiros",
    priceInCents: 11900, // R$ 119,00
    priceId: null,
    features: [
      "Até 5 barbeiros cadastrados",
      "1 unidade",
      "Registro de atendimentos ilimitado",
      "Controle de comissões por barbeiro",
      "Relatório PDF por barbeiro",
      "Alerta de estoque baixo",
      "App mobile (PWA)",
      "Painel admin exclusivo",
      "Suporte prioritário por WhatsApp",
    ],
  },
  {
    id: "profissional",
    name: "Profissional",
    subtitle: "Para barbearias estabelecidas",
    barbers: "6 a 12 barbeiros",
    priceInCents: 19900, // R$ 199,00
    priceId: null,
    features: [
      "Até 12 barbeiros cadastrados",
      "Até 2 unidades",
      "Registro de atendimentos ilimitado",
      "Controle de comissões por barbeiro",
      "Relatórios PDF ilimitados",
      "Alerta de estoque baixo",
      "App mobile (PWA)",
      "Painel admin exclusivo",
      "Gestão multi-unidade",
      "Suporte prioritário por WhatsApp",
    ],
  },
];

export function getPlanById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
