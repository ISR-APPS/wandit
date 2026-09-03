import { type SQL, sql } from "@wandit/db";

import type { Database } from "../../../../infrastructure/database/database.constants";

type ExportedSnapshotRow = {
	snapshot_id: string;
};

export type AdminReadSnapshotClient = Pick<Database, "execute">;

export const READ_ONLY_REPEATABLE_READ = {
	accessMode: "read only" as const,
	isolationLevel: "repeatable read" as const,
};

const poolSnapshotQueues = new WeakMap<object, Promise<void>>();

// PostgreSQL only permits SET TRANSACTION SNAPSHOT before a transaction's
// first query. Each execute therefore gets a dedicated transaction while the
// exporter stays open, allowing the pool to run statements concurrently over
// one page-wide snapshot. Snapshot batches are serialized per pool so
// concurrent requests cannot fill the pool with exporters and starve every
// worker transaction.
export async function withAdminReadSnapshot<Result>(
	db: Database,
	action: (client: AdminReadSnapshotClient) => Promise<Result>,
): Promise<Result> {
	const poolKey =
		typeof db.$client === "object" && db.$client !== null ? db.$client : db;
	const previous = poolSnapshotQueues.get(poolKey) ?? Promise.resolve();
	let releaseQueue: () => void = () => undefined;
	const queueTurn = new Promise<void>((resolve) => {
		releaseQueue = resolve;
	});
	const queueTail = previous.then(() => queueTurn);
	poolSnapshotQueues.set(poolKey, queueTail);
	await previous;

	try {
		return await runAdminReadSnapshot(db, action);
	} finally {
		releaseQueue();
		if (poolSnapshotQueues.get(poolKey) === queueTail) {
			poolSnapshotQueues.delete(poolKey);
		}
	}
}

async function runAdminReadSnapshot<Result>(
	db: Database,
	action: (client: AdminReadSnapshotClient) => Promise<Result>,
): Promise<Result> {
	return db.transaction(async (exporter) => {
		const exported = await exporter.execute<ExportedSnapshotRow>(sql`
			select pg_export_snapshot() as snapshot_id
		`);
		const snapshotId = exported.rows[0]?.snapshot_id;
		if (!snapshotId) {
			throw new Error("PostgreSQL did not return an exported snapshot ID");
		}

		const activeTransactions = new Set<Promise<unknown>>();
		const client = {
			execute: ((query: SQL) => {
				const request = db.transaction(async (transaction) => {
					await transaction.execute(
						sql.raw(
							`set transaction snapshot '${snapshotId.replaceAll("'", "''")}'`,
						),
					);
					return transaction.execute(query);
				}, READ_ONLY_REPEATABLE_READ);

				activeTransactions.add(request);
				void request.then(
					() => activeTransactions.delete(request),
					() => activeTransactions.delete(request),
				);
				return request;
			}) as Database["execute"],
		} satisfies AdminReadSnapshotClient;

		try {
			return await action(client);
		} finally {
			// Promise.all rejects on the first failed statement, but the remaining
			// transactions still need the exported snapshot until they settle.
			while (activeTransactions.size > 0) {
				await Promise.allSettled([...activeTransactions]);
			}
		}
	}, READ_ONLY_REPEATABLE_READ);
}
