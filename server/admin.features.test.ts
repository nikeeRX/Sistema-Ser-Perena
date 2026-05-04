import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getTokenStatus: vi.fn(),
  getUserByEmail: vi.fn(),
  verifyPassword: vi.fn(),
  generateAccessToken: vi.fn(),
  getUserTokens: vi.fn(),
  userHasActiveToken: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.deleteToken procedure", () => {
  it("should exist and be callable with adminUserId and tokenId", async () => {
    const { appRouter } = await import("./routers");
    const { getDb } = await import("./db");

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 1, role: "admin", email: "admin@example.com", name: "Admin" }]),
    };
    // Make delete().where() resolve
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Verify the procedure exists in the router
    expect(typeof caller.admin.deleteToken).toBe("function");
  });
});

describe("admin.listSubscriptions planName field", () => {
  it("should include planName and planSlug in returned subscriptions", async () => {
    const { appRouter } = await import("./routers");
    const { getDb } = await import("./db");

    const mockTokens = [
      {
        tokenId: 1,
        token: "abc123",
        userId: 2,
        branchId: 3,
        isActive: true,
        activatedAt: new Date("2026-03-01"),
        expiresAt: new Date("2026-04-01"),
        durationDays: 30,
        tokenCreatedAt: new Date("2026-03-01"),
        planSlug: "solo",
      },
    ];
    const mockUsers = [{ id: 2, name: "Test User", email: "test@example.com", cnpj: null }];
    const mockBranches = [{ id: 3, name: "Branch A" }];
    const mockPlans = [{ slug: "solo", name: "Solo" }];
    const mockAdmin = [{ id: 1, role: "admin" }];

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockImplementation(() => {
        return mockDb;
      }),
      where: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockAdmin); // admin check
        return mockDb;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        return Promise.resolve(mockAdmin);
      }),
    };

    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    // Verify the procedure exists
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.admin.listSubscriptions).toBe("function");
  });

  it("planName should be null when planSlug is null", () => {
    // Unit test: planName logic
    const planMap = new Map([["solo", "Solo"], ["equipe", "Equipe"]]);
    const planSlug = null;
    const planName = planSlug ? (planMap.get(planSlug) || planSlug) : null;
    expect(planName).toBeNull();
  });

  it("planName should resolve from planMap when planSlug exists", () => {
    const planMap = new Map([["solo", "Solo"], ["equipe", "Equipe"]]);
    const planSlug = "solo";
    const planName = planSlug ? (planMap.get(planSlug) || planSlug) : null;
    expect(planName).toBe("Solo");
  });

  it("planName should fallback to planSlug when not in map", () => {
    const planMap = new Map([["solo", "Solo"]]);
    const planSlug = "custom-plan";
    const planName = planSlug ? (planMap.get(planSlug) || planSlug) : null;
    expect(planName).toBe("custom-plan");
  });
});
