/**
 * The empty `HostToolRegistry`: no tools, no approvals.
 * `builder-turn.runtime.spec.ts` injects it so the runtime cases run
 * without image billing. The task uses `BuilderHostToolRegistry` from
 * `builder-host-tool-registry.ts`; no Nest module binds this one.
 */
import type {
	HostToolContext,
	HostToolRegistry,
	HostToolSet,
} from "../../domain/ports/host-tools";

/**
 * No host tools: `tools` and `toolApproval` are empty, `close` is a
 * no-op. Use it only as a spec fake.
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
