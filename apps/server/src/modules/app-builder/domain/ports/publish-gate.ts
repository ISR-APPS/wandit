/**
 * Port: one check of the build output before the upload (WANDIT-178).
 * The `publish-app` runtime runs each gate after it reads the output, so a
 * blocked build never reaches Cloudflare. No gate exists today: WANDIT-181
 * adds the secret scan and the phishing rules, WANDIT-190 the backend checks.
 */

/** One file of the build output, as the gate reads it. */
export type PublishGateFile = {
	/** Path under the output: `server/<module>` or `client/<asset>`. */
	path: string;
	content: Uint8Array;
};

/** One problem a gate found. */
export type PublishGateFinding = {
	/** `block` stops the publish; `warn` goes to the log only. */
	severity: "block" | "warn";
	/** English text for support. It must not quote a secret value. */
	message: string;
	/** The output path the finding is about, or null for the whole build. */
	path: string | null;
};

/** One check. The runtime calls `run` once per publish from source. */
export interface PublishGate {
	/** Short name for the log line, for example `secret-scan`. */
	readonly id: string;
	run(input: {
		projectId: string;
		buildId: string;
		files: PublishGateFile[];
	}): Promise<PublishGateFinding[]>;
}
