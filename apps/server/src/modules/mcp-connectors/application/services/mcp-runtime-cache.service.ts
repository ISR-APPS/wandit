import type { InitializeResult, ListToolsResult } from "@ai-sdk/mcp";
import { Injectable } from "@nestjs/common";

export const MCP_CATALOG_TTL_MS = 10 * 60 * 1_000;
export const MCP_RUNTIME_CACHE_MAX_ENTRIES = 1_000;
export const TIKTOK_HIDDEN_CATALOG_TTL_MS = 60 * 60 * 1_000;

export type McpCatalogTool = {
	description: string;
	inputSchema: ListToolsResult["tools"][number]["inputSchema"];
	name: string;
};

export type McpRuntimeSession = {
	initializeResult: InitializeResult;
	sessionId: string;
	updatedAt: number;
};

export type TikTokHiddenOperation = {
	description: string;
	inputSchema?: unknown;
	name: string;
};

type McpCatalogEntry = {
	fetchedAt: number;
	tools: McpCatalogTool[];
};

type TikTokHiddenCatalogEntry = {
	fetchedAt: number;
	ops: TikTokHiddenOperation[];
};

type TikTokHiddenOperationPatch = Partial<
	Pick<TikTokHiddenOperation, "description" | "inputSchema">
>;

@Injectable()
export class McpRuntimeCacheService {
	private readonly sessions = new Map<string, McpRuntimeSession>();
	private readonly catalogs = new Map<string, McpCatalogEntry>();
	private readonly tiktokHiddenCatalogs = new Map<
		string,
		TikTokHiddenCatalogEntry
	>();

	getSession(connectionId: string): McpRuntimeSession | undefined {
		return this.sessions.get(connectionId);
	}

	setSession(
		connectionId: string,
		session: Omit<McpRuntimeSession, "updatedAt">,
	): void {
		setBoundedMapEntry(
			this.sessions,
			connectionId,
			{
				...session,
				updatedAt: Date.now(),
			},
			MCP_RUNTIME_CACHE_MAX_ENTRIES,
		);
	}

	invalidateSession(connectionId: string, expectedSessionId?: string): boolean {
		const session = this.sessions.get(connectionId);

		if (
			!session ||
			(expectedSessionId !== undefined &&
				session.sessionId !== expectedSessionId)
		) {
			return false;
		}

		return this.sessions.delete(connectionId);
	}

	getCatalog(connectionId: string): McpCatalogTool[] | undefined {
		const entry = this.catalogs.get(connectionId);

		if (!entry) {
			return undefined;
		}

		if (Date.now() - entry.fetchedAt >= MCP_CATALOG_TTL_MS) {
			this.catalogs.delete(connectionId);
			return undefined;
		}

		return entry.tools;
	}

	setCatalog(connectionId: string, tools: McpCatalogTool[]): void {
		setBoundedMapEntry(
			this.catalogs,
			connectionId,
			{
				fetchedAt: Date.now(),
				tools,
			},
			MCP_RUNTIME_CACHE_MAX_ENTRIES,
		);
	}

	getTikTokHiddenCatalog(
		connectionId: string,
	): TikTokHiddenOperation[] | undefined {
		const entry = this.tiktokHiddenCatalogs.get(connectionId);

		if (!entry) {
			return undefined;
		}

		if (Date.now() - entry.fetchedAt >= TIKTOK_HIDDEN_CATALOG_TTL_MS) {
			this.tiktokHiddenCatalogs.delete(connectionId);
			return undefined;
		}

		return entry.ops;
	}

	setTikTokHiddenCatalog(
		connectionId: string,
		ops: TikTokHiddenOperation[],
	): void {
		setBoundedMapEntry(
			this.tiktokHiddenCatalogs,
			connectionId,
			{
				fetchedAt: Date.now(),
				ops,
			},
			MCP_RUNTIME_CACHE_MAX_ENTRIES,
		);
	}

	updateTikTokHiddenOperation(
		connectionId: string,
		name: string,
		patch: TikTokHiddenOperationPatch,
	): boolean {
		const ops = this.getTikTokHiddenCatalog(connectionId);

		if (!ops) {
			return false;
		}

		const operationIndex = ops.findIndex(
			(operation) => operation.name === name,
		);
		const operation = ops[operationIndex];

		if (!operation) {
			return false;
		}

		ops[operationIndex] = {
			...operation,
			...patch,
		};
		return true;
	}
}

function setBoundedMapEntry<K extends string, V>(
	map: Map<K, V>,
	key: K,
	value: V,
	maxEntries: number,
): void {
	map.delete(key);
	map.set(key, value);

	while (map.size > maxEntries) {
		const oldestKey = map.keys().next().value;
		if (oldestKey === undefined) {
			return;
		}
		map.delete(oldestKey);
	}
}
