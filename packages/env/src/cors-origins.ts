import { z } from "zod";

export const httpOriginSchema = z
	.url()
	.superRefine((value, context) => {
		const parsed = new URL(value);
		const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
		const isOriginOnly = parsed.href === `${parsed.origin}/`;

		if (!isHttp || !isOriginOnly) {
			context.addIssue({
				code: "custom",
				message: "Each CORS origin must be an HTTP(S) URL origin",
			});
		}

		if (parsed.hostname.includes("*")) {
			context.addIssue({
				code: "custom",
				message:
					"Each CORS origin hostname must not contain wildcard characters",
			});
		}
	})
	.transform((value) => new URL(value).origin);

export const corsExtraOriginsSchema = z
	.string()
	.optional()
	.transform((value) =>
		(value ?? "")
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0),
	)
	.pipe(z.array(httpOriginSchema));

export function corsWebOrigins(
	canonicalOrigin: string,
	extraOrigins: readonly string[] | undefined,
): string[] {
	return [
		canonicalOrigin,
		...(Array.isArray(extraOrigins) ? extraOrigins : []),
	];
}

export function allowedCorsWebOrigin(
	origin: unknown,
	canonicalOrigin: string,
	extraOrigins: readonly string[] | undefined,
): string | undefined {
	return typeof origin === "string" &&
		corsWebOrigins(canonicalOrigin, extraOrigins).includes(origin)
		? origin
		: undefined;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The Expo web / Metro dev origin, trusted only while the API itself runs on
 * localhost. Better Auth's trustedOrigins and the API's cross-site write
 * guard both use this, so the two lists never drift apart.
 */
export function expoDevOrigins(apiUrl: string): string[] {
	return LOCAL_HOSTNAMES.has(new URL(apiUrl).hostname)
		? ["http://localhost:8081"]
		: [];
}
