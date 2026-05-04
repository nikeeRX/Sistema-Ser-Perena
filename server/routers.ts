import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getBranches,
  getBranchById,
  getUserBranches,
  getBarbersByBranch,
  getBarberById,
  getServicesByBranch,
  getServiceById,
  getProducts,
  getProductById,
  getStockByBranch,
  getStockByBranchAndProduct,
  getAppointmentsByBranch,
  getAppointmentById,
  getCommissionsByBarber,
  getCommissionsByBranch,
  getProductSalesByBranch,
  getDb,
  createAppointment,
  createAuthUser,
  getUserByEmail,
  verifyPassword,
  generateAccessToken,
  validateAccessToken,
  getUserTokens,
  deactivateToken,
  userHasActiveToken,
  getTokenStatus,
  getSchedulingByBranch,
  getSchedulingByBarber,
  createScheduling,
  updateSchedulingStatus,
  getSchedulingById,
  createBarberUser,
} from "./db";
import {
  users,
  branches,
  barbers,
  services,
  products,
  stockInventory,
  appointments,
  productSales,
  commissions,
  userBranches,
  accessTokens,
  authUsers,
  scheduling,
  plans,
  passwordResetTokens,
  appointmentItems,
} from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Branch routes
  branches: router({
    list: publicProcedure.query(() => getBranches()),
    getByUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const result = await db.select({
          id: branches.id,
          name: branches.name,
          email: branches.email,
          phone: branches.phone,
          address: branches.address,
        }).from(userBranches)
          .innerJoin(branches, eq(userBranches.branchId, branches.id))
          .where(eq(userBranches.userId, input.userId));
        return result;
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getBranchById(input.id)),
  }),

  // Barber routes
  barbers: router({
    listByBranch: publicProcedure
      .input(z.object({ branchId: z.number() }))
      .query(({ input }) => getBarbersByBranch(input.branchId)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getBarberById(input.id)),
    create: publicProcedure
      .input(z.object({
        branchId: z.number(),
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        commissionPercentage: z.string().default("30"),
        origin: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await db.insert(barbers).values({
          branchId: input.branchId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          commissionPercentage: input.commissionPercentage.toString(),
        });
        const newId = (result as any).insertId || (result as any)[0]?.insertId || 0;

        // Notify owner about new barber registration with login link
        if (input.email) {
          const origin = input.origin || "https://barbershopsmart.com";
          const loginLink = `${origin}/barbeiro-login`;
          const [branch] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, input.branchId));
          await notifyOwner({
            title: `Novo barbeiro cadastrado: ${input.name}`,
            content: `O barbeiro **${input.name}** foi cadastrado na unidade **${branch?.name || "sua barbearia"}** com o email **${input.email}**.\n\nEnvie o link abaixo para ele criar seu acesso:\n\n🔗 ${loginLink}\n\nAo acessar o link, ele deve digitar o email **${input.email}** para encontrar a barbearia e criar sua senha.`,
          }).catch(() => {}); // fire-and-forget
        }

        return { id: newId };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        commissionPercentage: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.commissionPercentage !== undefined) updateData.commissionPercentage = data.commissionPercentage;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        await db.update(barbers).set(updateData).where(eq(barbers.id, id));
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Cascade: delete the user login linked to this barber
        const linkedUsers = await db.select({ id: users.id }).from(users).where(eq(users.barberId, input.id));
        for (const u of linkedUsers) {
          await db.delete(userBranches).where(eq(userBranches.userId, u.id));
          await db.delete(users).where(eq(users.id, u.id));
        }

        await db.delete(barbers).where(eq(barbers.id, input.id));
        return { success: true };
      }),
    // Create a login for a barber
    createLogin: publicProcedure
      .input(z.object({
        barberId: z.number(),
        branchId: z.number(),
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        
        // Check if email already exists
        const existing = await getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este email já está em uso" });
        
        // Get barber info
        const barber = await getBarberById(input.barberId);
        if (!barber) throw new TRPCError({ code: "NOT_FOUND", message: "Barbeiro não encontrado" });
        
        // Check if barber already has a login
        const existingBarberUser = await db.select().from(users).where(eq(users.barberId, input.barberId)).limit(1);
        if (existingBarberUser.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Este barbeiro já possui um login" });
        }
        
        const result = await createBarberUser(input.email, input.password, barber.name, input.barberId, input.branchId);
        return { success: true, userId: result.insertId };
      }),
    // Get login info for a barber
    getLogin: publicProcedure
      .input(z.object({ barberId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select({
          id: users.id,
          email: users.email,
          name: users.name,
        }).from(users).where(eq(users.barberId, input.barberId)).limit(1);
        return result.length > 0 ? result[0] : null;
      }),
    // Reset barber password (owner/admin only)
    resetPassword: publicProcedure
      .input(z.object({
        barberId: z.number(),
        newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Find the user linked to this barber
        const linkedUser = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.barberId, input.barberId)).limit(1);
        if (linkedUser.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Este barbeiro ainda não possui um login. Ele precisa criar o login primeiro em /barbeiro-login" });
        }

        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, linkedUser[0].id));
        return { success: true };
      }),
    // Check barber limit for a branch based on active plan
    checkLimit: publicProcedure
      .input(z.object({ branchId: z.number(), userId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { canAdd: true, current: 0, max: 999, planName: null };

        // Count active barbers in branch
        const barberCount = await db.select({ count: sql<number>`count(*)` })
          .from(barbers).where(eq(barbers.branchId, input.branchId));
        const current = Number(barberCount[0]?.count || 0);

        // Get active token with planSlug for this user
        const tokenRows = await db.select({ planSlug: accessTokens.planSlug })
          .from(accessTokens)
          .where(and(eq(accessTokens.userId, input.userId), eq(accessTokens.isActive, true)))
          .limit(1);
        const planSlug = tokenRows[0]?.planSlug;

        if (!planSlug) return { canAdd: true, current, max: 999, planName: null };

        // Get plan maxBarbers from plans table
        const planRows = await db.select({ maxBarbers: plans.maxBarbers, name: plans.name })
          .from(plans).where(eq(plans.slug, planSlug)).limit(1);
        const plan = planRows[0];
        if (!plan) return { canAdd: true, current, max: 999, planName: null };

        return {
          canAdd: current < plan.maxBarbers,
          current,
          max: plan.maxBarbers,
          planName: plan.name,
        };
      }),
  }),

  // Service routes
  services: router({
    listByBranch: publicProcedure
      .input(z.object({ branchId: z.number() }))
      .query(({ input }) => getServicesByBranch(input.branchId)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getServiceById(input.id)),
    create: publicProcedure
      .input(z.object({
        branchId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        price: z.string(),
        barberCommissionPercentage: z.string().default("30"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await db.insert(services).values({
          branchId: input.branchId,
          name: input.name,
          description: input.description,
          price: input.price.toString(),
          barberCommissionPercentage: input.barberCommissionPercentage.toString(),
        });
        return { id: (result as any).insertId || (result as any)[0]?.insertId || 0 };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        barberCommissionPercentage: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.price !== undefined) updateData.price = data.price;
        if (data.barberCommissionPercentage !== undefined) updateData.barberCommissionPercentage = data.barberCommissionPercentage;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        await db.update(services).set(updateData).where(eq(services.id, id));
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(services).where(eq(services.id, input.id));
        return { success: true };
      }),
  }),

  // Product routes
  products: router({
    list: publicProcedure.query(() => getProducts()),
    listByBranch: publicProcedure
      .input(z.object({ branchId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(products).where(eq(products.branchId, input.branchId));
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProductById(input.id)),
    create: publicProcedure
      .input(z.object({
        branchId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        price: z.string(),
        commissionPercentage: z.string().default("10"),
        quantity: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await db.insert(products).values({
          branchId: input.branchId,
          name: input.name,
          description: input.description,
          price: input.price.toString(),
          commissionPercentage: input.commissionPercentage.toString(),
          quantity: input.quantity,
        });
        return { id: (result as any).insertId || (result as any)[0]?.insertId || 0 };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        commissionPercentage: z.string().optional(),
        quantity: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.price !== undefined) updateData.price = data.price;
        if (data.commissionPercentage !== undefined) updateData.commissionPercentage = data.commissionPercentage;
        if (data.quantity !== undefined) updateData.quantity = data.quantity;
        await db.update(products).set(updateData).where(eq(products.id, id));
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(products).where(eq(products.id, input.id));
        return { success: true };
      }),
  }),

  // Stock inventory routes
  stockInventory: router({
    getByBranch: publicProcedure
      .input(z.object({ branchId: z.number() }))
      .query(({ input }) => getStockByBranch(input.branchId)),
    getByBranchAndProduct: publicProcedure
      .input(z.object({ branchId: z.number(), productId: z.number() }))
      .query(({ input }) => getStockByBranchAndProduct(input.branchId, input.productId)),
  }),

  // Scheduling (Agenda) routes
  scheduling: router({
    listByBranch: publicProcedure
      .input(z.object({
        branchId: z.number(),
        date: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const items = await getSchedulingByBranch(input.branchId, input.date);
        // Enrich with barber names
        const db = await getDb();
        if (!db) return items;
        const barberIds = Array.from(new Set(items.map(i => i.barberId)));
        if (barberIds.length === 0) return items;
        const barbersList = await db.select({ id: barbers.id, name: barbers.name }).from(barbers);
        const barberMap = new Map(barbersList.map(b => [b.id, b.name]));
        return items.map(item => ({
          ...item,
          barberName: barberMap.get(item.barberId) || "Desconhecido",
        }));
      }),
    listByBarber: publicProcedure
      .input(z.object({
        barberId: z.number(),
        date: z.date().optional(),
      }))
      .query(({ input }) => getSchedulingByBarber(input.barberId, input.date)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getSchedulingById(input.id)),
    create: publicProcedure
      .input(z.object({
        branchId: z.number(),
        barberId: z.number(),
        clientName: z.string().min(1, "Nome do cliente é obrigatório"),
        clientPhone: z.string().optional(),
        scheduledDate: z.date(),
        scheduledEndDate: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createScheduling({
          branchId: input.branchId,
          barberId: input.barberId,
          clientName: input.clientName,
          clientPhone: input.clientPhone,
          scheduledDate: input.scheduledDate,
          scheduledEndDate: input.scheduledEndDate,
          notes: input.notes,
        });

        // Notify owner about new scheduling
        try {
          const barber = await getBarberById(input.barberId);
          const db = await getDb();
          let branchName = "";
          if (db) {
            const branchResult = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, input.branchId)).limit(1);
            branchName = branchResult[0]?.name || "";
          }
          const dateStr = new Date(input.scheduledDate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
          await notifyOwner({
            title: `Novo agendamento - ${branchName}`,
            content: `Cliente: ${input.clientName}\nBarbeiro: ${barber?.name || "N/A"}\nData: ${dateStr}${input.notes ? `\nObs: ${input.notes}` : ""}`,
          });
        } catch (e) {
          // Non-blocking: don't fail the scheduling if notification fails
          console.error("[Notification] Failed to notify owner:", e);
        }

        return { id };
      }),
    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
        appointmentId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateSchedulingStatus(input.id, input.status, input.appointmentId);
        return { success: true };
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        barberId: z.number().optional(),
        clientName: z.string().optional(),
        clientPhone: z.string().optional(),
        scheduledDate: z.date().optional(),
        scheduledEndDate: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        const updateData: any = {};
        if (data.barberId !== undefined) updateData.barberId = data.barberId;
        if (data.clientName !== undefined) updateData.clientName = data.clientName;
        if (data.clientPhone !== undefined) updateData.clientPhone = data.clientPhone;
        if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate;
        if (data.scheduledEndDate !== undefined) updateData.scheduledEndDate = data.scheduledEndDate;
        if (data.notes !== undefined) updateData.notes = data.notes;
        await db.update(scheduling).set(updateData).where(eq(scheduling.id, id));
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(scheduling).where(eq(scheduling.id, input.id));
        return { success: true };
      }),
  }),

  // Appointment routes
  appointments: router({
    listByBranch: publicProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const appts = await getAppointmentsByBranch(input.branchId, input.startDate, input.endDate);
        if (!appts.length) return appts.map(a => ({ ...a, extraItems: [] }));
        const db = await getDb();
        if (!db) return appts.map(a => ({ ...a, extraItems: [] }));
        const apptIds = appts.map(a => a.id);
        // Fetch all appointment_items for these appointments in one query
        const allItems = await db.select({
          id: appointmentItems.id,
          appointmentId: appointmentItems.appointmentId,
          serviceName: appointmentItems.serviceName,
          servicePrice: appointmentItems.servicePrice,
          discount: appointmentItems.discount,
          commissionPercentage: appointmentItems.commissionPercentage,
          commissionAmount: appointmentItems.commissionAmount,
        }).from(appointmentItems)
          .where(sql`${appointmentItems.appointmentId} IN (${sql.join(apptIds.map(id => sql`${id}`), sql`, `)})`);
        // Group items by appointmentId
        const itemsByAppt = new Map<number, typeof allItems>();
        for (const item of allItems) {
          if (!itemsByAppt.has(item.appointmentId)) itemsByAppt.set(item.appointmentId, []);
          itemsByAppt.get(item.appointmentId)!.push(item);
        }
        return appts.map(a => ({ ...a, extraItems: itemsByAppt.get(a.id) || [] }));
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getAppointmentById(input.id)),
    create: publicProcedure
      .input(z.object({
        branchId: z.number(),
        barberId: z.number(),
        type: z.enum(["service", "product"]),
        serviceId: z.number().optional(),
        productId: z.number().optional(),
        productQuantity: z.number().min(1).optional(),
        appointmentDate: z.date(),
        clientName: z.string().optional(),
        discount: z.number().default(0),
        tip: z.number().default(0),
        commissionPercentage: z.number().min(0).max(100),
        notes: z.string().optional(),
        schedulingId: z.number().optional(), // Link to scheduling entry
        paymentMethod: z.enum(["credit", "debit", "pix", "cash"]).default("cash"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const barber = await getBarberById(input.barberId);
        if (!barber) throw new TRPCError({ code: "NOT_FOUND", message: "Barbeiro não encontrado" });

        let itemPrice = 0;
        let itemName = "";

        if (input.type === "service") {
          if (!input.serviceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um serviço" });
          const service = await getServiceById(input.serviceId);
          if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Serviço não encontrado" });
          itemPrice = parseFloat(service.price.toString());
          itemName = service.name;
        } else {
          if (!input.productId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um produto" });
          const product = await getProductById(input.productId);
          if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
          const qty = input.productQuantity || 1;
          if (product.quantity < qty) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}` });
          }
          itemPrice = parseFloat(product.price.toString()) * qty;
          itemName = product.name;
        }

        const finalPrice = itemPrice - input.discount;
        const tipAmount = input.type === "service" ? input.tip : 0;
        const commissionAmount = (finalPrice * input.commissionPercentage) / 100;

        const appointmentId = await createAppointment({
          branchId: input.branchId,
          barberId: input.barberId,
          serviceId: input.type === "service" ? input.serviceId! : null,
          appointmentDate: input.appointmentDate,
          servicePrice: itemPrice.toString(),
          discount: input.discount,
          finalPrice: finalPrice,
          barberCommission: commissionAmount.toString(),
          tip: tipAmount.toString(),
          notes: input.notes ? `[${input.type === "service" ? "Serviço" : "Produto"}] ${itemName} - ${input.notes}` : `[${input.type === "service" ? "Serviço" : "Produto"}] ${itemName}`,
          clientName: input.clientName,
          paymentMethod: input.paymentMethod,
        });

        if (appointmentId === 0) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar atendimento" });
        }

        // Create commission record
        await db.insert(commissions).values({
          branchId: input.branchId,
          barberId: input.barberId,
          appointmentId: appointmentId,
          commissionAmount: commissionAmount.toString(),
          commissionDate: input.appointmentDate,
          status: "pending",
        });

        // If product, create product sale and update stock
        if (input.type === "product" && input.productId) {
          const qty = input.productQuantity || 1;
          const product = await getProductById(input.productId);
          if (product) {
            await db.insert(productSales).values({
              appointmentId,
              branchId: input.branchId,
              productId: input.productId,
              quantity: qty,
              unitPrice: product.price.toString(),
              totalPrice: itemPrice.toString(),
            });
            await db.update(products).set({ quantity: product.quantity - qty }).where(eq(products.id, input.productId));
          }
        }

        // If linked to a scheduling entry, mark it as completed
        if (input.schedulingId) {
          await updateSchedulingStatus(input.schedulingId, "completed", appointmentId);
        }

        return { id: appointmentId };
      }),
  }),

  // Product sales routes
  productSales: router({
    listByBranch: publicProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(({ input }) =>
        getProductSalesByBranch(input.branchId, input.startDate, input.endDate)
      ),
  }),

  // Commission routes
  commissions: router({
    getByBarber: publicProcedure
      .input(z.object({
        barberId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(({ input }) =>
        getCommissionsByBarber(input.barberId, input.startDate, input.endDate)
      ),
    getByBranch: publicProcedure
      .input(z.object({
        branchId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(({ input }) =>
        getCommissionsByBranch(input.branchId, input.startDate, input.endDate)
      ),
    updateStatus: publicProcedure
      .input(z.object({
        commissionId: z.number(),
        status: z.enum(["pending", "paid"]),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(commissions)
          .set({ status: input.status })
          .where(eq(commissions.id, input.commissionId));
        return { success: true };
      }),
  }),

  // Authentication routes
  authLocal: router({
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string(),
        cnpj: z.string().regex(/^\d{11}$|^\d{14}$/, "CPF deve ter 11 dígitos ou CNPJ 14 dígitos"),
      }))
      .mutation(async ({ input }) => {
        const existingUser = await getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        }
        await createAuthUser(input.email, input.password, input.name, input.cnpj, "user");
        return { success: true };
      }),

    signup: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string(),
        cnpj: z.string().regex(/^\d{11}$|^\d{14}$/, "CPF deve ter 11 dígitos ou CNPJ 14 dígitos"),
        numUnits: z.number().min(1).max(10),
      }))
      .mutation(async ({ input }) => {
        const existingUser = await getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: "CONFLICT", message: "Este email já está cadastrado" });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const existingCnpj = await db.select().from(users).where(eq(users.cnpj, input.cnpj)).limit(1);
        if (existingCnpj.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Este CPF/CNPJ já está cadastrado" });
        }
        const userResult = await createAuthUser(input.email, input.password, input.name, input.cnpj, "user");
        const userId = userResult.insertId;
        
        // Update role to "owner" for paying customers
        if (userId) {
          await db.update(users).set({ role: "owner" }).where(eq(users.id, userId));
        }
        
        for (let i = 1; i <= input.numUnits; i++) {
          const branchResult = await db.insert(branches).values({
            name: input.numUnits === 1 ? (input.name || "Unidade 1") : `${input.name || "Unidade"} ${i}`,
            email: input.email,
            phone: "",
            address: "",
          });
          const branchId = (branchResult as any)[0]?.insertId || 0;
          if (userId && branchId) {
            await db.insert(userBranches).values({ userId, branchId, role: "manager" });
          }
        }
        return { success: true, userId };
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        const isPasswordValid = await verifyPassword(input.password, user.password);
        if (!isPasswordValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        const hasActiveToken = await userHasActiveToken(user.id);
        return { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          role: user.role, 
          hasActiveToken,
          barberId: (user as any).barberId || null,
        };
      }),

    checkTokenStatus: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const status = await getTokenStatus(input.userId);
        return status;
      }),

    generateToken: publicProcedure
      .input(z.object({
        branchId: z.number(),
        expiresInDays: z.number().optional().default(30),
        adminUserId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can generate tokens" });
        }
        const token = await generateAccessToken(input.adminUserId, input.branchId, input.expiresInDays);
        return { token };
      }),

    validateToken: publicProcedure
      .input(z.object({ token: z.string(), userId: z.number().optional() }))
      .query(async ({ input }) => {
        const accessToken = await validateAccessToken(input.token, input.userId);
        if (!accessToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
        return { valid: true, branchId: accessToken.branchId, expiresAt: accessToken.expiresAt };
      }),

    listTokens: publicProcedure
      .input(z.object({ branchId: z.number(), adminUserId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can list tokens" });
        }
        return getUserTokens(input.adminUserId, input.branchId);
      }),

    deactivateToken: publicProcedure
      .input(z.object({ tokenId: z.number(), adminUserId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can deactivate tokens" });
        }
        await deactivateToken(input.tokenId);
        return { success: true };
      }),
  }),

  // Admin management routes
  admin: router({
    listUsers: publicProcedure
      .input(z.object({ adminUserId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins podem listar usuários" });
        }
        const allUsers = await db.select({
          id: users.id,
          email: users.email,
          name: users.name,
          cnpj: users.cnpj,
          role: users.role,
          loginMethod: users.loginMethod,
          createdAt: users.createdAt,
          barberId: users.barberId,
        }).from(users).where(sql`${users.role} != 'admin'`);

        const allTokens = await db.select({
          id: accessTokens.id,
          userId: accessTokens.userId,
          branchId: accessTokens.branchId,
          token: accessTokens.token,
          isActive: accessTokens.isActive,
          expiresAt: accessTokens.expiresAt,
          activatedAt: accessTokens.activatedAt,
          createdAt: accessTokens.createdAt,
        }).from(accessTokens);

        const allBranches = await db.select({ id: branches.id, name: branches.name }).from(branches);
        const branchMap = new Map(allBranches.map(b => [b.id, b.name]));

        return allUsers.map(user => ({
          ...user,
          tokens: allTokens
            .filter(t => t.userId === user.id)
            .map(t => ({
              ...t,
              branchName: branchMap.get(t.branchId) || "Desconhecida",
            })),
        }));
      }),

    changePassword: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        targetUserId: z.number(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins podem alterar senhas" });
        }
        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, input.targetUserId));
        return { success: true };
      }),

    changeEmail: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        targetUserId: z.number(),
        newEmail: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins podem alterar emails" });
        }
        const [existing] = await db.select().from(users).where(eq(users.email, input.newEmail));
        if (existing && existing.id !== input.targetUserId) {
          throw new TRPCError({ code: "CONFLICT", message: "Este email já está em uso" });
        }
        await db.update(users).set({ email: input.newEmail }).where(eq(users.id, input.targetUserId));
        return { success: true };
      }),

    deleteUser: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        targetUserId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins podem excluir usuários" });
        }
        if (input.targetUserId === input.adminUserId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir sua própria conta" });
        }
        await db.delete(accessTokens).where(eq(accessTokens.userId, input.targetUserId));
        await db.delete(userBranches).where(eq(userBranches.userId, input.targetUserId));
        await db.delete(users).where(eq(users.id, input.targetUserId));
        return { success: true };
      }),

    toggleToken: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        tokenId: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins podem alterar tokens" });
        }
        await db.update(accessTokens).set({ isActive: input.isActive }).where(eq(accessTokens.id, input.tokenId));
        return { success: true };
      }),

    listSubscriptions: publicProcedure
      .input(z.object({ adminUserId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins" });
        }
        const allTokens = await db.select({
          tokenId: accessTokens.id,
          token: accessTokens.token,
          userId: accessTokens.userId,
          branchId: accessTokens.branchId,
          isActive: accessTokens.isActive,
          activatedAt: accessTokens.activatedAt,
          expiresAt: accessTokens.expiresAt,
          durationDays: accessTokens.durationDays,
          tokenCreatedAt: accessTokens.createdAt,
          planSlug: accessTokens.planSlug,
        }).from(accessTokens);
        const allPlans = await db.select({ slug: plans.slug, name: plans.name }).from(plans);
        const planMap = new Map(allPlans.map(p => [p.slug, p.name]));

        const allUsers = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          cnpj: users.cnpj,
        }).from(users);
        const userMap = new Map(allUsers.map(u => [u.id, u]));

        const allBranches = await db.select({ id: branches.id, name: branches.name }).from(branches);
        const branchMap = new Map(allBranches.map(b => [b.id, b.name]));

        const now = new Date();
        return allTokens.map(t => {
          const user = userMap.get(t.userId);
          const isExpired = t.expiresAt ? new Date(t.expiresAt) < now : false;
          const daysRemaining = t.expiresAt ? Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
          let status: "active" | "expired" | "inactive" | "pending" = "pending";
          if (!t.isActive) status = "inactive";
          else if (isExpired) status = "expired";
          else if (t.activatedAt) status = "active";
          return {
            tokenId: t.tokenId,
            token: t.token,
            userId: t.userId,
            userName: user?.name || "Desconhecido",
            userEmail: user?.email || "-",
            userCnpj: user?.cnpj || "-",
            branchId: t.branchId,
            branchName: branchMap.get(t.branchId) || "Desconhecida",
            status,
            durationDays: t.durationDays,
            activatedAt: t.activatedAt,
            expiresAt: t.expiresAt,
             daysRemaining,
            createdAt: t.tokenCreatedAt,
            planSlug: t.planSlug || null,
            planName: t.planSlug ? (planMap.get(t.planSlug) || t.planSlug) : null,
          };
        });
      }),
    extendToken: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        tokenId: z.number(),
        extraDays: z.number().min(1).max(365),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins" });
        }
        const [token] = await db.select().from(accessTokens).where(eq(accessTokens.id, input.tokenId));
        if (!token) throw new TRPCError({ code: "NOT_FOUND", message: "Token não encontrado" });

        const now = new Date();
        const baseDate = token.expiresAt && new Date(token.expiresAt) > now ? new Date(token.expiresAt) : now;
        const newExpires = new Date(baseDate.getTime() + input.extraDays * 24 * 60 * 60 * 1000);

        await db.update(accessTokens).set({
          expiresAt: newExpires,
          isActive: true,
          activatedAt: token.activatedAt || now,
        }).where(eq(accessTokens.id, input.tokenId));
        return { success: true, newExpiresAt: newExpires };
      }),

    renewToken: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        tokenId: z.number(),
        durationDays: z.number().min(1).max(365).default(30),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins" });
        }
        const now = new Date();
        const newExpires = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
        await db.update(accessTokens).set({
          activatedAt: now,
          expiresAt: newExpires,
          isActive: true,
          durationDays: input.durationDays,
        }).where(eq(accessTokens.id, input.tokenId));
        return { success: true, newExpiresAt: newExpires };
      }),

    deleteToken: publicProcedure
      .input(z.object({ adminUserId: z.number(), tokenId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins" });
        }
        await db.delete(accessTokens).where(eq(accessTokens.id, input.tokenId));
        return { success: true };
      }),

    updateTokenDuration: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        tokenId: z.number(),
        durationDays: z.number().min(1).max(3650),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins" });
        }
        // Busca o token atual para recalcular expiresAt a partir da data de ativação
        const [token] = await db.select().from(accessTokens).where(eq(accessTokens.id, input.tokenId));
        if (!token) throw new TRPCError({ code: "NOT_FOUND", message: "Token não encontrado" });
        const baseDate = token.activatedAt ? new Date(token.activatedAt) : new Date();
        const newExpires = new Date(baseDate.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
        await db.update(accessTokens).set({
          durationDays: input.durationDays,
          expiresAt: newExpires,
        }).where(eq(accessTokens.id, input.tokenId));
        return { success: true, newExpiresAt: newExpires };
      }),

    deleteBranch: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        branchId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins podem excluir unidades" });
        }
        await db.delete(accessTokens).where(eq(accessTokens.branchId, input.branchId));
        await db.delete(userBranches).where(eq(userBranches.branchId, input.branchId));
        await db.delete(branches).where(eq(branches.id, input.branchId));
        return { success: true };
      }),

    // Plan management
    listPlans: publicProcedure
      .input(z.object({ adminUserId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const allPlans = await db.select().from(plans).orderBy(plans.sortOrder);
        return allPlans.map(p => ({ ...p, features: JSON.parse(p.features || "[]") }));
      }),

    createPlan: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        slug: z.string().min(2).max(64),
        name: z.string().min(1).max(255),
        subtitle: z.string().optional(),
        barbers: z.string().optional(),
        maxBarbers: z.number().min(1).default(1),
        priceInCents: z.number().min(0),
        originalPriceInCents: z.number().optional(),
        features: z.array(z.string()),
        isActive: z.boolean().default(true),
        isHighlighted: z.boolean().default(false),
        badge: z.string().optional(),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { adminUserId, features, ...rest } = input;
        await db.insert(plans).values({ ...rest, features: JSON.stringify(features) });
        return { success: true };
      }),

    updatePlan: publicProcedure
      .input(z.object({
        adminUserId: z.number(),
        planId: z.number(),
        name: z.string().min(1).max(255).optional(),
        subtitle: z.string().optional(),
        barbers: z.string().optional(),
        maxBarbers: z.number().min(1).optional(),
        priceInCents: z.number().min(0).optional(),
        originalPriceInCents: z.number().nullable().optional(),
        features: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        isHighlighted: z.boolean().optional(),
        badge: z.string().nullable().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const { adminUserId, planId, features, ...rest } = input;
        const updateData: any = { ...rest };
        if (features !== undefined) updateData.features = JSON.stringify(features);
        await db.update(plans).set(updateData).where(eq(plans.id, planId));
        return { success: true };
      }),

    deletePlan: publicProcedure
      .input(z.object({ adminUserId: z.number(), planId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [adminUser] = await db.select().from(users).where(eq(users.id, input.adminUserId));
        if (!adminUser || adminUser.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.delete(plans).where(eq(plans.id, input.planId));
        return { success: true };
      }),
  }),

  // Public plans listing (for /plans page)
  plans: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const activePlans = await db.select().from(plans)
        .where(eq(plans.isActive, true))
        .orderBy(plans.sortOrder);
      return activePlans.map(p => ({ ...p, features: JSON.parse(p.features || "[]") }));
    }),
  }),

  // Password reset flow
  passwordReset: router({
    requestReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
        userType: z.enum(["owner", "barber"]),
        origin: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Check if user exists
        let userExists = false;
        if (input.userType === "owner") {
          const [u] = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.email, input.email), sql`${users.role} IN ('owner', 'user', 'admin')`))
            .limit(1);
          userExists = !!u;
        } else {
          const [u] = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.email, input.email), eq(users.role, "barber")))
            .limit(1);
          userExists = !!u;
        }

        // Always return success to avoid email enumeration
        if (!userExists) return { success: true };

        // Generate token
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete old tokens for this email
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, input.email));

        // Save new token
        await db.insert(passwordResetTokens).values({
          email: input.email,
          token,
          userType: input.userType,
          expiresAt,
        });

        const origin = input.origin || "https://barbershopsmart.com";
        const resetUrl = `${origin}/redefinir-senha?token=${token}&type=${input.userType}`;

        // Notify owner with the reset link
        await notifyOwner({
          title: `🔑 Redefinição de Senha Solicitada`,
          content: `O ${input.userType === "owner" ? "dono" : "barbeiro"} com email **${input.email}** solicitou redefinição de senha.\n\nLink para redefinir (válido por 1 hora):\n${resetUrl}\n\nSe você não solicitou isso, ignore esta mensagem.`,
        });

        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [resetToken] = await db.select().from(passwordResetTokens)
          .where(eq(passwordResetTokens.token, input.token))
          .limit(1);

        if (!resetToken) throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido ou expirado" });
        if (resetToken.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Este link já foi utilizado" });
        if (new Date(resetToken.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Link expirado. Solicite um novo." });
        }

        const hashedPassword = await bcrypt.hash(input.newPassword, 10);

        // Update password in users table
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.email, resetToken.email));

        // Mark token as used
        await db.update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.id, resetToken.id));

        return { success: true };
      }),

    validateToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [resetToken] = await db.select().from(passwordResetTokens)
          .where(eq(passwordResetTokens.token, input.token))
          .limit(1);

        if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt) < new Date()) {
          return { valid: false };
        }
        return { valid: true, email: resetToken.email, userType: resetToken.userType };
      }),
  }),

  // Appointment items (múltiplos serviços por atendimento)
  appointmentItems: router({
    listByAppointment: publicProcedure
      .input(z.object({ appointmentId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(appointmentItems)
          .where(eq(appointmentItems.appointmentId, input.appointmentId));
      }),

    addItem: publicProcedure
      .input(z.object({
        appointmentId: z.number(),
        serviceId: z.number().optional(),
        serviceName: z.string(),
        servicePrice: z.number(),
        discount: z.number().min(0).default(0),
        commissionPercentage: z.number().min(0).max(100).default(30),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const netPrice = input.servicePrice - (input.discount || 0);
        const commissionAmount = (netPrice * input.commissionPercentage) / 100;
        await db.insert(appointmentItems).values({
          appointmentId: input.appointmentId,
          serviceId: input.serviceId,
          serviceName: input.serviceName,
          servicePrice: input.servicePrice.toString(),
          discount: (input.discount || 0).toString(),
          commissionPercentage: input.commissionPercentage.toString(),
          commissionAmount: commissionAmount.toString(),
        });
        return { success: true };
      }),

    removeItem: publicProcedure
      .input(z.object({ itemId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(appointmentItems).where(eq(appointmentItems.id, input.itemId));
        return { success: true };
      }),
  }),

  // Barber self-registration flow
  barberAuth: router({
    // Step 1: Look up which barbershop is linked to this email
    lookupByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Find barber profile with this email
        const [barber] = await db.select({
          id: barbers.id,
          name: barbers.name,
          email: barbers.email,
          branchId: barbers.branchId,
        }).from(barbers).where(eq(barbers.email, input.email));

        if (!barber) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma barbearia encontrada com este email. Verifique com o dono da barbearia." });
        }

        // Check if this barber already has a user account
        const [existingUser] = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.email, input.email), eq(users.role, "barber")));

        const [branch] = await db.select({ id: branches.id, name: branches.name })
          .from(branches).where(eq(branches.id, barber.branchId));

        return {
          barberId: barber.id,
          barberName: barber.name,
          branchId: barber.branchId,
          branchName: branch?.name || "Barbearia",
          hasAccount: !!existingUser,
        };
      }),

    // Step 2: Barber creates their login password
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
        barberId: z.number(),
        branchId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Verify barber still exists and email matches
        const [barber] = await db.select().from(barbers)
          .where(and(eq(barbers.id, input.barberId), eq(barbers.email, input.email)));
        if (!barber) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Barbeiro não encontrado" });
        }

        // Check if account already exists
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Este email já tem uma conta. Faça login normalmente." });
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const openId = `barber_${input.barberId}_${Date.now()}`;

        await db.insert(users).values({
          openId,
          email: input.email,
          name: barber.name,
          password: hashedPassword,
          loginMethod: "local",
          role: "barber",
          barberId: input.barberId,
        });

        // Link barber user to the branch
        const [newUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
        if (newUser) {
          await db.insert(userBranches).values({ userId: newUser.id, branchId: input.branchId });
        }

        return { success: true, message: "Conta criada! Faça login para acessar." };
      }),

    // Step 3: Barber login
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [user] = await db.select().from(users)
          .where(and(eq(users.email, input.email), eq(users.role, "barber")));
        if (!user || !user.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
        }

        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
        }

        // Get linked branch
        const [ub] = await db.select({ branchId: userBranches.branchId })
          .from(userBranches).where(eq(userBranches.userId, user.id));

        const userData = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          barberId: user.barberId,
          branchId: ub?.branchId || null,
        };

        return { success: true, user: userData };
      }),
  }),
});

export type AppRouter = typeof appRouter;
