import { z } from "zod";

const httpOriginSchema = z
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
