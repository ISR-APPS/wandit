// Load the repository's standard .env search before reading process.env. The
// task assertions deliberately read the runtime values directly so defaults in
// the shared env schema cannot hide a missing deployment-specific setting.
import "@wandit/env/server";

type NamecomEnvironment = "production" | "sandbox";

export type DatabaseTaskConfiguration = {
	databaseUrl: string;
};

export type DomainConfigurationTaskConfiguration = DatabaseTaskConfiguration & {
	cloudflareApiToken: string;
	cloudflareKvNamespaceId: string;
	cloudflareZoneId: string;
};

export type DomainPurchaseTaskConfiguration =
	DomainConfigurationTaskConfiguration & {
		fallbackOrigin: string;
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
 * begin unless a later terminal path can return the captured payment.
 */
export function assertDomainPurchaseConfiguration(): DomainPurchaseTaskConfiguration {
	return {
		...assertDomainConfigurationConfiguration(),
		...assertNamecomConfiguration(),
		fallbackOrigin: requiredValue("DOMAINS_FALLBACK_ORIGIN"),
		stripeSecretKey: requiredValue("STRIPE_SECRET_KEY"),
	};
}

/** Assert only the values needed by BYO-domain verification and activation. */
export function assertDomainConfigurationConfiguration(): DomainConfigurationTaskConfiguration {
	return {
		...assertDatabaseConfiguration(),
		cloudflareApiToken: requiredValue("CLOUDFLARE_API_TOKEN"),
		cloudflareKvNamespaceId: requiredValue("CLOUDFLARE_KV_NAMESPACE_ID"),
		cloudflareZoneId: requiredValue("CLOUDFLARE_ZONE_ID_WANDIT_APP"),
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

function requiredValue(name: string): string {
	const value = process.env[name];

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${name} is required for this Trigger task`);
	}

	return value;
}
