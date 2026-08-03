import type { GenerationCaptureBuffer } from "../modules/ai-chat/agent/site-builder/generation-capture-buffer";

/**
 * A terminal page-build path may settle only after every observed provider
 * generation has been persisted. Returning false deliberately leaves the
 * reservation open for the scheduled recovery task.
 */
export async function flushPageBuildGenerationsForSettlement(
	buffer: GenerationCaptureBuffer | null,
	onFailure: (error: unknown) => void,
): Promise<boolean> {
	try {
		await buffer?.flush();
		return true;
	} catch (error) {
		onFailure(error);
		return false;
	}
}
