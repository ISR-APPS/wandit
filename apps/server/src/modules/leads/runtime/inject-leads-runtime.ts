/**
 * Called by the publish pipeline's HTML transform (slice 0) as one more
 * html→html step, alongside pixel injection.
 *
 * Plain exported functions, NO NestJS DI on purpose (precedent: stampHtml) —
 * the Nest publish path and Trigger.dev tasks share this module.
 */
import { leadsRoutes } from "@wandit/contracts";

import { buildLeadsRuntimeScript } from "./leads-runtime-script";

export const LEADS_RUNTIME_SCRIPT_ID = "wandit-leads-runtime";

/**
 * Insert the leads runtime immediately before the LAST `</body>`
 * (case-insensitive); with no body close tag, append at the end — same
 * strategy as the preview-editor injection. Idempotent: a document already
 * carrying the script id is returned unchanged.
 */
export function injectLeadsRuntime(
	html: string,
	options: { captureUrl: string },
): string {
	if (html.includes(`id="${LEADS_RUNTIME_SCRIPT_ID}"`)) return html;

	const block = `<script id="${LEADS_RUNTIME_SCRIPT_ID}">${buildLeadsRuntimeScript(options)}</script>`;
	const index = html.toLowerCase().lastIndexOf("</body>");

	if (index === -1) return html + block;

	return html.slice(0, index) + block + html.slice(index);
}

/**
 * Absolute capture URL baked into the published page: the public,
 * unauthenticated endpoint addressed by the project's unguessable
 * publicFormId (leadsRoutes.capture).
 */
export function buildLeadsCaptureUrl(
	apiOrigin: string,
	publicFormId: string,
): string {
	return apiOrigin.replace(/\/+$/, "") + leadsRoutes.capture(publicFormId);
}
