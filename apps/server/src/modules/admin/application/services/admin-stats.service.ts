import { Inject, Injectable } from "@nestjs/common";
import type {
	AdminSignupStats,
	AdminSignupStatsQuery,
} from "@wandit/contracts";

import { AdminRepository } from "../../infrastructure/persistence/admin.repository";

const RANGE_DAYS: Record<AdminSignupStatsQuery["range"], number> = {
	"7d": 7,
	"30d": 30,
	"90d": 90,
};

@Injectable()
export class AdminStatsService {
	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: AdminRepository,
	) {}

	async getSignupStats(
		query: AdminSignupStatsQuery,
	): Promise<AdminSignupStats> {
		const [points, totalUsers] = await Promise.all([
			this.adminRepository.getSignupSeries(RANGE_DAYS[query.range]),
			this.adminRepository.countUsers(),
		]);

		return {
			range: query.range,
			// The zero-filled buckets cover the whole range, so their sum is the
			// range total by construction.
			total: points.reduce((sum, point) => sum + point.count, 0),
			totalUsers,
			points,
		};
	}
}
