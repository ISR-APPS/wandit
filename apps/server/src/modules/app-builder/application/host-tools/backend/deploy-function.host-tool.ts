/**
 * The `deploy_function` host tool of the builder turn (WANDIT-186).
 * `BuilderHostToolRegistry` builds it per turn. It reads
 * `supabase/functions/<slug>/` from the sandbox, deploys the files through
 * `SupabaseManagementClient.deployFunction`, writes an audit row, and
 * answers the public function URL.
 */
import { posix } from "node:path";

import {
	type DeployFunctionToolInput,
	type DeployFunctionToolOutput,
	deployFunctionToolInputSchema,
	supabaseProjectUrl,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import { type BackendToolDeps, runBackendTool } from "./backend-tool-deps";

// Upper bounds of one function folder. They keep one multipart request and
// the task memory small; a real Edge Function holds a few files.
// LIMIT: the size check runs after each read, so one large file loads whole
// into the task. Upgrade: a file size on `SandboxHandle.listFiles`.
const MAX_FUNCTION_FILES = 50;
const MAX_FUNCTION_BYTES = 5 * 1024 * 1024;

// The file Supabase runs; the agent guide names it too.
const ENTRYPOINT = "index.ts";

/** `deploy_function`: deploys one function folder of the sandbox. */
export function createDeployFunctionTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<DeployFunctionToolInput, DeployFunctionToolOutput> {
	return tool({
		description:
			"Deploy the Supabase Edge Function in `supabase/functions/<slug>/` of " +
			"the project. `slug` uses a-z, 0-9, and -, and starts with a letter. " +
			"The folder holds the entrypoint `index.ts` and at most 50 " +
			"files, 5 MB in total, all in one flat folder: files in other folders " +
			"are not sent. It answers the public function URL. Deploy again after " +
			"each change to the function.",
		inputSchema: deployFunctionToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{
					input,
					inputSchema: deployFunctionToolInputSchema,
					tool: "deploy_function",
				},
				async (
					{ backend, backendId, client },
					{ slug },
				): Promise<DeployFunctionToolOutput> => {
					const folder = `supabase/functions/${slug}`;
					const dir = posix.join(context.sandbox.workspaceDir, folder);
					// LIMIT: one folder level; the Vercel `listFiles` is one readdir.
					// Upgrade: a recursive list on SandboxHandle.
					const entries = await context.sandbox
						.listFiles(dir)
						.catch((error: unknown) => {
							// The Vercel readdir throws for a missing folder; the fake
							// answers an empty list. Both mean "no files".
							deps.logger.warn("host-tool.deploy_function.list-failed", {
								message: getErrorMessage(error),
								projectId: context.projectId,
							});
							return [];
						});
					if (entries.length === 0) {
						return { reason: `${folder}/ has no files`, status: "failed" };
					}
					if (entries.length > MAX_FUNCTION_FILES) {
						return {
							reason: `A function has at most ${MAX_FUNCTION_FILES} files`,
							status: "failed",
						};
					}
					if (
						!entries.some((entry) => posix.relative(dir, entry) === ENTRYPOINT)
					) {
						return {
							reason: `${folder}/${ENTRYPOINT} is missing`,
							status: "failed",
						};
					}

					const files: { path: string; content: Uint8Array }[] = [];
					let totalBytes = 0;
					for (const entry of entries) {
						const path = posix.relative(dir, entry);
						const content = await context.sandbox
							.readFile(entry)
							.catch((error: unknown) => {
								// A folder entry fails the Vercel read; the answer below
								// names the path, so the agent can flatten the folder.
								deps.logger.warn("host-tool.deploy_function.read-failed", {
									message: getErrorMessage(error),
									path,
									projectId: context.projectId,
								});
								return null;
							});
						if (content === null) {
							return {
								reason: `Could not read ${folder}/${path}. Keep the function files in one flat folder`,
								status: "failed",
							};
						}
						totalBytes += content.byteLength;
						if (totalBytes > MAX_FUNCTION_BYTES) {
							return {
								reason: "The function files are larger than 5 MB",
								status: "failed",
							};
						}
						files.push({ content, path });
					}

					const deployed = await client.deployFunction(backend, {
						entrypointPath: ENTRYPOINT,
						files,
						slug,
					});
					await deps.audit.insert({
						action: "backend.function_deployed",
						actorUserId: context.actorUserId,
						metadata: { slug, version: deployed.version },
						organizationId: context.organizationId,
						projectId: context.projectId,
						targetId: backendId,
						targetType: "app_backend",
					});
					return {
						status: "deployed",
						url: `${supabaseProjectUrl(backend.ref)}/functions/v1/${slug}`,
					};
				},
			),
	});
}
