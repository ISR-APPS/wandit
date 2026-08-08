import { llmGenerationCaptureFromError } from "../../../metering/domain/gateway-metering";
import type { CapturedGeneration } from "../../../metering/domain/metering";

const GENERATION_CAPTURE_ATTEMPTS = 3;

type CaptureGeneration = (capture: CapturedGeneration) => Promise<unknown>;

export type GenerationCaptureBuffer = {
	capture: (capture: CapturedGeneration) => Promise<void>;
	flush: () => Promise<void>;
};

/**
 * Failed provider calls expose their generation id on the error rather than
 * through `onStepEnd` (Vercel puts it in the error body; the OpenRouter model
 * wrapper tags it). Put that evidence through the same durable retry buffer
 * as successful steps before the caller decides whether a hold is refundable.
 */
export async function captureGatewayGenerationError(
	buffer: GenerationCaptureBuffer,
	error: unknown,
): Promise<boolean> {
	const capture = llmGenerationCaptureFromError(error);

	if (!capture) {
		return false;
	}

	await buffer.capture(capture);
	return true;
}

/**
 * Keeps failed step captures alive beyond AI SDK callbacks.
 *
 * AI SDK deliberately swallows errors thrown by `onStepEnd`. Each capture is
 * therefore retried in the callback, retained by identity when those attempts
 * fail, and retried again by `flush` after the agent resolves. A failed flush
 * rejects only after every pending capture has had its bounded retry window.
 */
export function createGenerationCaptureBuffer(
	captureGeneration: CaptureGeneration,
): GenerationCaptureBuffer {
	const pending = new Set<CapturedGeneration>();

	const captureWithRetry = async (
		capture: CapturedGeneration,
	): Promise<void> => {
		let lastError: unknown;

		for (let attempt = 0; attempt < GENERATION_CAPTURE_ATTEMPTS; attempt += 1) {
			try {
				const captured = await captureGeneration(capture);

				if (captured == null) {
					throw new Error("AI Gateway generation id is missing");
				}

				return;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError;
	};

	return {
		async capture(capture) {
			pending.add(capture);

			try {
				await captureWithRetry(capture);
				pending.delete(capture);
			} catch {
				// The SDK would swallow this callback failure. Keep the exact
				// metadata/usage pair for the mandatory post-agent flush instead.
			}
		},
		async flush() {
			let firstFailure: { error: unknown } | null = null;

			for (const capture of [...pending]) {
				try {
					await captureWithRetry(capture);
					pending.delete(capture);
				} catch (error) {
					firstFailure ??= { error };
				}
			}

			if (firstFailure) {
				throw firstFailure.error;
			}
		},
	};
}
