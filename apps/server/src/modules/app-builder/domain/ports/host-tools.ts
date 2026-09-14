/**
 * Port: the host-side tool set the agent may call during a turn.
 * The builder harness calls `build` at session start; WANDIT-169 fills in
 * the real tools (backend, preview, secrets). AI SDK `ToolSet` only —
 * vendor packages stay out.
 */
import type { ToolApprovalStatus as AiToolApprovalStatus, ToolSet } from "ai";

import type { SandboxHandle } from "./sandbox-provider";

/** Nest token for the `HostToolRegistry` implementation. */
export const HOST_TOOL_REGISTRY = Symbol.for("app-builder.host-tool-registry");

/**
 * The four string approval states of the AI SDK `ToolApprovalStatus`
 * union; the object and `undefined` forms never travel over our wire.
 */
export type ToolApprovalStatus = Extract<AiToolApprovalStatus, string>;

/** Who and where a host tool acts. */
export type HostToolContext = {
	/** The `builder_turns` row the tools run under. */
	turnId: string;
	projectId: string;
	chatId: string;
	/** The signed-in user who sent the turn. */
	actorUserId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
	sandbox: SandboxHandle;
};

/**
 * The tools plus their approval state for one turn. `close` releases
 * per-turn resources (listeners, subscriptions) when the turn ends.
 */
export type HostToolSet = {
	tools: ToolSet;
	/** Per-tool approval state, keyed by tool name. */
	toolApproval: Record<string, ToolApprovalStatus>;
	close(): Promise<void>;
};

/** Builds the tool set the agent gets for one turn. */
export interface HostToolRegistry {
	build(context: HostToolContext): Promise<HostToolSet>;
}
