/**
 * Read and write of the `security_scans` rows. The `builder-turn` runtime
 * calls `insert` at the end of a `security_scan` turn;
 * `SecurityScansController` calls `findLatest` for the Security panel.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { SecurityScanReport } from "@wandit/contracts";
import { desc, eq } from "@wandit/db";
import { securityScans } from "@wandit/db/schema/security-scans";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** The values of one new scan row. */
export type SecurityScanInsert = {
	projectId: string;
	/** The `security_scan` turn; one row per turn. */
	turnId: string;
	/** The user who sent the scan turn. */
	userId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
	report: SecurityScanReport;
};

/** The newest scan row of a project, before the report parse. */
export type StoredSecurityScan = {
	id: string;
	turnId: string;
	createdAt: Date;
	/** Raw jsonb. The caller parses it with `securityScanReportSchema`. */
	report: unknown;
};

@Injectable()
export class SecurityScansRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts the scan row of one turn. A second insert for the same turn is
	 * a no-op (unique `turn_id`), so a repeated settle writes nothing.
	 */
	async insert(scan: SecurityScanInsert): Promise<void> {
		await this.db
			.insert(securityScans)
			.values(scan)
			.onConflictDoNothing({ target: securityScans.turnId });
	}

	/** The newest scan of one project, or null when it has none. */
	async findLatest(projectId: string): Promise<StoredSecurityScan | null> {
		const [row] = await this.db
			.select({
				createdAt: securityScans.createdAt,
				id: securityScans.id,
				report: securityScans.report,
				turnId: securityScans.turnId,
			})
			.from(securityScans)
			.where(eq(securityScans.projectId, projectId))
			.orderBy(desc(securityScans.createdAt))
			.limit(1);
		return row ?? null;
	}
}
