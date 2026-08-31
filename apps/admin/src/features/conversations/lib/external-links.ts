function safeHttpsUrl(value: string): string | null {
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.href : null;
	} catch {
		return null;
	}
}

export function sentryEventUrl(eventId: string | null): string | null {
	const slug = (
		import.meta.env.VITE_SENTRY_ORG_SLUG as string | undefined
	)?.trim();

	if (!slug || !/^[a-z0-9-]+$/i.test(slug) || !eventId) {
		return null;
	}

	return `https://${slug}.sentry.io/issues/?query=id:${encodeURIComponent(eventId)}&statsPeriod=90d`;
}

export function gatewayGenerationUrl(
	gatewayGenerationId: string | null,
): string | null {
	const template = (
		import.meta.env.VITE_ADMIN_GATEWAY_LOGS_URL_TEMPLATE as string | undefined
	)?.trim();

	if (
		!template ||
		!gatewayGenerationId ||
		!template.includes("{generationId}")
	) {
		return null;
	}

	return safeHttpsUrl(
		template.replaceAll(
			"{generationId}",
			encodeURIComponent(gatewayGenerationId),
		),
	);
}
