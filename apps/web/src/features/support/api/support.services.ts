import {
	supportChatIdentityResponseSchema,
	supportRoutes,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";

import type { ChatIdentity } from "./support.dto";

export async function getChatIdentity(): Promise<ChatIdentity> {
	const payload = await ApiService.get<unknown>(supportRoutes.chatIdentity);
	return supportChatIdentityResponseSchema.parse(payload);
}
