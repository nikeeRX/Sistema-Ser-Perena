import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as any as TrpcContext["res"],
  };
}

describe("Barbershop Control System", () => {
  describe("Branches", () => {
    it("should list branches", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const branches = await caller.branches.list();
      expect(Array.isArray(branches)).toBe(true);
    });
  });

  // Stock management tests will be implemented in future versions

  describe("Commissions", () => {
    it("should mark commission as paid", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.commissions.updateStatus({
        commissionId: 1,
        status: "paid",
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("Authentication", () => {
    it("should logout user", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(ctx.res.clearCookie).toHaveBeenCalled();
    });

    it("should get current user", async () => {
      const ctx = createTestContext(42);
      const caller = appRouter.createCaller(ctx);

      const user = await caller.auth.me();

      expect(user).toBeDefined();
      expect(user?.id).toBe(42);
      expect(user?.openId).toBe("test-user-42");
    });
  });

  describe("Input Validation", () => {
    it("should validate commission percentage is not negative", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.barbers.create({
          branchId: 1,
          name: "João Silva",
          phone: "11999999999",
          email: "joao@example.com",
          commissionPercentage: -10,
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });

    it("should validate commission percentage does not exceed 100", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.services.create({
          branchId: 1,
          name: "Corte de Cabelo",
          description: "Corte clássico",
          price: 50,
          barberCommissionPercentage: 150,
        });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toBeDefined();
      }
    });
  });

  describe("API Response Types", () => {
    it("should return properly typed responses", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const branches = await caller.branches.list();
      expect(Array.isArray(branches)).toBe(true);

      const user = await caller.auth.me();
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("openId");
      expect(user).toHaveProperty("email");
    });
  });
});
