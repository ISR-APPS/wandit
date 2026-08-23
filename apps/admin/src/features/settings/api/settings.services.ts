import type {
	AdminWebhookReplayResponse,
	BackfillSignupGrantsBody,
	BackfillSignupGrantsResponse,
	PatchProductSettingsBody,
} from "@wandit/contracts";
import {
	adminRoutes,
	adminWebhookReplayResponseSchema,
	backfillSignupGrantsBodySchema,
	backfillSignupGrantsResponseSchema,
	patchProductSettingsBodySchema,
	settingsRoutes,
} from "@wandit/contracts";

import { apiGet, apiPatch, apiPost } from "@/lib/api-client";

import {
	mapProductSettingsDto,
	mapProductSettingsUpdateDto,
	type ProductSettingsUpdateView,
	type ProductSettingsView,
} from "./settings.dto";

export async function getProductSettings(): Promise<ProductSettingsView> {
	const payload = await apiGet<unknown>(settingsRoutes.admin);

	return mapProductSettingsDto(payload);
}

export async function updateProductSettings(
	input: PatchProductSettingsBody,
): Promise<ProductSettingsUpdateView> {
	const body = patchProductSettingsBodySchema.parse(input);
	const payload = await apiPatch<unknown>(settingsRoutes.admin, body);

	return mapProductSettingsUpdateDto(payload);
}

export async function backfillSignupGrants(
	input: BackfillSignupGrantsBody,
): Promise<BackfillSignupGrantsResponse> {
	const body = backfillSignupGrantsBodySchema.parse(input);
	const payload = await apiPost<unknown>(
		settingsRoutes.signupGrantBackfill,
		body,
	);

	return backfillSignupGrantsResponseSchema.parse(payload);
}

export async function replayBillingWebhook(
	eventId: string,
): Promise<AdminWebhookReplayResponse> {
	const payload = await apiPost<unknown>(adminRoutes.webhookReplay(eventId));

	return adminWebhookReplayResponseSchema.parse(payload);
}
