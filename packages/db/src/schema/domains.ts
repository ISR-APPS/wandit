import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { paymentOrders } from "./orders";
import { projects } from "./projects";

export const domainSource = pgEnum("domain_source", ["purchased", "external"]);

export const domainStatus = pgEnum("domain_status", [
	"registering",
	"configuring",
	"active",
	"failed",
	"expired",
	"transferred_out",
]);

export const domains = pgTable(
	"domains",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		paymentOrderId: uuid("payment_order_id").references(
			() => paymentOrders.id,
			{
				onDelete: "set null",
			},
		),
		name: text("name").notNull(),
		tld: text("tld").notNull(),
		source: domainSource("source").notNull(),
		status: domainStatus("status").notNull().default("registering"),
		isPrimary: boolean("is_primary").notNull().default(false),
		registrant: jsonb("registrant"),
		// Both default false: privacy and renewal are separate paid costs the
		// customer has not consented to at registration time.
		whoisPrivacy: boolean("whois_privacy").notNull().default(false),
		autoRenew: boolean("auto_renew").notNull().default(false),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		provider: text("provider"),
		providerDomainId: text("provider_domain_id"),
		providerOrderId: text("provider_order_id"),
		providerTotalPaidUsd: numeric("provider_total_paid_usd", {
			precision: 12,
			scale: 2,
		}),
		transferLockExpiresAt: timestamp("transfer_lock_expires_at", {
			withTimezone: true,
		}),
		cfCustomHostnameId: text("cf_custom_hostname_id"),
		dns: jsonb("dns"),
		externalDelegationReminderSentAt: timestamp(
			"external_delegation_reminder_sent_at",
			{ withTimezone: true },
		),
		priceSnapshot: jsonb("price_snapshot"),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("domains_userId_idx").on(table.userId),
		index("domains_projectId_idx").on(table.projectId),
		// Revenue analytics resolves each paid order to its registered domain.
		index("domains_paymentOrderId_idx").on(table.paymentOrderId),
		index("domains_status_idx").on(table.status),
		uniqueIndex("domains_name_uq").on(table.name),
		uniqueIndex("domains_primary_project_uq")
			.on(table.projectId)
			.where(sql`${table.isPrimary} = true`),
		check(
			"domains_name_lowercase_ck",
			sql`${table.name} = lower(${table.name}) AND char_length(${table.name}) <= 253`,
		),
		check(
			"domains_tld_lowercase_ck",
			sql`${table.tld} = lower(${table.tld}) AND char_length(${table.tld}) <= 63`,
		),
		check(
			"domains_provider_ck",
			sql`${table.provider} IS NULL OR ${table.provider} IN ('namecom', 'openprovider')`,
		),
	],
);

export const domainsRelations = relations(domains, ({ one }) => ({
	paymentOrder: one(paymentOrders, {
		fields: [domains.paymentOrderId],
		references: [paymentOrders.id],
	}),
	project: one(projects, {
		fields: [domains.projectId],
		references: [projects.id],
	}),
	user: one(user, {
		fields: [domains.userId],
		references: [user.id],
	}),
}));
