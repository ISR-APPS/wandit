import { createDb, sql } from "@wandit/db";
import { subscriptions } from "@wandit/db/schema/billing";

async function main(): Promise<void> {
	const db = createDb();

	try {
		const [result] = await db
			.select({
				total: sql<number>`count(*)::int`,
			})
			.from(subscriptions)
			.where(
				sql`${subscriptions.status} NOT IN ('canceled', 'incomplete_expired')`,
			);
		const total = result?.total ?? 0;

		if (total !== 0) {
			throw new Error(
				`Billing v2 requires zero live subscriptions before first deployment; found ${total}. Stop and apply the grandfathering appendix.`,
			);
		}

		console.log("Billing v2 zero-live-subscriptions assertion passed.");
	} finally {
		await db.$client.end();
	}
}

await main();
