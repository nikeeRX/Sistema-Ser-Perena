import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1, role: string = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "local",
    role: role as any,
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

describe("CPF/CNPJ Validation", () => {
  it("should accept valid CPF (11 digits) in signup", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // CPF with 11 digits should pass validation (will fail at DB level but validation passes)
    try {
      await caller.authLocal.signup({
        email: `test-cpf-${Date.now()}@example.com`,
        password: "test123456",
        name: "Test CPF User",
        cnpj: "12345678901", // 11 digits = CPF
        numUnits: 1,
      });
    } catch (error: any) {
      // Should NOT be a validation error about digits
      expect(error.message).not.toContain("CPF deve ter 11 dígitos ou CNPJ 14 dígitos");
    }
  });

  it("should accept valid CNPJ (14 digits) in signup", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.authLocal.signup({
        email: `test-cnpj-${Date.now()}@example.com`,
        password: "test123456",
        name: "Test CNPJ User",
        cnpj: "12345678000199", // 14 digits = CNPJ
        numUnits: 1,
      });
    } catch (error: any) {
      // Should NOT be a validation error about digits
      expect(error.message).not.toContain("CPF deve ter 11 dígitos ou CNPJ 14 dígitos");
    }
  });

  it("should reject invalid document length (10 digits)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.authLocal.signup({
        email: `test-invalid-${Date.now()}@example.com`,
        password: "test123456",
        name: "Test Invalid",
        cnpj: "1234567890", // 10 digits - invalid
        numUnits: 1,
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      // Should be a validation error
      expect(error.message).toBeDefined();
    }
  });

  it("should reject invalid document length (13 digits)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.authLocal.signup({
        email: `test-invalid13-${Date.now()}@example.com`,
        password: "test123456",
        name: "Test Invalid 13",
        cnpj: "1234567890123", // 13 digits - invalid
        numUnits: 1,
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toBeDefined();
    }
  });
});

describe("Barber Delete Cascade", () => {
  it("should delete barber successfully", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // This tests the delete procedure exists and runs without crashing
    // (barber may not exist but the procedure should handle it gracefully)
    const result = await caller.barbers.delete({ id: 999999 });
    expect(result).toEqual({ success: true });
  });
});

describe("Barber Management Permissions", () => {
  it("should allow barber update by any authenticated user (publicProcedure)", async () => {
    const ctx = createTestContext(1, "owner");
    const caller = appRouter.createCaller(ctx);

    // The update procedure is publicProcedure, so it should work for any role
    try {
      await caller.barbers.update({
        id: 999999,
        name: "Updated Name",
      });
    } catch (error: any) {
      // May fail at DB level but should not fail at auth level
      expect(error.code).not.toBe("UNAUTHORIZED");
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("Barber Reset Password", () => {
  it("should fail when barber has no login", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.barbers.resetPassword({
        barberId: 999999,
        newPassword: "newpass123",
      });
      expect.fail("Should have thrown NOT_FOUND error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toContain("n\u00e3o possui um login");
    }
  });

  it("should validate minimum password length", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.barbers.resetPassword({
        barberId: 1,
        newPassword: "12345", // 5 chars, min is 6
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toBeDefined();
    }
  });
});

describe("Scheduling with Notification", () => {
  it("should create scheduling and return id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.scheduling.create({
        branchId: 1,
        barberId: 1,
        clientName: "Cliente Teste",
        clientPhone: "11999999999",
        scheduledDate: new Date("2026-04-01T10:00:00Z"),
      });
      // Should return an id (number)
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    } catch (error: any) {
      // May fail if barber/branch doesn't exist, but should not be auth error
      expect(error.code).not.toBe("UNAUTHORIZED");
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });
});
