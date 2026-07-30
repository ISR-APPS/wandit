import { env } from "@wandit/env/server";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

const HEX_TOKEN_PATTERN = /^[0-9a-f]+$/i;

function isLikelyEncrypted(token: string): boolean {
	return (
		token.startsWith("$ba$") ||
		(token.length % 2 === 0 && HEX_TOKEN_PATTERN.test(token))
	);
}

export function encryptToken(token: string): Promise<string> {
	return symmetricEncrypt({
		data: token,
		key: env.BETTER_AUTH_SECRET,
	});
}

export async function decryptToken(token: string): Promise<string> {
	if (!isLikelyEncrypted(token)) {
		return token;
	}

	return symmetricDecrypt({
		data: token,
		key: env.BETTER_AUTH_SECRET,
	});
}
