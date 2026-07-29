import type { InitializeResult } from "@ai-sdk/mcp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	MCP_CATALOG_TTL_MS,
	MCP_RUNTIME_CACHE_MAX_ENTRIES,
	type McpCatalogTool,
	McpRuntimeCacheService,
	TIKTOK_HIDDEN_CATALOG_TTL_MS,
	type TikTokHiddenOperation,
} from "./mcp-runtime-cache.service";

const NOW = new Date("2026-07-29T12:00:00.000Z");
const CONNECTION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CONNECTION_ID = "22222222-2222-4222-8222-222222222222";

const initializeResult: InitializeResult = {
	capabilities: {},
	protocolVersion: "2025-11-25",
	serverInfo: {
		name: "test-mcp-server",
		version: "1.0.0",
	},
};

function catalogTool(
	name: string,
	overrides: Partial<McpCatalogTool> = {},
): McpCatalogTool {
	return {
		description: `Description for ${name}`,
		inputSchema: {
			properties: {},
			type: "object",
		},
		name,
		...overrides,
	};
}

function hiddenOperation(
	name: string,
	overrides: Partial<TikTokHiddenOperation> = {},
): TikTokHiddenOperation {
	return {
		description: `Description for ${name}`,
		name,
		...overrides,
	};
}

describe("McpRuntimeCacheService", () => {
	let service: McpRuntimeCacheService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		service = new McpRuntimeCacheService();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("sessions", () => {
		it("stores the complete reusable session pair with an update timestamp", () => {
			service.setSession(CONNECTION_ID, {
				initializeResult,
				sessionId: "session-1",
			});

			expect(service.getSession(CONNECTION_ID)).toEqual({
				initializeResult,
				sessionId: "session-1",
				updatedAt: NOW.getTime(),
			});
		});

		it("isolates sessions by connection id", () => {
			service.setSession(CONNECTION_ID, {
				initializeResult,
				sessionId: "session-1",
			});
			service.setSession(OTHER_CONNECTION_ID, {
				initializeResult,
				sessionId: "session-2",
			});

			expect(service.getSession(CONNECTION_ID)?.sessionId).toBe("session-1");
			expect(service.getSession(OTHER_CONNECTION_ID)?.sessionId).toBe(
				"session-2",
			);
		});

		it("refreshes updatedAt when a session rotates", () => {
			service.setSession(CONNECTION_ID, {
				initializeResult,
				sessionId: "session-1",
			});
			vi.advanceTimersByTime(5_000);

			service.setSession(CONNECTION_ID, {
				initializeResult,
				sessionId: "session-2",
			});

			expect(service.getSession(CONNECTION_ID)).toEqual({
				initializeResult,
				sessionId: "session-2",
				updatedAt: NOW.getTime() + 5_000,
			});
		});

		it("invalidates unconditionally when no expected session id is supplied", () => {
			service.setSession(CONNECTION_ID, {
				initializeResult,
				sessionId: "session-1",
			});

			expect(service.invalidateSession(CONNECTION_ID)).toBe(true);
			expect(service.getSession(CONNECTION_ID)).toBeUndefined();
			expect(service.invalidateSession(CONNECTION_ID)).toBe(false);
		});

		it("invalidates only when the expected session id still matches", () => {
			service.setSession(CONNECTION_ID, {
				initializeResult,
				sessionId: "rotated-session",
			});

			expect(service.invalidateSession(CONNECTION_ID, "old-session")).toBe(
				false,
			);
			expect(service.getSession(CONNECTION_ID)?.sessionId).toBe(
				"rotated-session",
			);
			expect(service.invalidateSession(CONNECTION_ID, "rotated-session")).toBe(
				true,
			);
			expect(service.getSession(CONNECTION_ID)).toBeUndefined();
		});
	});

	describe("tool catalogs", () => {
		it("uses the specified ten-minute TTL", () => {
			expect(MCP_CATALOG_TTL_MS).toBe(10 * 60 * 1_000);
		});

		it("returns a catalog before its TTL and deletes it at expiry", () => {
			const tools = [catalogTool("campaign_get")];
			service.setCatalog(CONNECTION_ID, tools);
			vi.advanceTimersByTime(MCP_CATALOG_TTL_MS - 1);

			expect(service.getCatalog(CONNECTION_ID)).toBe(tools);

			vi.advanceTimersByTime(1);

			expect(service.getCatalog(CONNECTION_ID)).toBeUndefined();
			expect(service.getCatalog(CONNECTION_ID)).toBeUndefined();
		});

		it("isolates catalogs by connection id", () => {
			const tools = [catalogTool("campaign_get")];
			const otherTools = [catalogTool("audience_get")];
			service.setCatalog(CONNECTION_ID, tools);
			service.setCatalog(OTHER_CONNECTION_ID, otherTools);

			expect(service.getCatalog(CONNECTION_ID)).toBe(tools);
			expect(service.getCatalog(OTHER_CONNECTION_ID)).toBe(otherTools);
		});

		it("refreshes fetchedAt when a catalog is replaced", () => {
			service.setCatalog(CONNECTION_ID, [catalogTool("campaign_get")]);
			vi.advanceTimersByTime(MCP_CATALOG_TTL_MS - 1);
			const replacement = [catalogTool("campaign_report")];

			service.setCatalog(CONNECTION_ID, replacement);
			vi.advanceTimersByTime(MCP_CATALOG_TTL_MS - 1);

			expect(service.getCatalog(CONNECTION_ID)).toBe(replacement);
		});
	});

	describe("TikTok hidden catalogs", () => {
		it("uses the specified sixty-minute TTL", () => {
			expect(TIKTOK_HIDDEN_CATALOG_TTL_MS).toBe(60 * 60 * 1_000);
		});

		it("returns hidden operations before their TTL and deletes them at expiry", () => {
			const ops = [hiddenOperation("campaign_create")];
			service.setTikTokHiddenCatalog(CONNECTION_ID, ops);
			vi.advanceTimersByTime(TIKTOK_HIDDEN_CATALOG_TTL_MS - 1);

			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toBe(ops);

			vi.advanceTimersByTime(1);

			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toBeUndefined();
			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toBeUndefined();
		});

		it("isolates hidden operations by connection id", () => {
			const ops = [hiddenOperation("campaign_create")];
			const otherOps = [hiddenOperation("audience_create")];
			service.setTikTokHiddenCatalog(CONNECTION_ID, ops);
			service.setTikTokHiddenCatalog(OTHER_CONNECTION_ID, otherOps);

			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toBe(ops);
			expect(service.getTikTokHiddenCatalog(OTHER_CONNECTION_ID)).toBe(
				otherOps,
			);
		});

		it("updates matching operation details without changing its name", () => {
			service.setTikTokHiddenCatalog(CONNECTION_ID, [
				hiddenOperation("campaign_create"),
				hiddenOperation("audience_create"),
			]);
			const inputSchema = {
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
				type: "object",
			};

			expect(
				service.updateTikTokHiddenOperation(CONNECTION_ID, "campaign_create", {
					description: "Create a TikTok campaign",
					inputSchema,
				}),
			).toBe(true);
			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toEqual([
				{
					description: "Create a TikTok campaign",
					inputSchema,
					name: "campaign_create",
				},
				hiddenOperation("audience_create"),
			]);
		});

		it("does not refresh fetchedAt when operation details are updated", () => {
			service.setTikTokHiddenCatalog(CONNECTION_ID, [
				hiddenOperation("campaign_create"),
			]);
			vi.advanceTimersByTime(TIKTOK_HIDDEN_CATALOG_TTL_MS - 1);

			expect(
				service.updateTikTokHiddenOperation(CONNECTION_ID, "campaign_create", {
					inputSchema: { type: "object" },
				}),
			).toBe(true);
			vi.advanceTimersByTime(1);

			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toBeUndefined();
		});

		it("does not update missing or expired operations", () => {
			service.setTikTokHiddenCatalog(CONNECTION_ID, [
				hiddenOperation("campaign_create"),
			]);

			expect(
				service.updateTikTokHiddenOperation(CONNECTION_ID, "audience_create", {
					description: "Create an audience",
				}),
			).toBe(false);

			vi.advanceTimersByTime(TIKTOK_HIDDEN_CATALOG_TTL_MS);

			expect(
				service.updateTikTokHiddenOperation(CONNECTION_ID, "campaign_create", {
					description: "Updated too late",
				}),
			).toBe(false);
			expect(service.getTikTokHiddenCatalog(CONNECTION_ID)).toBeUndefined();
		});
	});

	it("bounds every cache map by evicting its oldest connection entry", () => {
		for (let index = 0; index <= MCP_RUNTIME_CACHE_MAX_ENTRIES; index += 1) {
			const connectionId = `connection-${index}`;
			service.setSession(connectionId, {
				initializeResult,
				sessionId: `session-${index}`,
			});
			service.setCatalog(connectionId, [catalogTool(`tool-${index}`)]);
			service.setTikTokHiddenCatalog(connectionId, [
				hiddenOperation(`operation-${index}`),
			]);
		}

		expect(service.getSession("connection-0")).toBeUndefined();
		expect(service.getCatalog("connection-0")).toBeUndefined();
		expect(service.getTikTokHiddenCatalog("connection-0")).toBeUndefined();
		expect(
			service.getSession(`connection-${MCP_RUNTIME_CACHE_MAX_ENTRIES}`)
				?.sessionId,
		).toBe(`session-${MCP_RUNTIME_CACHE_MAX_ENTRIES}`);
	});
});
