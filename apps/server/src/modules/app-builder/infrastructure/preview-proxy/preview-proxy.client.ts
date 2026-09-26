/**
 * Calls the preview-proxy Worker from the API (WANDIT-196). The device
 * session start mints a phone link with a phone preview token, then asks
 * Metro for its status through that link. It uses `fetch`; the web app of
 * WANDIT-193 makes the same mint call from the browser.
 */
import { Injectable, Logger } from "@nestjs/common";
import {
	PHONE_LINK_PATH,
	type PhonePreviewLinkResponse,
	phonePreviewLinkResponseSchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

// One Worker round trip; the Worker answers from KV or Metro in well under this.
const REQUEST_TIMEOUT_MS = 10_000;

/** The two Worker calls of the device session start. */
@Injectable()
export class PreviewProxyClient {
	private readonly logger = new Logger(PreviewProxyClient.name);

	/**
	 * POSTs the phone preview `token` to the mint route on the run host of
	 * `previewUrl`. Throws on a non-2xx answer or a body that does not parse.
	 */
	async mintPhoneLink(
		previewUrl: string,
		token: string,
	): Promise<PhonePreviewLinkResponse> {
		const response = await fetch(new URL(PHONE_LINK_PATH, previewUrl), {
			body: token,
			method: "POST",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new Error(`Phone link mint failed with HTTP ${response.status}`);
		}
		return phonePreviewLinkResponseSchema.parse(await response.json());
	}

	/**
	 * True when Metro answers `packager-status:running` on `/status` through
	 * the phone host of `expoUrl`. A network failure or a timeout answers false.
	 */
	async isMetroRunning(expoUrl: string): Promise<boolean> {
		const statusUrl = new URL("/status", expoUrl.replace(/^exps:/, "https:"));
		try {
			const response = await fetch(statusUrl, {
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			return (
				response.ok &&
				(await response.text()).includes("packager-status:running")
			);
		} catch (error) {
			// A dead or booting sandbox is a normal answer here, not a failure.
			this.logger.warn("preview-proxy.metro-status.failed", {
				error: getErrorMessage(error),
			});
			return false;
		}
	}
}
