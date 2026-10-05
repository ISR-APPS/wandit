/**
 * Port: one check of the build output before the upload (WANDIT-178).
 * The `publish-app` runtime runs each gate after it reads the output, so a
 * blocked build never reaches Cloudflare. The task wires the secret scan
 * (WANDIT-181) and then the backend gate (WANDIT-190), in that order.
 */
import type { PublishGateFinding } from "@wandit/contracts";

export type { PublishGateFinding };

/** One file of the build output, as the gate reads it. */
export type PublishGateFile = {
	/** Path under the output: `server/<module>` or `client/<asset>`. */
	path: string;
	content: Uint8Array;
};

/**
 * One check. The runtime calls `run` once per publish from source. A gate
 * that cannot run throws; the runtime then fails the publish with
 * `gate_unavailable`.
 */
export interface PublishGate {
	/** Short name for the log line, for example `secret-scan`. */
	readonly id: string;
	run(input: {
		projectId: string;
		buildId: string;
		files: PublishGateFile[];
	}): Promise<PublishGateFinding[]>;
}
