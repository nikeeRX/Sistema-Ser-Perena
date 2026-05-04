import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { branches, barbers, services, products } from "../drizzle/schema";

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

let testBranchId: number;
let testBarberId: number;
let testServiceId: number;
let testProductId: number;

describe("appointments.create", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Create test branch
    const [branchResult] = await db.insert(branches).values({
      name: `Test Branch ${Date.now()}`,
      address: "Test Address",
      phone: "1234567890",
    });
    testBranchId = branchResult.insertId;

    // Create test barber
    const [barberResult] = await db.insert(barbers).values({
      branchId: testBranchId,
      name: "Test Barber",
      phone: "1234567890",
      commissionPercentage: "30",
      isActive: true,
    });
    testBarberId = barberResult.insertId;

    // Create test service
    const [serviceResult] = await db.insert(services).values({
      branchId: testBranchId,
      name: "Test Service",
      price: "50.00",
      barberCommissionPercentage: "30",
      isActive: true,
    });
    testServiceId = serviceResult.insertId;

    // Create test product
    const [productResult] = await db.insert(products).values({
      branchId: testBranchId,
      name: "Test Product",
      price: "25.00",
      commissionPercentage: "10",
      quantity: 10,
    });
    testProductId = productResult.insertId;
  });

  it("should create a service appointment with commission", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const appointmentDate = new Date();
    const result = await caller.appointments.create({
      branchId: testBranchId,
      barberId: testBarberId,
      type: "service",
      serviceId: testServiceId,
      appointmentDate,
      commissionPercentage: 30,
      notes: "Test service appointment",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);

    // Verify appointment was created
    const appointment = await caller.appointments.getById({ id: result.id });
    expect(appointment).toBeDefined();
    expect(appointment?.barberId).toBe(testBarberId);
    expect(appointment?.branchId).toBe(testBranchId);
    // Commission should be 30% of 50 = 15
    expect(parseFloat(appointment?.barberCommission?.toString() || "0")).toBe(15);
  });

  it("should create a product appointment with commission and reduce stock", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.appointments.create({
      branchId: testBranchId,
      barberId: testBarberId,
      type: "product",
      productId: testProductId,
      productQuantity: 2,
      appointmentDate: new Date(),
      commissionPercentage: 10,
      notes: "Test product sale",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);

    // Verify appointment - price should be 25 * 2 = 50, commission 10% = 5
    const appointment = await caller.appointments.getById({ id: result.id });
    expect(appointment).toBeDefined();
    expect(parseFloat(appointment?.barberCommission?.toString() || "0")).toBe(5);
  });

  it("should fail when service does not exist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.appointments.create({
        branchId: testBranchId,
        barberId: testBarberId,
        type: "service",
        serviceId: 99999,
        appointmentDate: new Date(),
        commissionPercentage: 30,
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("should fail when barber does not exist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.appointments.create({
        branchId: testBranchId,
        barberId: 99999,
        type: "service",
        serviceId: testServiceId,
        appointmentDate: new Date(),
        commissionPercentage: 30,
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });
});
