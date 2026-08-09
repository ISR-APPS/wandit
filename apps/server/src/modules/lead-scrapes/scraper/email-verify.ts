/**
 * Lightweight email verification: does the domain publish MX records?
 *
 * Deliberately NOT an SMTP handshake — mailbox-level probes are slow, get
 * the sender IP greylisted, and big providers answer accept-all anyway. An
 * MX lookup catches the real-world failure mode for scraped emails: typo'd
 * or dead domains. Plain functions, NO NestJS (used by the Trigger task).
 */
import { resolveMx } from "node:dns/promises";

const MX_TIMEOUT_MS = 4_000;

/**
 * Checks every unique domain once (a 200-lead scrape usually holds far fewer
 * distinct domains) and returns email → verified. Lookup failures count as
 * unverified, never as errors.
 */
export async function verifyEmailsByMx(
	emails: readonly string[],
): Promise<Map<string, boolean>> {
	const domains = new Set<string>();

	for (const email of emails) {
		const domain = domainOf(email);

		if (domain) {
			domains.add(domain);
		}
	}

	const domainResults = new Map<string, boolean>();

	await Promise.all(
		[...domains].map(async (domain) => {
			domainResults.set(domain, await hasMxRecords(domain));
		}),
	);

	const results = new Map<string, boolean>();

	for (const email of emails) {
		const domain = domainOf(email);

		results.set(email, domain ? (domainResults.get(domain) ?? false) : false);
	}

	return results;
}

function domainOf(email: string): string | null {
	const domain = email.split("@")[1]?.toLowerCase().trim();

	return domain?.includes(".") ? domain : null;
}

async function hasMxRecords(domain: string): Promise<boolean> {
	try {
		const records = await withTimeout(resolveMx(domain), MX_TIMEOUT_MS);

		// RFC 7505 null MX ("." exchange) is an explicit "this domain accepts
		// no mail" — the opposite of verified.
		return records.some(
			(record) => record.exchange !== "" && record.exchange !== ".",
		);
	} catch {
		// NXDOMAIN, no MX, DNS timeout — all mean "cannot verify".
		return false;
	}
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`DNS lookup timed out after ${ms}ms`)),
			ms,
		);

		promise
			.then((value) => {
				clearTimeout(timer);
				resolve(value);
			})
			.catch((error) => {
				clearTimeout(timer);
				reject(error);
			});
	});
}
