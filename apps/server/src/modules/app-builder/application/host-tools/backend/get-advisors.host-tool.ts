/**
 * The `get_advisors` host tool of the builder turn (WANDIT-186).
 * `BuilderHostToolRegistry` builds it per turn. It answers the findings of
 * `AdvisorsService`: the Supabase security and performance advisors plus
 * the wandit RLS check on `public`.
 */
import {
	type GetAdvisorsToolOutput,
	getAdvisorsToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import { AdvisorsService } from "../../services/advisors.service";
import { type BackendToolDeps, runBackendTool } from "./backend-tool-deps";

/** `get_advisors`: the agent calls it after each migration and fixes every error. */
export function createGetAdvisorsTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<Record<string, never>, GetAdvisorsToolOutput> {
	return tool({
		description:
			"Run the Supabase security and performance advisors plus the wandit RLS " +
			"check on the app's database. It answers `findings` with the level " +
			"`error` or `warn`. Call it after every migration. Fix every `error` " +
			"before the turn ends, then call it again.",
		inputSchema: getAdvisorsToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{
					input,
					inputSchema: getAdvisorsToolInputSchema,
					tool: "get_advisors",
				},
				async ({ backend, client }): Promise<GetAdvisorsToolOutput> => ({
					findings: await new AdvisorsService(client).run(backend),
					status: "ok",
				}),
			),
	});
}
