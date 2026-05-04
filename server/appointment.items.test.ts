import { describe, it, expect } from "vitest";

// Unit tests for appointment items grouping logic (pure functions)

describe("Appointment items grouping logic", () => {
  // Simulate the totals calculation logic from Appointments.tsx
  function calcTotals(
    mainFinalPrice: number,
    mainCommission: number,
    extraItems: Array<{ servicePrice: string; discount: string; commissionAmount: string }>
  ) {
    const extraTotal = extraItems.reduce(
      (s, i) => s + parseFloat(i.servicePrice) - parseFloat(i.discount || "0"),
      0
    );
    const extraCommission = extraItems.reduce(
      (s, i) => s + parseFloat(i.commissionAmount),
      0
    );
    const totalFinalPrice =
      extraItems.length > 0 ? mainFinalPrice + extraTotal : mainFinalPrice;
    const totalCommission =
      extraItems.length > 0 ? mainCommission + extraCommission : mainCommission;
    return { totalFinalPrice, totalCommission };
  }

  it("returns main price/commission when no extra items", () => {
    const result = calcTotals(50, 15, []);
    expect(result.totalFinalPrice).toBe(50);
    expect(result.totalCommission).toBe(15);
  });

  it("sums extra items price correctly", () => {
    const extraItems = [
      { servicePrice: "30.00", discount: "0.00", commissionAmount: "9.00" },
      { servicePrice: "20.00", discount: "5.00", commissionAmount: "4.50" },
    ];
    const result = calcTotals(50, 15, extraItems);
    // extra total = 30 + (20 - 5) = 45
    expect(result.totalFinalPrice).toBeCloseTo(50 + 45, 2);
    // extra commission = 9 + 4.5 = 13.5
    expect(result.totalCommission).toBeCloseTo(15 + 13.5, 2);
  });

  it("handles discount on extra items", () => {
    const extraItems = [
      { servicePrice: "40.00", discount: "10.00", commissionAmount: "9.00" },
    ];
    const result = calcTotals(60, 18, extraItems);
    // extra total = 40 - 10 = 30
    expect(result.totalFinalPrice).toBeCloseTo(90, 2);
    expect(result.totalCommission).toBeCloseTo(27, 2);
  });

  it("builds allServiceNames from extraItems correctly", () => {
    const mainServiceName = "Corte";
    const extraItems = [
      { serviceName: "Barba", servicePrice: "20", discount: "0", commissionAmount: "6" },
      { serviceName: "Sobrancelha", servicePrice: "10", discount: "0", commissionAmount: "3" },
    ];
    const allServiceNames =
      extraItems.length > 0
        ? [mainServiceName, ...extraItems.map((i) => i.serviceName)].filter(Boolean)
        : [mainServiceName];
    expect(allServiceNames).toEqual(["Corte", "Barba", "Sobrancelha"]);
    expect(allServiceNames.length).toBe(3);
  });

  it("falls back to notes parsing when no extraItems", () => {
    const servicesPart = "Corte + Barba";
    const extraItems: any[] = [];
    const allServiceNames =
      extraItems.length > 0
        ? [servicesPart.split(" + ")[0], ...extraItems.map((i: any) => i.serviceName)]
        : servicesPart.split(" + ");
    expect(allServiceNames).toEqual(["Corte", "Barba"]);
  });
});
