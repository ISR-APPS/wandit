export { ChangeLine } from "./components/change-line";
export { InvoiceStatusBadge } from "./components/invoice-status-badge";
export { MatterStageBadge } from "./components/matter-stage-badge";
export { PersonAvatar } from "./components/person-avatar";
export {
	CURRENCY,
	dayCountFormat,
	fillMessage,
	hoursFormat,
	moneyFormat,
	toTenths,
} from "./lib/format";
export {
	INVOICE_STATUSES,
	type InvoiceStatus,
} from "./lib/invoice-status";
export { buildMatterLedgers, ledgerOf, type MatterLedger } from "./lib/ledger";
export {
	DEADLINE_SOON_DAYS,
	isOpenStage,
	MATTER_STAGE_DOT,
	MATTER_STAGES,
	type MatterStage,
	PRACTICE_AREAS,
	type PracticeArea,
	STAGE_PATH,
} from "./lib/matter-stage";
export {
	type AttorneyRole,
	type ClientRow,
	type DeadlineRow,
	getSampleTables,
	type InvoiceRow,
	type MatterRow,
	type PaymentRow,
	type SampleTables,
	type StageChangeRow,
	type TimeEntryRow,
} from "./lib/sample-data";
export {
	BAR_RADIUS_PX,
	type BreakdownSlice,
	buildDailySeries,
	changeRatio,
	type DailyPoint,
	type KpiItem,
	PERIOD_DAYS,
	type PeriodDays,
	totalsOf,
} from "./lib/series";
export {
	addLocalDays,
	calendarDaysUntil,
	dayKeyOf,
	dayToDate,
	formatAge,
	formatRelativeTime,
	startOfLocalDay,
} from "./lib/time";
