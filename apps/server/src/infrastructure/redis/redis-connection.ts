export interface RedisConnectionOptions {
	host: string;
	lazyConnect?: boolean;
	maxRetriesPerRequest?: null;
	password?: string;
	port: number;
	tls?: Record<string, never>;
	username?: string;
}

interface CreateRedisConnectionOptionsInput {
	lazyConnect?: boolean;
}

export function createRedisConnectionOptions(
	redisUrl: string,
	options: CreateRedisConnectionOptionsInput = {},
): RedisConnectionOptions {
	const url = new URL(redisUrl);

	return {
		host: url.hostname,
		lazyConnect: options.lazyConnect,
		maxRetriesPerRequest: null,
		password: url.password || undefined,
		port: Number(url.port || 6379),
		tls: url.protocol === "rediss:" ? {} : undefined,
		username: url.username || undefined,
	};
}
