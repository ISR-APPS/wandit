/**
 * Computes the trophies of one user on each read, and stores each first unlock.
 * TrophiesController calls it. It reads facts through TrophiesRepository and the spend through CreditsService.
 * A trophy gives points only. This service grants no credits and moves no money.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	centiCreditsToCredits,
	earnedTrophyIds,
	TROPHIES,
	type TrophiesResponse,
	type TrophyFacts,
	type TrophyId,
	trophyLevelFor,
	trophyPointsFor,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { buildWeekStreaks } from "../../domain/build-weeks";
import {
	TrophiesRepository,
	type TrophyUnlockRow,
} from "../../infrastructure/persistence/trophies.repository";

/** The repository methods that the service uses. The spec passes a fake with the same methods. */
export type TrophiesStore = Pick<TrophiesRepository, keyof TrophiesRepository>;

// 53 weeks: the longest streak trophy needs 26 weeks, and the strip shows 12.
const BUILD_WEEKS_LOOKBACK_MS = 371 * 86_400_000;

@Injectable()
export class TrophiesService {
	constructor(
		@Inject(TrophiesRepository)
		private readonly repository: TrophiesStore,
		@Inject(CreditsService)
		private readonly credits: Pick<CreditsService, "netConsumedCentiCredits">,
	) {}

	/**
	 * The trophies, points, level, and build weeks of the user at `now`.
	 * It stores the trophies that the facts meet for the first time. Points come from the stored rows only.
	 */
	async list(userId: string, now: Date): Promise<TrophiesResponse> {
		const since = new Date(now.getTime() - BUILD_WEEKS_LOOKBACK_MS);
		const [countFacts, weekStarts, spentCentiCredits, storedRows] =
			await Promise.all([
				this.repository.readFacts(userId),
				this.repository.readBuildWeekStarts(userId, since),
				this.credits.netConsumedCentiCredits(userId),
				this.repository.listUnlocks(userId),
			]);

		const buildWeeks = buildWeekStreaks(weekStarts, now);
		const facts: TrophyFacts = {
			...countFacts,
			bestBuildWeekStreak: buildWeeks.bestStreak,
			// LIMIT: an open reservation counts as spend, so a Fuel trophy can unlock before the turn settles, and it stays. Upgrade: read the settled net spend only.
			spentCredits: centiCreditsToCredits(spentCentiCredits),
		};

		const unlocks = await this.storeNewUnlocks(userId, facts, storedRows);
		// TROPHIES drives the loop, so a stored id that the catalog dropped is not in the answer.
		const unlockedIds = TROPHIES.filter((trophy) => unlocks.has(trophy.id)).map(
			(trophy) => trophy.id,
		);
		const points = trophyPointsFor(unlockedIds);

		return {
			buildWeeks,
			level: trophyLevelFor(points),
			points,
			trophies: TROPHIES.map((trophy) => {
				const unlock = unlocks.get(trophy.id);
				return {
					// A hidden trophy shows no progress until it unlocks.
					current:
						trophy.hidden && unlock === undefined
							? null
							: Math.min(facts[trophy.fact], trophy.target),
					id: trophy.id,
					isNew: unlock !== undefined && unlock.seenAt === null,
					unlockedAt: unlock?.unlockedAt.toISOString() ?? null,
				};
			}),
		};
	}

	/** Sets `seen_at` on the given new trophies of the user. The web calls it after it shows their toasts. */
	markSeen(userId: string, trophyIds: readonly TrophyId[]): Promise<void> {
		return this.repository.markSeen(userId, trophyIds);
	}

	/** Inserts the earned trophies that are not stored yet. Returns every stored row, keyed by trophy id. */
	private async storeNewUnlocks(
		userId: string,
		facts: TrophyFacts,
		storedRows: TrophyUnlockRow[],
	): Promise<Map<string, TrophyUnlockRow>> {
		const storedIds = new Set(storedRows.map((row) => row.trophyId));
		const missing = earnedTrophyIds(facts).filter((id) => !storedIds.has(id));
		if (missing.length === 0) {
			return new Map(storedRows.map((row) => [row.trophyId, row]));
		}

		const inserted = await this.repository.insertUnlocks(userId, missing);
		// A parallel read stored some of these rows first. Read again to get their real unlock times.
		const rows =
			inserted.length < missing.length
				? await this.repository.listUnlocks(userId)
				: [...storedRows, ...inserted];
		return new Map(rows.map((row) => [row.trophyId, row]));
	}
}
