/**
 * Zod schema of GITHUB_APP_PRIVATE_KEY, the RSA key that signs the GitHub App JWTs (RS256).
 * The server env schema (server.ts) uses it, so a bad key stops the boot.
 * `GithubAppClient` in the server then trusts the value. It uses zod and node:crypto.
 */
import { createPrivateKey, type KeyObject } from "node:crypto";
import { z } from "zod";

/**
 * Accepts an unencrypted RSA PEM: PKCS#1 ("BEGIN RSA PRIVATE KEY", the file
 * GitHub downloads) or PKCS#8. Returns it with real newlines and one final
 * newline. An error names the variable and the cause, never the value.
 */
export const githubAppPrivateKeySchema = z
	.string()
	.transform((value, context) => {
		// A one-line env value stores the newlines as `\n` escapes.
		const pem = (
			value.includes("\n") ? value : value.replaceAll("\\n", "\n")
		).trim();
		let key: KeyObject;
		try {
			key = createPrivateKey({ key: pem, format: "pem" });
		} catch {
			// node:crypto refuses a cut, damaged, or encrypted PEM. Its message is not needed.
			context.addIssue({
				code: "custom",
				message:
					"GITHUB_APP_PRIVATE_KEY does not parse as an unencrypted private key PEM. Quote a multi-line value or use \\n escapes.",
			});
			return z.NEVER;
		}
		if (key.asymmetricKeyType !== "rsa") {
			context.addIssue({
				code: "custom",
				message:
					"GITHUB_APP_PRIVATE_KEY must be an RSA key, because GitHub App JWTs use RS256.",
			});
			return z.NEVER;
		}
		return `${pem}\n`;
	});
