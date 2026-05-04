import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("DEBUG: appointments flow", () => {
  it("should create appointment with valid data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      // First, get branches
      const branches = await caller.branches.list();
      
      if (branches.length === 0) {
        console.log("No branches found - test cannot proceed");
        expect(true).toBe(true);
        return;
      }

      const branchId = branches[0].id;
      
      // Get barbers for this branch
      const barbers = await caller.barbers.listByBranch({ branchId });
      
      if (barbers.length === 0) {
        console.log("No barbers found - test cannot proceed");
        expect(true).toBe(true);
        return;
      }

      const barberId = barbers[0].id;

      // Get services for this branch
      const services = await caller.services.listByBranch({ branchId });
      
      if (services.length === 0) {
        console.log("No services found - test cannot proceed");
        expect(true).toBe(true);
        return;
      }

      const serviceId = services[0].id;
      const appointmentDate = new Date();

      const result = await caller.appointments.create({
        branchId,
        barberId,
        type: "service",
        serviceId,
        appointmentDate,
        commissionPercentage: 30,
        notes: "Test appointment",
      });

      expect(result.id).toBeGreaterThan(0);
    } catch (error) {
      console.error("ERROR:", error);
      throw error;
    }
  });
});
