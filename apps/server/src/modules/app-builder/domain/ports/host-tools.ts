/**
 * Port: the host-side tool set the agent may call during a turn.
 * `builder-turn.runtime.ts` calls `build` once per turn after the sandbox
 * exists. `BuilderHostToolRegistry` implements it with `generate_image` and
 * `set_theme`, plus `request_network_host` and the backend tools of WANDIT-186
 * (web and mobile) or `add_local_migration` (desktop), or with the Plan Mode
 * tools. AI SDK `ToolSet` only: vendor packages stay out.
 */
import type { BuilderTurnMode } from "@wandit/contracts";
import type { AppThemeFile } from "@wandit/contracts/v2/app-theme";
import type { ToolApprovalStatus as AiToolApprovalStatus, ToolSet } from "ai";

import type { MeteringSubject } from "../../../credits/domain/credit-owner";
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
	/**
	 * Id of the turn's `builder-turn:<turnId>` metering hold, or null when
	 * no hold exists. A paid host tool reserves its child against it.
	 */
	holdEventId: string | null;
	/** Who acted and which pool pays; a paid host tool passes it to `reserve`. */
	subject: MeteringSubject;
	sandbox: SandboxHandle;
	/**
	 * `spec.mode` of the turn. `plan` gets only the tools that ask the user;
	 * `security_scan` gets only the backend reads.
	 */
	mode: BuilderTurnMode;
	/**
	 * `projects.framework`, for example "web-app" or "desktop-app". A desktop
	 * app gets `add_local_migration` and no backend tool.
	 */
	framework: string;
	/** `projects.templateVersion`, for example "web-app@1.1.0". `set_theme` exists from web-app@1.1.0 and desktop-app@1.0.0. */
	templateVersion: string;
	/**
	 * Called after a host tool wrote src/styles/theme.json. The turn-end guard
	 * of the runtime then keeps this file and undoes later writes of the agent.
	 */
	onThemeFileWritten: (file: AppThemeFile) => void;
	/**
	 * The theme.json that the runtime trusts now: the turn-start file or the last host write.
	 * Null when the pre-turn fallback failed. `set_theme` patches it, not the disk file.
	 */
	knownThemeFile: () => AppThemeFile | null;
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
