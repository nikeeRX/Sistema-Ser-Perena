import { describe, it, expect } from "vitest";

// Unit tests for commission grouping logic (pure functions)

type ExtraItem = { serviceName: string; servicePrice: string; discount: string; commissionAmount: string };
type CommissionRow = {
  id: number;
  barberId: number;
  appointmentId: number;
  commissionAmount: string;
  commissionDate: Date;
  status: string;
  paymentMethod: string | null;
  clientName: string | null;
  notes: string | null;
  servicePrice: string | null;
  barberCommission: string | null;
  extraItems: ExtraItem[];
};

function calcTotalCommission(com: CommissionRow) {
  const mainComm = parseFloat(com.commissionAmount);
  const extraComm = com.extraItems.reduce((s, i) => s + parseFloat(i.commissionAmount), 0);
  return mainComm + extraComm;
}

function parseMainServiceName(notes: string | null) {
  if (!notes) return "Serviço";
  const text = notes.replace(/^\[(Serviço|Produto)\]\s*/, "");
  const [servicesPart] = text.split(" - ");
  return servicesPart ? servicesPart.split(" + ")[0] : "Serviço";
}

function buildServiceLines(com: CommissionRow) {
  const mainServiceName = parseMainServiceName(com.notes);
  const mainPrice = parseFloat(com.servicePrice || "0");
  const mainComm = parseFloat(com.barberCommission || com.commissionAmount);
  return [
    { name: mainServiceName, price: mainPrice, commission: mainComm, isExtra: false },
    ...com.extraItems.map((item) => ({
      name: item.serviceName,
      price: parseFloat(item.servicePrice) - parseFloat(item.discount || "0"),
      commission: parseFloat(item.commissionAmount),
      isExtra: true,
    })),
  ];
}

describe("Commission grouping logic", () => {
  const baseRow: CommissionRow = {
    id: 1,
    barberId: 1,
    appointmentId: 10,
    commissionAmount: "15.00",
    commissionDate: new Date(),
    status: "pending",
    paymentMethod: "pix",
    clientName: "João",
    notes: "[Serviço] Corte - obs",
    servicePrice: "50.00",
    barberCommission: "15.00",
    extraItems: [],
  };

  it("calculates total commission with no extra items", () => {
    expect(calcTotalCommission(baseRow)).toBeCloseTo(15, 2);
  });

  it("calculates total commission with extra items", () => {
    const row = {
      ...baseRow,
      extraItems: [
        { serviceName: "Barba", servicePrice: "30.00", discount: "0.00", commissionAmount: "9.00" },
        { serviceName: "Sobrancelha", servicePrice: "10.00", discount: "0.00", commissionAmount: "3.00" },
      ],
    };
    expect(calcTotalCommission(row)).toBeCloseTo(27, 2);
  });

  it("parses main service name from notes", () => {
    expect(parseMainServiceName("[Serviço] Corte - obs")).toBe("Corte");
    expect(parseMainServiceName("[Serviço] Corte + Barba - obs")).toBe("Corte");
    expect(parseMainServiceName(null)).toBe("Serviço");
    expect(parseMainServiceName("[Produto] Pomada")).toBe("Pomada");
  });

  it("builds service lines correctly with extras", () => {
    const row = {
      ...baseRow,
      extraItems: [
        { serviceName: "Barba", servicePrice: "30.00", discount: "5.00", commissionAmount: "7.50" },
      ],
    };
    const lines = buildServiceLines(row);
    expect(lines.length).toBe(2);
    expect(lines[0].name).toBe("Corte");
    expect(lines[0].isExtra).toBe(false);
    expect(lines[1].name).toBe("Barba");
    expect(lines[1].price).toBeCloseTo(25, 2); // 30 - 5
    expect(lines[1].isExtra).toBe(true);
  });

  it("groups commissions by barber correctly", () => {
    const rows: CommissionRow[] = [
      { ...baseRow, id: 1, barberId: 1, commissionAmount: "15.00", extraItems: [] },
      { ...baseRow, id: 2, barberId: 1, commissionAmount: "10.00", extraItems: [
        { serviceName: "Barba", servicePrice: "20.00", discount: "0.00", commissionAmount: "6.00" },
      ]},
      { ...baseRow, id: 3, barberId: 2, commissionAmount: "20.00", extraItems: [] },
    ];

    const grouped: Record<number, { total: number; count: number }> = {};
    for (const row of rows) {
      const bid = row.barberId;
      if (!grouped[bid]) grouped[bid] = { total: 0, count: 0 };
      grouped[bid].total += calcTotalCommission(row);
      grouped[bid].count++;
    }

    expect(grouped[1].total).toBeCloseTo(31, 2); // 15 + (10 + 6)
    expect(grouped[1].count).toBe(2);
    expect(grouped[2].total).toBeCloseTo(20, 2);
    expect(grouped[2].count).toBe(1);
  });
});
