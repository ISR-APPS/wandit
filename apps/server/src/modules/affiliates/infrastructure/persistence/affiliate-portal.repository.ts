import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "@wandit/db";
import { affiliatePrograms, affiliates } from "@wandit/db/schema/affiliates";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type {
	AffiliateAdminAffiliateRow,
	AffiliateAdminProgramRow,
} from "./affiliate-admin.repository";

@Injectable()
export class AffiliatePortalRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findAffiliateByUserId(
		userId: string,
	): Promise<AffiliateAdminAffiliateRow | null> {
		const [affiliate] = await this.db
			.select()
			.from(affiliates)
			.where(eq(affiliates.userId, userId))
			.limit(1);

		return affiliate ?? null;
	}

	async listProgramsByIds(ids: string[]): Promise<AffiliateAdminProgramRow[]> {
		if (ids.length === 0) {
			return [];
		}

		return this.db
			.select()
			.from(affiliatePrograms)
			.where(inArray(affiliatePrograms.id, ids));
	}
}
