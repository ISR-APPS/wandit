import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { SupportChatIdentityResponse } from "@wandit/contracts";
import { env } from "@wandit/env/server";

@Injectable()
export class SupportService {
	// Chatwoot identity validation: HMAC-SHA256 of the contact identifier
	// with the website-inbox token, hex digest. The token stays server-side;
	// the browser only ever sees the resulting hash.
	chatIdentity(user: AuthUser): SupportChatIdentityResponse {
		return {
			identifier: user.id,
			identifierHash: signChatIdentifier(user.id, env.CHATWOOT_HMAC_TOKEN),
			name: user.name ?? null,
			email: user.email ?? null,
			avatarUrl: user.image ?? null,
		};
	}
}

export function signChatIdentifier(
	identifier: string,
	hmacToken: string | undefined,
): string | null {
	if (!hmacToken) {
		return null;
	}
	return createHmac("sha256", hmacToken).update(identifier).digest("hex");
}
