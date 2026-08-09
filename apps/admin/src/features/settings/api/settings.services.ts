import type {
	AdminWebhookReplayResponse,
	PatchProductSettingsBody,
} from "@wandit/contracts";
import {
	adminRoutes,
	adminWebhookReplayResponseSchema,
	patchProductSettingsBodySchema,
	settingsRoutes,
} from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import {
	mapProductSettingsDto,
	type ProductSettingsView,
} from "./settings.dto";

export async function getProductSettings(): Promise<ProductSettingsView> {
	const payload = await apiGet<unknown>(settingsRoutes.admin);

	return mapProductSettingsDto(payload);
}

export async function updateProductSettings(
	input: PatchProductSettingsBody,
): Promise<ProductSettingsView> {
	const body = patchProductSettingsBodySchema.parse(input);
	const payload = await apiPatch<unknown>(settingsRoutes.admin, body);

	return mapProductSettingsDto(payload);
}

export async function replayBillingWebhook(
	eventId: string,
): Promise<AdminWebhookReplayResponse> {
	const payload = await apiPost<unknown>(adminRoutes.webhookReplay(eventId));

	return adminWebhookReplayResponseSchema.parse(payload);
}
