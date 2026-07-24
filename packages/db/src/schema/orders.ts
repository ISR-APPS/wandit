import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const paymentOrderStatus = pgEnum("payment_order_status", [
	"pending",
	"paid",
	"fulfilling",
	"fulfilled",
	"failed",
	"canceled",
	"refunded",
]);

export const paymentOrderKind = pgEnum("payment_order_kind", [
	"domain_registration",
]);

export const paymentOrders = pgTable(
	"payment_orders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		kind: paymentOrderKind("kind").notNull(),
		status: paymentOrderStatus("status").notNull().default("pending"),
		amountCents: integer("amount_cents").notNull(),
		currency: text("currency").notNull(),
		provider: text("provider").notNull().default("stripe"),
		providerCheckoutSessionId: text("provider_checkout_session_id"),
		providerPaymentIntentId: text("provider_payment_intent_id"),
		providerPaymentStatus: text("provider_payment_status"),
		providerRefundId: text("provider_refund_id"),
		refundStatus: text("refund_status"),
		metadata: jsonb("metadata").notNull(),
		fulfillmentError: text("fulfillment_error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
	},
	(table) => [
		index("payment_orders_userId_createdAt_idx").on(
			table.userId,
			table.createdAt,
		),
		index("payment_orders_status_idx").on(table.status),
		uniqueIndex("payment_orders_providerCheckoutSessionId_uq").on(
			table.providerCheckoutSessionId,
		),
		uniqueIndex("payment_orders_providerPaymentIntentId_uq").on(
			table.providerPaymentIntentId,
		),
		uniqueIndex("payment_orders_providerRefundId_uq").on(
			table.providerRefundId,
		),
		check(
			"payment_orders_amount_cents_positive_ck",
			sql`${table.amountCents} > 0`,
		),
		check(
			"payment_orders_currency_ck",
			sql`${table.currency} = lower(${table.currency}) AND char_length(${table.currency}) = 3`,
		),
	],
);

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
	user: one(user, {
		fields: [paymentOrders.userId],
		references: [user.id],
	}),
}));
