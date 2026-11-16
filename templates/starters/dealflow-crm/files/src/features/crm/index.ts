export { ChangeLine } from "./components/change-line";
export { DealStageBadge, STAGE_DOT } from "./components/deal-stage-badge";
export { PersonAvatar } from "./components/person-avatar";
export {
	ACTIVITY_TYPE_ICON,
	ACTIVITY_TYPES,
	type ActivityType,
} from "./lib/activity-type";
export {
	DEAL_STAGES,
	type DealSource,
	type DealStage,
	isOpenStage,
	type LostReason,
	STAGE_PROBABILITY,
	STALLED_AFTER_DAYS,
	WINNING_PATH,
} from "./lib/deal-stage";
export {
	CURRENCY,
	dayCountFormat,
	fillMessage,
	moneyFormat,
} from "./lib/format";
export {
	calendarDaysFromNow,
	DAY_MS,
	formatAge,
	formatRelativeTime,
} from "./lib/relative-time";
export { getSampleTables, type SampleTables } from "./lib/sample-data";
export {
	type BreakdownSlice,
	buildDailySeries,
	type DailyPoint,
	dayToDate,
	PERIOD_DAYS,
	type PeriodDays,
	totalsOf,
} from "./lib/series";
