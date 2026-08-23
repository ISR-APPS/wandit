// Load the repository's standard .env search before reading process.env. The
// task assertions deliberately read runtime values directly so shared schema
// defaults cannot hide missing deployment-specific settings. The documented
// fallback origin is the sole exception because its schema default is safe.
import { env } from "@wandit/env/server";

type NamecomEnvironment = "production" | "sandbox";

export type DatabaseTaskConfiguration = {
	databaseUrl: string;
};

export type DomainApexZoneOptions = {
	apexZoneEnabled: boolean;
	fallbackOrigin: string;
};

export type DomainConfigurationTaskConfiguration = DatabaseTaskConfiguration &
	DomainApexZoneOptions & {
		cloudflareApiToken: string;
		cloudflareKvNamespaceId: string;
		cloudflareZoneId: string;
	};

export type DomainPurchaseTaskConfiguration =
	DomainConfigurationTaskConfiguration & {
		namecomApiToken: string;
		namecomEnvironment: NamecomEnvironment;
		namecomUsername: string;
		stripeSecretKey: string;
	};

export type DomainRegistrarSyncTaskConfiguration = DatabaseTaskConfiguration & {
	namecomApiToken: string;
	namecomEnvironment: NamecomEnvironment;
	namecomUsername: string;
};

export type OrderRefundTaskConfiguration = DatabaseTaskConfiguration & {
	stripeSecretKey: string;
};

/** Assert the one value shared by every domain/refund Trigger task. */
export function assertDatabaseConfiguration(): DatabaseTaskConfiguration {
	return {
		databaseUrl: requiredValue("DATABASE_URL"),
	};
}

/**
 * Fail before a purchase mutates DB state or contacts Name.com. Refund
 * readiness is part of purchase readiness because registrar spend must never
 * begin unless a later terminal path can return the captured payment. Only the
 * fallback origin may use its safe shared default; every other value stays strict.
 */
export function assertDomainPurchaseConfiguration(): DomainPurchaseTaskConfiguration {
	return {
		...assertDomainConfigurationConfiguration(),
		...assertNamecomConfiguration(),
		stripeSecretKey: requiredValue("STRIPE_SECRET_KEY"),
	};
}

/**
 * Assert only the values needed by BYO-domain verification and activation
 * (DB + the three Cloudflare values; no registrar, no Stripe) and read the
 * apex zone options the best-effort external apex pass runs with.
 */
export function assertDomainConfigurationConfiguration(): DomainConfigurationTaskConfiguration {
	return {
		...assertDatabaseConfiguration(),
		...domainApexZoneOptions(),
		cloudflareApiToken: requiredValue("CLOUDFLARE_API_TOKEN"),
		cloudflareKvNamespaceId: requiredValue("CLOUDFLARE_KV_NAMESPACE_ID"),
		cloudflareZoneId: requiredValue("CLOUDFLARE_ZONE_ID_WANDIT_APP"),
	};
}

/**
 * Apex zone options shared by the purchase and configuration tasks. Neither
 * value is a preflight failure: the kill switch defaults to on and the
 * fallback origin has a safe schema default.
 */
export function domainApexZoneOptions(): DomainApexZoneOptions {
	return {
		apexZoneEnabled: domainApexZoneEnabled(),
		fallbackOrigin: domainFallbackOrigin(),
	};
}

/** Assert refund configuration at the start of every durable runner attempt. */
export function assertOrderRefundConfiguration(): OrderRefundTaskConfiguration {
	return {
		...assertDatabaseConfiguration(),
		stripeSecretKey: requiredValue("STRIPE_SECRET_KEY"),
	};
}

/** Assert the database and registrar pairing before the weekly sweep. */
export function assertDomainRegistrarSyncConfiguration(): DomainRegistrarSyncTaskConfiguration {
	return {
		...assertDatabaseConfiguration(),
		...assertNamecomConfiguration(),
	};
}

function assertNamecomConfiguration(): Omit<
	DomainRegistrarSyncTaskConfiguration,
	"databaseUrl"
> {
	const environment = namecomEnvironment();
	const username = requiredValue("NAMECOM_USERNAME");
	const sandboxUsername = username.endsWith("-test");

	if (
		(environment === "sandbox" && !sandboxUsername) ||
		(environment === "production" && sandboxUsername)
	) {
		throw new Error(
			`NAMECOM_USERNAME does not match NAMECOM_ENVIRONMENT=${environment}`,
		);
	}

	return {
		namecomApiToken: requiredValue("NAMECOM_API_TOKEN"),
		namecomEnvironment: environment,
		namecomUsername: username,
	};
}

function namecomEnvironment(): NamecomEnvironment {
	const value = requiredValue("NAMECOM_ENVIRONMENT");

	if (value === "production" || value === "sandbox") {
		return value;
	}

	throw new Error("NAMECOM_ENVIRONMENT must be exactly sandbox or production");
}

/**
 * Kill switch for the apex zone step of purchased and external domains
 * (default on). It is not a preflight failure: "false" simply keeps the
 * registrar URL forwarding for a purchased apex and the www-only records for
 * an external one. CLOUDFLARE_ACCOUNT_ID is likewise not asserted here — the
 * step is best-effort and records a missing account id as `dns.apexError`.
 */
function domainApexZoneEnabled(): boolean {
	const value = process.env.DOMAINS_APEX_ZONE_ENABLED?.trim().toLowerCase();

	if (value === "true" || value === "false") {
		return value === "true";
	}

	return env.DOMAINS_APEX_ZONE_ENABLED !== false;
}

function domainFallbackOrigin(): string {
	const value = process.env.DOMAINS_FALLBACK_ORIGIN;

	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	return env.DOMAINS_FALLBACK_ORIGIN;
}

function requiredValue(name: string): string {
	const value = process.env[name];

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required for this Trigger task`);
	}

	return value;
}
