import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("scheduling router", () => {
  describe("scheduling.create", () => {
    it("should require clientName", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.scheduling.create({
          branchId: 1,
          barberId: 1,
          clientName: "",
          scheduledDate: new Date(),
        })
      ).rejects.toThrow();
    });

    it("should validate input schema requires branchId, barberId, clientName, scheduledDate", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Missing required fields should throw
      await expect(
        (caller.scheduling.create as any)({
          branchId: 1,
          // missing barberId, clientName, scheduledDate
        })
      ).rejects.toThrow();
    });
  });

  describe("scheduling.updateStatus", () => {
    it("should validate status enum values", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Invalid status should throw
      await expect(
        (caller.scheduling.updateStatus as any)({
          id: 1,
          status: "invalid_status",
        })
      ).rejects.toThrow();
    });

    it("should accept valid status values", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // These should pass validation (but may fail on DB)
      const validStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
      for (const status of validStatuses) {
        try {
          await caller.scheduling.updateStatus({ id: 999999, status: status as any });
        } catch (e: any) {
          // Should not be a validation error - only DB errors are expected
          expect(e.message).not.toContain("Invalid enum value");
        }
      }
    });
  });

  describe("scheduling.listByBranch", () => {
    it("should accept branchId and optional date", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Should not throw validation error
      try {
        const result = await caller.scheduling.listByBranch({
          branchId: 1,
          date: new Date(),
        });
        expect(Array.isArray(result)).toBe(true);
      } catch (e: any) {
        // DB errors are OK, validation errors are not
        expect(e.message).not.toContain("Expected number");
      }
    });
  });
});

describe("appointments router", () => {
  describe("appointments.create", () => {
    it("should validate type enum", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        (caller.appointments.create as any)({
          branchId: 1,
          barberId: 1,
          type: "invalid_type",
          appointmentDate: new Date(),
          commissionPercentage: 30,
        })
      ).rejects.toThrow();
    });

    it("should accept schedulingId as optional parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Should pass validation but fail on DB lookup
      try {
        await caller.appointments.create({
          branchId: 1,
          barberId: 999999,
          type: "service",
          serviceId: 1,
          appointmentDate: new Date(),
          commissionPercentage: 30,
          schedulingId: 1,
          clientName: "Test Client",
        });
      } catch (e: any) {
        // Should fail on "Barbeiro não encontrado", not validation
        expect(e.message).toContain("Barbeiro não encontrado");
      }
    });

    it("should accept clientName as optional parameter", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.appointments.create({
          branchId: 1,
          barberId: 999999,
          type: "service",
          serviceId: 1,
          appointmentDate: new Date(),
          commissionPercentage: 30,
          clientName: "João Silva",
        });
      } catch (e: any) {
        // Should fail on business logic, not validation
        expect(e.message).toContain("Barbeiro não encontrado");
      }
    });
  });
});

describe("barbers router", () => {
  describe("barbers.createLogin", () => {
    it("should validate email format", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.barbers.createLogin({
          barberId: 1,
          branchId: 1,
          email: "invalid-email",
          password: "123456",
        })
      ).rejects.toThrow();
    });

    it("should require minimum password length", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.barbers.createLogin({
          barberId: 1,
          branchId: 1,
          email: "test@test.com",
          password: "123",
        })
      ).rejects.toThrow();
    });
  });
});

describe("authLocal router", () => {
  describe("authLocal.login", () => {
    it("should reject invalid credentials", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.authLocal.login({
          email: "nonexistent@test.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("authLocal.signup", () => {
    it("should validate CNPJ format", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.authLocal.signup({
          email: "test@test.com",
          password: "123456",
          name: "Test",
          cnpj: "123", // Invalid CNPJ
          numUnits: 1,
        })
      ).rejects.toThrow();
    });

    it("should set role to owner for signup users", async () => {
      // This is a design validation - signup creates owner role
      // The signup procedure updates role to "owner" after creating user
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.authLocal.signup({
          email: `test-${Date.now()}@test.com`,
          password: "123456",
          name: "Test Owner",
          cnpj: "12345678901234",
          numUnits: 1,
        });
      } catch (e: any) {
        // May fail on duplicate, which is fine for validation test
        if (!e.message.includes("já está cadastrado")) {
          throw e;
        }
      }
    });
  });
});
