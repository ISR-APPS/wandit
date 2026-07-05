export interface RedisConnectionOptions {
	commandTimeout?: number;
	host: string;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: number | null;
	password?: string;
	port: number;
	tls?: Record<string, never>;
	username?: string;
}

interface CreateRedisConnectionOptionsInput {
	commandTimeout?: number;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: number | null;
}

export function createRedisConnectionOptions(
	redisUrl: string,
	options: CreateRedisConnectionOptionsInput = {},
): RedisConnectionOptions {
	const url = new URL(redisUrl);

	return {
		commandTimeout: options.commandTimeout,
		host: url.hostname,
		lazyConnect: options.lazyConnect,
		maxRetriesPerRequest: options.maxRetriesPerRequest ?? null,
		password: url.password || undefined,
		port: Number(url.port || 6379),
		tls: url.protocol === "rediss:" ? {} : undefined,
		username: url.username || undefined,
	};
}
