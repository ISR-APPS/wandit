/**
 * Downloads one file from a URL that an unknown web page gives. Guards against SSRF.
 * The site capture of the app builder calls `fetchPublicBytes`.
 * The publish preflight (`sites/domain/asset-validator.ts`) calls `isPublicAddress`.
 * Calls undici `fetch` through an `Agent` that checks each DNS answer.
 */
import { lookup } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import type { ReadableStream } from "node:stream/web";
import {
	Agent,
	type Response as UndiciResponse,
	fetch as undiciFetch,
} from "undici";

/** Limits of one download. The caller sets them for each kind of file. */
export type PublicFetchLimits = {
	/** Largest body that the download keeps, in bytes. */
	maxBytes: number;
	/** Time for the full download, in milliseconds. It includes all redirects and the body. */
	timeoutMs: number;
	/** Accepted content types, in lower case and without parameters. Example: `image/png`. */
	allowedMediaTypes: readonly string[];
};

/** Result of one download. `refused` never throws, so one bad file does not stop a capture. */
export type PublicFetchOutcome =
	| {
			status: "ok";
			bytes: Uint8Array;
			/** Content type of the response, in lower case and without parameters. */
			mediaType: string;
	  }
	| {
			status: "refused";
			reason:
				| "not_https"
				| "private_address"
				| "too_many_redirects"
				| "http_status"
				| "media_type"
				| "too_large"
				| "network";
	  };

type RefusalReason = Extract<
	PublicFetchOutcome,
	{ status: "refused" }
>["reason"];

const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The DNS hook gives this error. The `catch` in `fetchPublicBytes` reads it as `private_address`. */
class PrivateAddressError extends Error {}

// Security check: the hook sees the addresses that the socket uses.
// A DNS name that changes to a private address after a first check (DNS rebinding) fails here.
const lookupPublicAddress: LookupFunction = (hostname, options, callback) => {
	lookup(hostname, options, (error, address, family) => {
		// Node gives a list when the caller sets `all: true`, and one string in other cases.
		const addresses = Array.isArray(address)
			? address.map((entry) => entry.address)
			: [address];

		if (!error && !addresses.every(isPublicAddress)) {
			callback(new PrivateAddressError(hostname), address, family);
			return;
		}

		callback(error, address, family);
	});
};

// Must be the `Agent` of the same undici package as `undiciFetch`.
// The built-in `fetch` throws with an npm `Agent` (see ai-chat/agent/gateway-fetch.ts).
const publicAddressAgent = new Agent({
	connect: { lookup: lookupPublicAddress },
});

/**
 * Downloads one file whose URL comes from an unknown web page.
 * Sends no cookie and no custom header. Follows at most 3 redirects and checks each one.
 * Throws only when `abortSignal` aborts. `fetchImpl` is the test seam, and production passes nothing.
 */
export async function fetchPublicBytes(
	url: string,
	limits: PublicFetchLimits,
	abortSignal: AbortSignal | undefined,
	fetchImpl: typeof undiciFetch = undiciFetch,
): Promise<PublicFetchOutcome> {
	const timeoutSignal = AbortSignal.timeout(limits.timeoutMs);
	const signal = abortSignal
		? AbortSignal.any([abortSignal, timeoutSignal])
		: timeoutSignal;
	let target = URL.canParse(url) ? new URL(url) : null;

	try {
		for (
			let redirectCount = 0;
			redirectCount <= MAX_REDIRECTS;
			redirectCount += 1
		) {
			// Security check: each hop must be https, and an IP host must be public.
			// Node does not call the DNS hook for an IP host, so the hook cannot do this check.
			if (target?.protocol !== "https:") {
				return refused("not_https");
			}

			const host = target.hostname.replace(/^\[|\]$/g, "");

			if (isIP(host) !== 0 && !isPublicAddress(host)) {
				return refused("private_address");
			}

			const response = await fetchImpl(target, {
				dispatcher: publicAddressAgent,
				redirect: "manual",
				signal,
			});
			const location = response.headers.get("location");

			if (REDIRECT_STATUSES.has(response.status) && location !== null) {
				// An unread body keeps the socket open.
				await response.body?.cancel();
				target = URL.canParse(location, target.href)
					? new URL(location, target.href)
					: null;
				continue;
			}

			return await readResponse(response, limits);
		}

		return refused("too_many_redirects");
	} catch (error) {
		// The caller stopped the work. The caller must see its abort, not a refused file.
		if (abortSignal?.aborted) {
			throw error;
		}

		// undici wraps the error of the DNS hook in a `TypeError("fetch failed")`.
		if (error instanceof Error && error.cause instanceof PrivateAddressError) {
			return refused("private_address");
		}

		// A timeout, a DNS failure, a TLS failure, or a broken body. The file is optional for the caller.
		return refused("network");
	}
}

async function readResponse(
	response: UndiciResponse,
	limits: PublicFetchLimits,
): Promise<PublicFetchOutcome> {
	const contentType = response.headers.get("content-type") ?? "";
	// `Image/PNG; charset=binary` becomes `image/png`.
	const mediaType = (contentType.split(";")[0] ?? "").trim().toLowerCase();
	const refusalReason = !response.ok
		? "http_status"
		: !limits.allowedMediaTypes.includes(mediaType)
			? "media_type"
			: null;

	if (refusalReason) {
		await response.body?.cancel();

		return refused(refusalReason);
	}

	// undici types the chunks as `any`. The Fetch standard gives each chunk as a `Uint8Array`.
	const body: ReadableStream<Uint8Array> | null = response.body;
	const chunks: Uint8Array[] = [];
	let byteCount = 0;

	// The loop reads the stream and does not trust `content-length`, which a server can omit or fake.
	// The `return` in the loop cancels the stream, so the rest of a large body never arrives.
	for await (const chunk of body ?? []) {
		byteCount += chunk.byteLength;

		if (byteCount > limits.maxBytes) {
			return refused("too_large");
		}

		chunks.push(chunk);
	}

	return { status: "ok", bytes: Buffer.concat(chunks), mediaType };
}

function refused(reason: RefusalReason): PublicFetchOutcome {
	return { status: "refused", reason };
}

/**
 * True for an address on the public internet. `ip` must be an IPv4 or IPv6 literal without brackets.
 * False for loopback, private, link-local, carrier NAT, and multicast ranges.
 */
export function isPublicAddress(ip: string): boolean {
	return isIP(ip) === 4 ? isPublicIpv4(ip) : isPublicIpv6(ip);
}

function isPublicIpv4(ip: string): boolean {
	const [a = 0, b = 0] = ip.split(".").map(Number);

	if (a === 0 || a === 10 || a === 127) {
		return false;
	}

	if (a === 169 && b === 254) {
		return false;
	}

	if (a === 172 && b >= 16 && b <= 31) {
		return false;
	}

	if (a === 192 && b === 168) {
		return false;
	}

	// 100.64.0.0/10 carrier-grade NAT.
	if (a === 100 && b >= 64 && b <= 127) {
		return false;
	}

	// Multicast, reserved, and broadcast.
	return a < 224;
}

function isPublicIpv6(ip: string): boolean {
	const lower = ip.toLowerCase();
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);

	if (mapped?.[1]) {
		return isPublicIpv4(mapped[1]);
	}

	// `new URL` writes an IPv4-mapped host in hex: `[::ffff:127.0.0.1]` becomes `::ffff:7f00:1`.
	const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);

	if (mappedHex?.[1] && mappedHex[2]) {
		const high = Number.parseInt(mappedHex[1], 16);
		const low = Number.parseInt(mappedHex[2], 16);

		// Each hex group holds two bytes of the IPv4 address.
		return isPublicIpv4(
			`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
		);
	}

	if (lower === "::" || lower === "::1") {
		return false;
	}

	// fc00::/7 unique-local and fe80::/10 link-local.
	return !/^f[cd]/.test(lower) && !/^fe[89ab]/.test(lower);
}
