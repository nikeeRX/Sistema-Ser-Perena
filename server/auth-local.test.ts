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

const email = `test-${Date.now()}@test.com`;

describe("Auth Local", () => {
  it("should register a new user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const cnpj = `${Date.now()}123456`.slice(-14);

    const result = await caller.authLocal.register({
      email,
      password: "password123",
      name: "Test User",
      cnpj,
      numUnits: 1,
    });

    expect(result).toEqual({ success: true });
  });

  it("should not register duplicate email", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const email = `duplicate-${Date.now()}@test.com`;

    const cnpj1 = `${Date.now()}111111`.slice(-14);
    const cnpj2 = `${Date.now()}222222`.slice(-14);

    await caller.authLocal.register({
      email,
      password: "password123",
      name: "First User",
      cnpj: cnpj1,
      numUnits: 1,
    });

    try {
      await caller.authLocal.register({
        email,
        password: "password123",
        name: "Second User",
        cnpj: cnpj2,
        numUnits: 1,
      });
      expect.fail("Should have thrown conflict error");
    } catch (error: any) {
      expect(error.code).toBe("CONFLICT");
    }
  });

  it("should login with valid credentials", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const email = `login-${Date.now()}@test.com`;

    const cnpj = `${Date.now()}333333`.slice(-14);

    await caller.authLocal.register({
      email,
      password: "password123",
      name: "Login Test User",
      cnpj,
      numUnits: 1,
    });

    const result = await caller.authLocal.login({
      email,
      password: "password123",
    });

    expect(result).toHaveProperty("id");
    expect(result.email).toBe(email);
    expect(result.name).toBe("Login Test User");
  });

  it("should reject invalid credentials", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const email = `invalid-${Date.now()}@test.com`;

    const cnpj = `${Date.now()}444444`.slice(-14);

    await caller.authLocal.register({
      email,
      password: "password123",
      name: "Invalid Password Test",
      cnpj,
      numUnits: 1,
    });

    try {
      await caller.authLocal.login({
        email,
        password: "wrongpassword",
      });
      expect.fail("Should have thrown unauthorized error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });

  it("should fail login with non-existent email", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.authLocal.login({
        email: `nonexistent-${Date.now()}@test.com`,
        password: "password123",
      });
      expect.fail("Should have thrown unauthorized error");
    } catch (error: any) {
      expect(error.code).toBeTruthy();
    }
  });

  it("should generate access token", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const email = `token-${Date.now()}@test.com`;

    const cnpj = `${Date.now()}555555`.slice(-14);

    await caller.authLocal.register({
      email,
      password: "password123",
      name: "Token Test User",
      cnpj,
      numUnits: 1,
    });

    const loginResult = await caller.authLocal.login({
      email,
      password: "password123",
    });

    // Use admin user (id 1 from seed) to generate token
    const tokenResult = await caller.authLocal.generateToken({
      adminUserId: 1,
      branchId: 1,
      expiresInDays: 30,
    });

    expect(tokenResult).toHaveProperty("token");
    expect(tokenResult.token).toBeTruthy();
  });

  it("should validate access token", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Use admin user (id 1 from seed) to generate token
    const tokenResult = await caller.authLocal.generateToken({
      adminUserId: 1,
      branchId: 1,
      expiresInDays: 30,
    });

    const validateResult = await caller.authLocal.validateToken({
      token: tokenResult.token,
    });

    expect(validateResult).toHaveProperty("valid");
    expect(validateResult.valid).toBe(true);
    expect(validateResult).toHaveProperty("branchId");
    expect(validateResult.branchId).toBe(1);
  });
});
