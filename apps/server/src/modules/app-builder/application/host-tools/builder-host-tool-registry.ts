/**
 * The real `HostToolRegistry` of the builder turn (WANDIT-169).
 * `builder-turn.task.ts` injects it into the runtime; `build` assembles
 * the per-turn tool set the harness hands to the agent. The tools run in
 * the task process, so platform and partner secrets stay out of the
 * sandbox.
 */
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";
import {
	createGenerateImageTool,
	type GenerateImageHostToolDeps,
} from "./generate-image.host-tool";

/**
 * Assembles one turn's host tools. Today the set is `generate_image`;
 * connector tools land in the follow-up when the Nest container exists.
 */
export class BuilderHostToolRegistry implements HostToolRegistry {
	constructor(private readonly deps: GenerateImageHostToolDeps) {}

	build(context: HostToolContext): Promise<HostToolSet> {
		return Promise.resolve({
			// Nothing to release yet: the connector clients that need a
			// close land in the connector follow-up issue.
			close: async () => {},
			toolApproval: {
				generate_image: "not-applicable",
			},
			tools: {
				generate_image: createGenerateImageTool(this.deps, context),
			},
		});
	}
}
