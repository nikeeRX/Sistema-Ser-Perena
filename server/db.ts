import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  branches,
  barbers,
  services,
  products,
  appointments,
  productSales,
  commissions,
  stockInventory,
  userBranches,
  authUsers,
  accessTokens,
  scheduling,
  Branch,
  Barber,
  Service,
  Product,
  Appointment,
  ProductSale,
  Commission,
  StockInventory,
  AuthUser,
  InsertAuthUser,
  AccessToken,
  InsertAccessToken,
  Scheduling,
  InsertScheduling,
  appointmentItems,
} from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
      email: user.email || `user-${user.openId}@local`,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      if (field === "name") {
        values[field] = normalized;
        updateSet[field] = normalized;
      } else {
        values[field] = normalized;
        updateSet[field] = normalized;
      }
    };

    textFields.forEach(assignNullable);

    if (user.email !== undefined) {
      values.email = user.email;
      updateSet.email = user.email;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (values.email && !values.email.includes("@")) {
      values.email = `${values.email}@local`;
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
      updateSet.email = values.email;
    }

    // Ensure email is always set
    if (!values.email) {
      values.email = `user-${values.openId}@local`;
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Branch queries
export async function getBranches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(branches).orderBy(asc(branches.name));
}

export async function getBranchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserBranches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ branch: branches }).from(userBranches)
    .innerJoin(branches, eq(userBranches.branchId, branches.id))
    .where(eq(userBranches.userId, userId));
}

// Barber queries
export async function getBarbersByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(barbers)
    .where(and(eq(barbers.branchId, branchId), eq(barbers.isActive, true)))
    .orderBy(asc(barbers.name));
}

export async function getBarberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(barbers).where(eq(barbers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Service queries
export async function getServicesByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services)
    .where(and(eq(services.branchId, branchId), eq(services.isActive, true)))
    .orderBy(asc(services.name));
}

export async function getServiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Product queries
export async function getProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(asc(products.name));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Stock inventory queries
export async function getStockByBranchAndProduct(branchId: number, productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockInventory)
    .where(and(eq(stockInventory.branchId, branchId), eq(stockInventory.productId, productId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getStockByBranch(branchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockInventory)
    .where(eq(stockInventory.branchId, branchId));
}

// Appointment queries
export async function getAppointmentsByBranch(branchId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(appointments)
      .where(
        and(
          eq(appointments.branchId, branchId),
          sql`DATE(${appointments.appointmentDate}) >= DATE(${startDate})`,
          sql`DATE(${appointments.appointmentDate}) <= DATE(${endDate})`
        )
      )
      .orderBy(desc(appointments.appointmentDate));
  }
  
  return db.select().from(appointments)
    .where(eq(appointments.branchId, branchId))
    .orderBy(desc(appointments.appointmentDate));
}

export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAppointment(data: {
  branchId: number;
  barberId: number;
  serviceId: number | null;
  appointmentDate: Date;
  servicePrice: string;
  discount?: number;
  finalPrice?: number;
  barberCommission: string;
  tip?: string;
  notes?: string;
  clientName?: string;
  paymentMethod?: "credit" | "debit" | "pix" | "cash";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const insertData = {
    branchId: data.branchId,
    barberId: data.barberId,
    serviceId: data.serviceId,
    appointmentDate: data.appointmentDate,
    servicePrice: data.servicePrice,
    discount: data.discount?.toString() || "0",
    finalPrice: data.finalPrice?.toString() || data.servicePrice,
    barberCommission: data.barberCommission,
    tip: data.tip || "0",
    notes: data.notes,
    clientName: data.clientName || null,
    paymentMethod: data.paymentMethod || "cash",
  };
  
  const result = await db.insert(appointments).values(insertData);
  
  // Get the inserted ID from the result
  const insertedId = (result as any).insertId || 0;
  
  // If insertId didn't work, query the database for the latest appointment
  if (insertedId === 0) {
    const latest = await db.select()
      .from(appointments)
      .where(eq(appointments.branchId, data.branchId))
      .orderBy(desc(appointments.id))
      .limit(1);
    return latest.length > 0 ? latest[0].id : 0;
  }
  
  return insertedId;
}

// Commission queries
async function enrichCommissionsWithItems(rows: Array<{
  id: number;
  branchId: number;
  barberId: number;
  appointmentId: number;
  commissionAmount: string | number;
  commissionDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  paymentMethod: string | null;
  clientName: string | null;
  notes: string | null;
  servicePrice: string | number | null;
  barberCommission: string | number | null;
}>) {
  const db = await getDb();
  if (!db || rows.length === 0) return rows.map(r => ({ ...r, extraItems: [] }));

  const appointmentIds = Array.from(new Set(rows.map(r => r.appointmentId)));
  const items = await db.select({
    appointmentId: appointmentItems.appointmentId,
    serviceName: appointmentItems.serviceName,
    servicePrice: appointmentItems.servicePrice,
    discount: appointmentItems.discount,
    commissionAmount: appointmentItems.commissionAmount,
  }).from(appointmentItems)
    .where(inArray(appointmentItems.appointmentId, appointmentIds));

  const itemsByApt = items.reduce((acc: Record<number, typeof items>, item) => {
    if (!acc[item.appointmentId]) acc[item.appointmentId] = [];
    acc[item.appointmentId].push(item);
    return acc;
  }, {});

  return rows.map(r => ({
    ...r,
    extraItems: itemsByApt[r.appointmentId] || [],
  }));
}

export async function getCommissionsByBarber(barberId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const baseSelect = db.select({
    id: commissions.id,
    branchId: commissions.branchId,
    barberId: commissions.barberId,
    appointmentId: commissions.appointmentId,
    commissionAmount: commissions.commissionAmount,
    commissionDate: commissions.commissionDate,
    status: commissions.status,
    createdAt: commissions.createdAt,
    updatedAt: commissions.updatedAt,
    paymentMethod: appointments.paymentMethod,
    clientName: appointments.clientName,
    notes: appointments.notes,
    servicePrice: appointments.servicePrice,
    barberCommission: appointments.barberCommission,
  }).from(commissions)
    .leftJoin(appointments, eq(commissions.appointmentId, appointments.id));
  
  let rows;
  if (startDate && endDate) {
    rows = await baseSelect
      .where(
        and(
          eq(commissions.barberId, barberId),
          sql`DATE(${commissions.commissionDate}) >= DATE(${startDate})`,
          sql`DATE(${commissions.commissionDate}) <= DATE(${endDate})`
        )
      )
      .orderBy(desc(commissions.commissionDate));
  } else {
    rows = await baseSelect
      .where(eq(commissions.barberId, barberId))
      .orderBy(desc(commissions.commissionDate));
  }
  return enrichCommissionsWithItems(rows);
}

export async function getCommissionsByBranch(branchId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const baseSelect = db.select({
    id: commissions.id,
    branchId: commissions.branchId,
    barberId: commissions.barberId,
    appointmentId: commissions.appointmentId,
    commissionAmount: commissions.commissionAmount,
    commissionDate: commissions.commissionDate,
    status: commissions.status,
    createdAt: commissions.createdAt,
    updatedAt: commissions.updatedAt,
    paymentMethod: appointments.paymentMethod,
    clientName: appointments.clientName,
    notes: appointments.notes,
    servicePrice: appointments.servicePrice,
    barberCommission: appointments.barberCommission,
  }).from(commissions)
    .leftJoin(appointments, eq(commissions.appointmentId, appointments.id));
  
  let rows;
  if (startDate && endDate) {
    rows = await baseSelect
      .where(
        and(
          eq(commissions.branchId, branchId),
          sql`DATE(${commissions.commissionDate}) >= DATE(${startDate})`,
          sql`DATE(${commissions.commissionDate}) <= DATE(${endDate})`
        )
      )
      .orderBy(desc(commissions.commissionDate));
  } else {
    rows = await baseSelect
      .where(eq(commissions.branchId, branchId))
      .orderBy(desc(commissions.commissionDate));
  }
  return enrichCommissionsWithItems(rows);
}

// Product sales queries
export async function getProductSalesByBranch(branchId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(productSales)
      .where(
        and(
          eq(productSales.branchId, branchId),
          sql`DATE(${productSales.createdAt}) >= DATE(${startDate})`,
          sql`DATE(${productSales.createdAt}) <= DATE(${endDate})`
        )
      )
      .orderBy(desc(productSales.createdAt));
  }
  
  return db.select().from(productSales)
    .where(eq(productSales.branchId, branchId))
    .orderBy(desc(productSales.createdAt));
}


// Auth functions
export async function createAuthUser(email: string, password: string, name: string, cnpj?: string, role: "admin" | "user" = "user") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const hashedPassword = await bcrypt.hash(password, 10);
  const openId = `local-${nanoid(16)}`;
  
  const result = await db.insert(users).values({
    openId,
    email,
    password: hashedPassword,
    name,
    cnpj: cnpj || null,
    loginMethod: "local",
    role,
  });

  // Drizzle returns [ResultSetHeader, ...] for MySQL
  const insertId = (result as any)[0]?.insertId || 0;
  return { insertId };
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function verifyPassword(password: string, hashedPassword: string | null) {
  if (!hashedPassword) return false;
  return bcrypt.compare(password, hashedPassword);
}

export async function generateAccessToken(userId: number, branchId: number, expiresInDays: number = 90) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const token = nanoid(32);

  // expiresAt is NOT set here — it will be set on first use (lazy activation)
  await db.insert(accessTokens).values({
    token,
    userId,
    branchId,
    expiresAt: null,       // null = not yet activated
    activatedAt: null,     // null = never used
    durationDays: expiresInDays,
    isActive: true,
  });

  return token;
}

export async function validateAccessToken(token: string, activatingUserId?: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(accessTokens)
    .where(
      and(
        eq(accessTokens.token, token),
        eq(accessTokens.isActive, true)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  const accessToken = result[0];

  // Lazy activation: if first use, set activatedAt, calculate expiresAt, and bind to user
  if (!accessToken.activatedAt) {
    const now = new Date();
    const durationDays = accessToken.durationDays ?? 90;
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const updateData: any = { activatedAt: now, expiresAt };
    // Bind token to the user who activated it (not the admin who created it)
    if (activatingUserId) {
      updateData.userId = activatingUserId;
    }

    await db.update(accessTokens)
      .set(updateData)
      .where(eq(accessTokens.id, accessToken.id));

    // Also create user_branches relationship so user can see the branch
    const finalUserId = activatingUserId || accessToken.userId;
    try {
      // Check if relationship already exists
      const existing = await db.select().from(userBranches)
        .where(and(
          eq(userBranches.userId, finalUserId),
          eq(userBranches.branchId, accessToken.branchId)
        ))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(userBranches).values({
          userId: finalUserId,
          branchId: accessToken.branchId,
        });
        console.log(`[Token] Created user_branches: user ${finalUserId} -> branch ${accessToken.branchId}`);
      }
    } catch (err) {
      console.warn(`[Token] Could not create user_branches:`, err);
    }

    accessToken.activatedAt = now;
    accessToken.expiresAt = expiresAt;
    if (activatingUserId) accessToken.userId = activatingUserId;
    console.log(`[Token] Activated token ${accessToken.id} for user ${finalUserId} — expires in ${durationDays} days (${expiresAt.toISOString()})`);
  }

  // Check if token is expired (only after activation)
  if (accessToken.expiresAt && new Date() > accessToken.expiresAt) {
    console.log(`[Token] Token ${accessToken.id} expired at ${accessToken.expiresAt.toISOString()}`);
    return null;
  }

  return accessToken;
}

export async function userHasActiveToken(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select().from(accessTokens)
    .where(
      and(
        eq(accessTokens.userId, userId),
        eq(accessTokens.isActive, true)
      )
    )
    .limit(1);

  if (result.length === 0) return false;

  const token = result[0];
  // If not activated yet, it's still valid (pending first use)
  if (!token.activatedAt) return true;
  // If activated, check expiry
  if (token.expiresAt && new Date() > token.expiresAt) return false;
  return true;
}

export async function getTokenStatus(userId: number): Promise<{
  hasToken: boolean;
  hasActiveToken: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  expiresAt: Date | null;
  activatedAt: Date | null;
}> {
  const db = await getDb();
  if (!db) return { hasToken: false, hasActiveToken: false, isExpired: false, daysRemaining: null, expiresAt: null, activatedAt: null };

  const result = await db.select().from(accessTokens)
    .where(
      and(
        eq(accessTokens.userId, userId),
        eq(accessTokens.isActive, true)
      )
    )
    .orderBy(desc(accessTokens.createdAt))
    .limit(1);

  if (result.length === 0) return { hasToken: false, hasActiveToken: false, isExpired: false, daysRemaining: null, expiresAt: null, activatedAt: null };

  const token = result[0];

  // Not yet activated (pending first use or auto-activated)
  if (!token.activatedAt) {
    return { hasToken: true, hasActiveToken: true, isExpired: false, daysRemaining: token.durationDays ?? 30, expiresAt: null, activatedAt: null };
  }

  // Activated — check expiry
  const now = new Date();
  if (token.expiresAt && now > token.expiresAt) {
    return { hasToken: true, hasActiveToken: false, isExpired: true, daysRemaining: 0, expiresAt: token.expiresAt, activatedAt: token.activatedAt };
  }

  // Active and not expired
  const daysRemaining = token.expiresAt ? Math.ceil((token.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  return { hasToken: true, hasActiveToken: true, isExpired: false, daysRemaining, expiresAt: token.expiresAt, activatedAt: token.activatedAt };
}

export async function getUserTokens(userId: number, branchId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(accessTokens)
    .where(
      and(
        eq(accessTokens.userId, userId),
        eq(accessTokens.branchId, branchId)
      )
    )
    .orderBy(desc(accessTokens.createdAt));
}

export async function deactivateToken(tokenId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(accessTokens)
    .set({ isActive: false })
    .where(eq(accessTokens.id, tokenId));
}


// ── Scheduling (Agenda) ──

export async function getSchedulingByBranch(branchId: number, date?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (date) {
    return db.select().from(scheduling)
      .where(
        and(
          eq(scheduling.branchId, branchId),
          sql`DATE(${scheduling.scheduledDate}) = DATE(${date})`
        )
      )
      .orderBy(asc(scheduling.scheduledDate));
  }
  
  return db.select().from(scheduling)
    .where(eq(scheduling.branchId, branchId))
    .orderBy(desc(scheduling.scheduledDate));
}

export async function getSchedulingByBarber(barberId: number, date?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (date) {
    return db.select().from(scheduling)
      .where(
        and(
          eq(scheduling.barberId, barberId),
          sql`DATE(${scheduling.scheduledDate}) = DATE(${date})`
        )
      )
      .orderBy(asc(scheduling.scheduledDate));
  }
  
  return db.select().from(scheduling)
    .where(eq(scheduling.barberId, barberId))
    .orderBy(desc(scheduling.scheduledDate));
}

export async function createScheduling(data: {
  branchId: number;
  barberId: number;
  clientName: string;
  clientPhone?: string;
  scheduledDate: Date;
  scheduledEndDate?: Date;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(scheduling).values({
    branchId: data.branchId,
    barberId: data.barberId,
    clientName: data.clientName,
    clientPhone: data.clientPhone || null,
    scheduledDate: data.scheduledDate,
    scheduledEndDate: data.scheduledEndDate || null,
    status: "scheduled",
    notes: data.notes || null,
  });
  
  const insertedId = (result as any).insertId || (result as any)[0]?.insertId || 0;
  return insertedId;
}

export async function updateSchedulingStatus(id: number, status: "scheduled" | "in_progress" | "completed" | "cancelled", appointmentId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { status };
  if (appointmentId) updateData.appointmentId = appointmentId;
  
  await db.update(scheduling).set(updateData).where(eq(scheduling.id, id));
}

export async function getSchedulingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scheduling).where(eq(scheduling.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Barber Login Management ──

export async function createBarberUser(email: string, password: string, name: string, barberId: number, branchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const hashedPassword = await bcrypt.hash(password, 10);
  const openId = `local-${nanoid(16)}`;
  
  const result = await db.insert(users).values({
    openId,
    email,
    password: hashedPassword,
    name,
    loginMethod: "local",
    role: "barber",
    barberId,
  });

  const insertId = (result as any)[0]?.insertId || (result as any).insertId || 0;
  
  // Create user_branches relationship
  if (insertId) {
    await db.insert(userBranches).values({
      userId: insertId,
      branchId,
      role: "operator",
    });
  }
  
  return { insertId };
}
