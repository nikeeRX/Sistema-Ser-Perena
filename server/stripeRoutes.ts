import { Express, Request, Response } from "express";
import Stripe from "stripe";
import { PLANS, getPlanById } from "./stripeProducts";
import { getDb } from "./db";
import { accessTokens, branches, users, userBranches, plans as plansTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { notifyOwner } from "./_core/notification";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function registerStripeRoutes(app: Express) {
  // ── Webhook (must be before express.json) ──────────────────────────────────
  app.post(
    "/api/stripe/webhook",
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Test event detection
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
      }

      res.json({ received: true });
    }
  );

  // ── Create Checkout Session ────────────────────────────────────────────────
  app.post("/api/stripe/create-checkout", async (req: Request, res: Response) => {
    try {
      const { planId, email, name, origin } = req.body;

      if (!planId || !email || !origin) {
        return res.status(400).json({ error: "planId, email and origin are required" });
      }

      // Try to get plan from database first, fallback to static file
      let planName = planId;
      let planSubtitle = "";
      let planBarbers = "";
      let planPriceInCents = 0;
      let planSlug = planId;

      const db = await getDb();
      if (db) {
        const dbPlan = await db.select().from(plansTable).where(eq(plansTable.slug, planId)).limit(1);
        if (dbPlan.length > 0) {
          const p = dbPlan[0];
          planName = p.name;
          planSubtitle = p.subtitle || "";
          planBarbers = p.barbers || "";
          planPriceInCents = p.priceInCents;
          planSlug = p.slug;
        } else {
          // Fallback to static plans
          const staticPlan = getPlanById(planId);
          if (!staticPlan) {
            return res.status(404).json({ error: "Plan not found" });
          }
          planName = staticPlan.name;
          planSubtitle = staticPlan.subtitle;
          planBarbers = staticPlan.barbers;
          planPriceInCents = staticPlan.priceInCents;
        }
      } else {
        const staticPlan = getPlanById(planId);
        if (!staticPlan) {
          return res.status(404).json({ error: "Plan not found" });
        }
        planName = staticPlan.name;
        planSubtitle = staticPlan.subtitle;
        planBarbers = staticPlan.barbers;
        planPriceInCents = staticPlan.priceInCents;
      }

      if (planPriceInCents <= 0) {
        return res.status(400).json({ error: "Invalid plan price" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer_email: email,
        allow_promotion_codes: true,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `BarberCtrl — Plano ${planName}`,
                description: `${planBarbers} · ${planSubtitle}`,
                metadata: { planId: planSlug },
              },
              unit_amount: planPriceInCents,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        metadata: {
          planId: planSlug,
          customer_email: email,
          customer_name: name || "",
        },
        client_reference_id: email,
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&plan=${planSlug}`,
        cancel_url: `${origin}/#planos`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Create checkout error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get Session Details (for success page) ────────────────────────────────
  app.get("/api/stripe/session/:sessionId", async (req: Request, res: Response) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      const planId = session.metadata?.planId;
      const plan = planId ? getPlanById(planId) : null;

      const db = await getDb();
      let accessToken: string | null = null;

      if (db && session.customer_email && session.payment_status === "paid") {
        // Find user by email
        const userRows = await db
          .select()
          .from(users)
          .where(eq(users.email, session.customer_email))
          .limit(1);

        if (userRows.length > 0) {
          const userId = userRows[0].id;

          // Check if user already has an active token
          const existingTokens = await db
            .select()
            .from(accessTokens)
            .where(eq(accessTokens.userId, userId))
            .limit(1);

          if (existingTokens.length > 0) {
            accessToken = existingTokens[0].token;
          } else {
            // Webhook didn't fire — create token now (fallback)
            console.log(`[Stripe Session] No token found for user ${userId}, creating fallback token`);
            await handleCheckoutCompleted(session);

            // Re-fetch the token
            const newTokens = await db
              .select()
              .from(accessTokens)
              .where(eq(accessTokens.userId, userId))
              .limit(1);
            if (newTokens.length > 0) {
              accessToken = newTokens[0].token;
            }
          }
        } else {
          // User doesn't exist yet — webhook didn't fire, create everything
          console.log(`[Stripe Session] User not found for ${session.customer_email}, running handleCheckoutCompleted as fallback`);
          await handleCheckoutCompleted(session);

          // Re-fetch user and token
          const newUser = await db
            .select()
            .from(users)
            .where(eq(users.email, session.customer_email))
            .limit(1);
          if (newUser.length > 0) {
            const newTokens = await db
              .select()
              .from(accessTokens)
              .where(eq(accessTokens.userId, newUser[0].id))
              .limit(1);
            if (newTokens.length > 0) {
              accessToken = newTokens[0].token;
            }
          }
        }
      }

      res.json({
        status: session.payment_status,
        email: session.customer_email,
        planId,
        planName: plan?.name || planId,
        accessToken,
      });
    } catch (err: any) {
      console.error("[Stripe] Get session error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

// ── Handle Checkout Completed ─────────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_email || session.metadata?.customer_email;
  const name = session.metadata?.customer_name || "Cliente";
  const planId = session.metadata?.planId || "equipe";
  
  // Try to get plan from database first, fallback to static
  let plan: { id?: string; slug?: string; name: string; barbers: string; priceInCents: number; subtitle?: string } | null = null;
  const dbForPlan = await getDb();
  if (dbForPlan) {
    const dbPlanRows = await dbForPlan.select().from(plansTable).where(eq(plansTable.slug, planId)).limit(1);
    if (dbPlanRows.length > 0) {
      const p = dbPlanRows[0];
      plan = { id: p.slug, slug: p.slug, name: p.name, barbers: p.barbers || "", priceInCents: p.priceInCents, subtitle: p.subtitle || "" };
    }
  }
  if (!plan) {
    const staticPlan = getPlanById(planId);
    if (staticPlan) {
      plan = { id: staticPlan.id, name: staticPlan.name, barbers: staticPlan.barbers, priceInCents: staticPlan.priceInCents, subtitle: staticPlan.subtitle };
    }
  }

  console.log(`[Stripe] Checkout completed for ${email} | Plan: ${planId}`);

  if (!email) {
    console.error("[Stripe] No email in session");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Stripe] Database not available");
    return;
  }

  try {
    // Check if user already exists in the main users table
    let userId: number | null = null;
    let tempPassword: string | null = null;
    let isNewUser = false;
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      // Update role to owner if not already
      if (existingUser[0].role !== "admin" && existingUser[0].role !== "owner") {
        await db.update(users).set({ role: "owner" }).where(eq(users.id, userId));
      }
      console.log(`[Stripe] Existing user found: ${userId}`);
    } else {
      // Create new user with temporary password in the main users table
      tempPassword = crypto.randomBytes(8).toString("hex");
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const openId = `stripe-${nanoid(16)}`;

      const result = await db.insert(users).values({
        openId,
        email,
        password: hashedPassword,
        name,
        loginMethod: "local",
        role: "owner",
      });
      userId = (result as any)[0]?.insertId || null;
      isNewUser = true;
      console.log(`[Stripe] New user created in main table: ${userId}`);
    }

    if (!userId) {
      console.error("[Stripe] Failed to get/create user");
      return;
    }

    // Check if user already has branches (registered via form before paying)
    const existingBranches = await db
      .select()
      .from(userBranches)
      .where(eq(userBranches.userId, userId))
      .limit(1);

    let branchId: number | null = null;

    if (existingBranches.length > 0) {
      // User already has branches from form signup — reuse the first branch for the token
      branchId = existingBranches[0].branchId;
      console.log(`[Stripe] User already has branches, reusing branchId: ${branchId}`);
    } else {
      // New user via Stripe — create a branch for them
      const branchResult = await db.insert(branches).values({
        name: `${name} — Unidade 1`,
        email,
        phone: "",
        address: "",
      });
      branchId = (branchResult as any)[0]?.insertId || null;

      if (!branchId) {
        console.error("[Stripe] Failed to create branch");
        return;
      }

      // Create user_branches relationship
      try {
        await db.insert(userBranches).values({ userId, branchId });
        console.log(`[Stripe] user_branches created: user ${userId} -> branch ${branchId}`);
      } catch (err) {
        console.warn(`[Stripe] user_branches may already exist:`, err);
      }
    }

    // Generate access token — AUTO-ACTIVATED (30 days for monthly plan)
    const token = generateToken();
    const now = new Date();
    const durationDays = 30; // Monthly subscription = 30 days
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await db.insert(accessTokens).values({
      userId,
      branchId,
      token,
      isActive: true,
      activatedAt: now,         // Auto-activated on payment
      durationDays,
      expiresAt,                // Expires in 30 days
      planSlug: planId || null, // Slug do plano contratado
    });

    console.log(`[Stripe] Access token AUTO-ACTIVATED for user ${userId} — expires ${expiresAt.toISOString()}`);

    // (user_branches already created above for new users)
    if (existingBranches.length > 0) {
      console.log(`[Stripe] Token linked to existing branch ${branchId} for user ${userId}`);
    }

    // Notify owner with full details
    const expiresFormatted = expiresAt.toLocaleDateString("pt-BR");
    const notifContent = isNewUser
      ? `🆕 NOVO CLIENTE\n\nNome: ${name}\nEmail: ${email}\nSenha temporária: ${tempPassword}\nPlano: ${plan?.name || planId} (${plan?.barbers || ""})\nValor: R$ ${((plan?.priceInCents || 0) / 100).toFixed(2)}/mês\nUnidade criada: ${name} — Unidade 1\nToken ativado automaticamente\nVencimento: ${expiresFormatted}\n\n⚠️ Repasse o email e senha ao cliente se necessário.`
      : `🔄 RENOVAÇÃO\n\nNome: ${name}\nEmail: ${email}\nPlano: ${plan?.name || planId} (${plan?.barbers || ""})\nValor: R$ ${((plan?.priceInCents || 0) / 100).toFixed(2)}/mês\nNovo vencimento: ${expiresFormatted}`;

    await notifyOwner({
      title: isNewUser
        ? `💰 Nova venda: ${name} — Plano ${plan?.name || planId}`
        : `🔄 Renovação: ${name} — Plano ${plan?.name || planId}`,
      content: notifContent,
    });
  } catch (err: any) {
    console.error("[Stripe] handleCheckoutCompleted error:", err.message);
  }
}
