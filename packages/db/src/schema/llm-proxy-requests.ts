/**
 * One row per request the V2 LLM proxy answers, including rejections.
 * The proxy writes it after each upstream call or refused check.
 * WANDIT-174 reads it for spend reconciliation; nothing updates rows.
 */
import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { builderTurns } from "./builder-turns";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * Inbound request format. `openai` is reserved for the OpenCode follow-up;
 * the Anthropic controller is the only writer today. Matches
 * `llmProxyInboundFormats` in @wandit/contracts.
 */
export const llmProxyInboundFormat = pgEnum("llm_proxy_inbound_format", [
	"anthropic",
	"openai",
]);

/**
 * Outcome of one proxied request. Matches `llmProxyRequestStatuses` in
 * @wandit/contracts one to one; tsc rejects a contracts status the enum
 * lacks at the insert call.
 */
export const llmProxyRequestStatus = pgEnum("llm_proxy_request_status", [
	"ok",
	"upstream_error",
	"cap_rejected",
	"model_denied",
	"client_aborted",
	"rate_limited",
]);

/** The proxy usage table; rows are insert-only, nothing updates them. */
export const llmProxyRequests = pgTable(
	"llm_proxy_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Trigger.dev run id from the run token. Not a uuid; no table to
		// reference.
		runId: text("run_id").notNull(),
		// The `builder_turns` row the token was minted for. Set null keeps the
		// usage row when the turn goes away with its project.
		turnId: uuid("turn_id").references(() => builderTurns.id, {
			onDelete: "set null",
		}),
		// Set null keeps billing evidence when the user or project is deleted.
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		// Organization id from the token; null for personal workspaces.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "set null",
		}),
		// Provider of the model, for example `anthropic`. Null when the check
		// order rejected the request before upstream selection.
		provider: text("provider"),
		// The model id sent upstream, not the one the sandbox asked for. Null
		// for `model_denied`: nothing was sent.
		model: text("model"),
		inboundFormat: llmProxyInboundFormat("inbound_format").notNull(),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		cacheReadTokens: integer("cache_read_tokens"),
		cacheWriteTokens: integer("cache_write_tokens"),
		// UNIT: micros of USD (1 USD = 1,000,000 micros). Null when the model
		// has no price-table row or no usage was seen.
		// LIMIT: integer fits $2,147 per request. Upgrade: bigint.
		usdMicros: integer("usd_micros"),
		// UNIT: micros of USD, rounded up. The real cost from the Vercel AI
		// Gateway `provider_metadata.gateway`: `marketCost` for a BYOK host,
		// else `cost`. Billing reads `usd_micros`, not this column. Null when
		// the answer has no valid gateway cost above 0. Examples: count_tokens,
		// a rejection, an abort or an upstream error before the final event.
		// Also null for an upstream outside the gateway (Paper, a direct key).
		gatewayUsdMicros: integer("gateway_usd_micros"),
		// Host that answered (`routing.finalProvider`), for example `baseten`
		// or `vertex`. Null when `gateway_usd_micros` is null.
		gatewayProvider: text("gateway_provider"),
		status: llmProxyRequestStatus("status").notNull(),
		// Short machine-readable detail for rejected or failed rows, for
		// example `run_cap` or `daily_cap`. Null on `ok`.
		reason: text("reason"),
		// `request-id` header of the upstream response, else its
		// `x-request-id` header. Null when it sends neither.
		upstreamRequestId: text("upstream_request_id"),
		// `x-claude-code-session-id` the sandbox sent; ties rows to one Claude
		// Code session for debugging.
		claudeSessionId: text("claude_session_id"),
		// Wall time from request start to response end, in milliseconds.
		latencyMs: integer("latency_ms"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("llm_proxy_requests_runId_idx").on(table.runId),
		index("llm_proxy_requests_turnId_idx").on(table.turnId),
		index("llm_proxy_requests_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
	],
);

/** Joins the usage row to its parents; serves the WANDIT-174 reads. */
export const llmProxyRequestsRelations = relations(
	llmProxyRequests,
	({ one }) => ({
		user: one(user, {
			fields: [llmProxyRequests.userId],
			references: [user.id],
		}),
		project: one(projects, {
			fields: [llmProxyRequests.projectId],
			references: [projects.id],
		}),
		organization: one(organization, {
			fields: [llmProxyRequests.organizationId],
			references: [organization.id],
		}),
		turn: one(builderTurns, {
			fields: [llmProxyRequests.turnId],
			references: [builderTurns.id],
		}),
	}),
);
