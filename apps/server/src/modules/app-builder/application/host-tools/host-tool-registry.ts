/**
 * Host-tool registry for the builder turn (WANDIT-169 keeps real tools
 * out of scope). `builder-turn.runtime.ts` calls `build` after the
 * sandbox exists and closes the result after the turn.
 */
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";

/**
 * No host tools: `tools` and `toolApproval` are empty, `close` is a
 * no-op. Real tools land with WANDIT-169.
 */
export class EmptyHostToolRegistry implements HostToolRegistry {
	build(_context: HostToolContext): Promise<HostToolSet> {
		return Promise.resolve({
			close: async () => {},
			toolApproval: {},
			tools: {},
		});
	}
}
