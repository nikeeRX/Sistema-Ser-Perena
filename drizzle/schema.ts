import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  boolean,
  datetime
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extended with branch access control.
 * role: "admin" = super admin (you), "owner" = barbershop owner (client), "barber" = barber employee
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  password: text("password"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "owner", "barber"]).default("user").notNull(),
  barberId: int("barberId"), // Links user to a barber profile (for barber role)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Branches (Unidades de Barbearia)
 */
export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;

/**
 * User-Branch relationships for access control
 */
export const userBranches = mysqlTable("user_branches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["manager", "operator"]).default("operator").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserBranch = typeof userBranches.$inferSelect;
export type InsertUserBranch = typeof userBranches.$inferInsert;

/**
 * Barbers (Barbeiros)
 */
export const barbers = mysqlTable("barbers", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 2 }).notNull().default("30"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Barber = typeof barbers.$inferSelect;
export type InsertBarber = typeof barbers.$inferInsert;

/**
 * Services (Serviços de Barbearia)
 */
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  barberCommissionPercentage: decimal("barberCommissionPercentage", { precision: 5, scale: 2 }).notNull().default("30"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

/**
 * Products (Produtos para Venda)
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").references(() => branches.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 2 }).notNull().default("10"),
  quantity: int("quantity").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Stock Inventory (Estoque por Unidade)
 */
export const stockInventory = mysqlTable("stock_inventory", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockInventory = typeof stockInventory.$inferSelect;
export type InsertStockInventory = typeof stockInventory.$inferInsert;

/**
 * Scheduling (Agenda de Marcação)
 * Status flow: scheduled → in_progress → completed
 */
export const scheduling = mysqlTable("scheduling", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  barberId: int("barberId").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 20 }),
  scheduledDate: datetime("scheduledDate").notNull(),
  scheduledEndDate: datetime("scheduledEndDate"),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  // Fields filled on completion (when status becomes "completed")
  appointmentId: int("appointmentId").references(() => appointments.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Scheduling = typeof scheduling.$inferSelect;
export type InsertScheduling = typeof scheduling.$inferInsert;

/**
 * Appointments (Atendimentos)
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  barberId: int("barberId").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "cascade" }),
  clientName: varchar("clientName", { length: 255 }),
  appointmentDate: datetime("appointmentDate").notNull(),
  servicePrice: decimal("servicePrice", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  finalPrice: decimal("finalPrice", { precision: 10, scale: 2 }).notNull(),
  barberCommission: decimal("barberCommission", { precision: 10, scale: 2 }).notNull(),
  tip: decimal("tip", { precision: 10, scale: 2 }).default("0").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["credit", "debit", "pix", "cash"]).default("cash"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Product Sales (Vendas de Produtos)
 */
export const productSales = mysqlTable("product_sales", {
  id: int("id").autoincrement().primaryKey(),
  appointmentId: int("appointmentId").references(() => appointments.id, { onDelete: "set null" }),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSale = typeof productSales.$inferSelect;
export type InsertProductSale = typeof productSales.$inferInsert;

/**
 * Commissions (Comissões Calculadas)
 */
export const commissions = mysqlTable("commissions", {
  id: int("id").autoincrement().primaryKey(),
  branchId: int("branchId").notNull().references(() => branches.id, { onDelete: "cascade" }),
  barberId: int("barberId").notNull().references(() => barbers.id, { onDelete: "cascade" }),
  appointmentId: int("appointmentId").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }).notNull(),
  commissionDate: datetime("commissionDate").notNull(),
  status: mysqlEnum("status", ["pending", "paid"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = typeof commissions.$inferInsert;

/**
 * Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  userBranches: many(userBranches),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  barbers: many(barbers),
  services: many(services),
  userBranches: many(userBranches),
  appointments: many(appointments),
  productSales: many(productSales),
  stockInventory: many(stockInventory),
  commissions: many(commissions),
  scheduling: many(scheduling),
}));

export const barbersRelations = relations(barbers, ({ one, many }) => ({
  branch: one(branches, { fields: [barbers.branchId], references: [branches.id] }),
  appointments: many(appointments),
  commissions: many(commissions),
  scheduling: many(scheduling),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  branch: one(branches, { fields: [services.branchId], references: [branches.id] }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  branch: one(branches, { fields: [appointments.branchId], references: [branches.id] }),
  barber: one(barbers, { fields: [appointments.barberId], references: [barbers.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  productSales: many(productSales),
  commissions: many(commissions),
}));

export const productSalesRelations = relations(productSales, ({ one }) => ({
  appointment: one(appointments, { fields: [productSales.appointmentId], references: [appointments.id] }),
  branch: one(branches, { fields: [productSales.branchId], references: [branches.id] }),
  product: one(products, { fields: [productSales.productId], references: [products.id] }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  branch: one(branches, { fields: [commissions.branchId], references: [branches.id] }),
  barber: one(barbers, { fields: [commissions.barberId], references: [barbers.id] }),
  appointment: one(appointments, { fields: [commissions.appointmentId], references: [appointments.id] }),
}));

export const stockInventoryRelations = relations(stockInventory, ({ one }) => ({
  branch: one(branches, { fields: [stockInventory.branchId], references: [branches.id] }),
  product: one(products, { fields: [stockInventory.productId], references: [products.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  stockInventory: many(stockInventory),
  productSales: many(productSales),
}));

export const userBranchesRelations = relations(userBranches, ({ one }) => ({
  user: one(users, { fields: [userBranches.userId], references: [users.id] }),
  branch: one(branches, { fields: [userBranches.branchId], references: [branches.id] }),
}));

export const schedulingRelations = relations(scheduling, ({ one }) => ({
  branch: one(branches, { fields: [scheduling.branchId], references: [branches.id] }),
  barber: one(barbers, { fields: [scheduling.barberId], references: [barbers.id] }),
  appointment: one(appointments, { fields: [scheduling.appointmentId], references: [appointments.id] }),
}));


/**
 * Usuarios com autenticacao por email/senha
 */
export const authUsers = mysqlTable("auth_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = typeof authUsers.$inferInsert;

/**
 * Tokens de acesso para usuarios
 */
export const accessTokens = mysqlTable("access_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: int("userId").notNull(),
  branchId: int("branchId").notNull(),
  expiresAt: timestamp("expiresAt"),
  activatedAt: timestamp("activatedAt"), // null = never used; set on first login
  durationDays: int("durationDays").default(90), // how many days after activation
  isActive: boolean("isActive").default(true).notNull(),
  planSlug: varchar("planSlug", { length: 64 }), // slug do plano contratado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccessToken = typeof accessTokens.$inferSelect;
export type InsertAccessToken = typeof accessTokens.$inferInsert;

export const accessTokensRelations = relations(accessTokens, ({ one }) => ({
  user: one(authUsers, { fields: [accessTokens.userId], references: [authUsers.id] }),
  branch: one(branches, { fields: [accessTokens.branchId], references: [branches.id] }),
}));

/**
 * Plans (Planos de Assinatura gerenciados pelo admin)
 */
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  barbers: varchar("barbers", { length: 100 }),
  maxBarbers: int("maxBarbers").default(1).notNull(),
  priceInCents: int("priceInCents").notNull(),
  originalPriceInCents: int("originalPriceInCents"),
  features: text("features").notNull(), // JSON array stored as string
  isActive: boolean("isActive").default(true).notNull(),
  isHighlighted: boolean("isHighlighted").default(false).notNull(),
  badge: varchar("badge", { length: 64 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

/**
 * Password Reset Tokens
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userType: mysqlEnum("userType", ["owner", "barber"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Appointment Items (Múltiplos serviços por atendimento)
 */
export const appointmentItems = mysqlTable("appointment_items", {
  id: int("id").autoincrement().primaryKey(),
  appointmentId: int("appointmentId").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  servicePrice: decimal("servicePrice", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  commissionPercentage: decimal("commissionPercentage", { precision: 5, scale: 2 }).default("30").notNull(),
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AppointmentItem = typeof appointmentItems.$inferSelect;
export type InsertAppointmentItem = typeof appointmentItems.$inferInsert;

export const appointmentItemsRelations = relations(appointmentItems, ({ one }) => ({
  appointment: one(appointments, { fields: [appointmentItems.appointmentId], references: [appointments.id] }),
  service: one(services, { fields: [appointmentItems.serviceId], references: [services.id] }),
}));
