import { publicSettingsSchema, settingsRoutes } from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";

export async function getPublicSettings() {
	const payload = await ApiService.get<unknown>(settingsRoutes.public);

	return publicSettingsSchema.parse(payload);
}
