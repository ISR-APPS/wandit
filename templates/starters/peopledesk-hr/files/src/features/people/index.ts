export { KpiFigures, KpiFiguresSkeleton } from "./components/kpi-figures";
export { PersonAvatar } from "./components/person-avatar";
export { TimeOffTypeMark } from "./components/time-off-type-mark";
export { useIsWideScreen } from "./hooks/use-is-wide-screen";
export { CARD_TITLE_CLASS } from "./lib/card-title";
export {
	BOARD_STAGES,
	type Contract,
	DEPARTMENTS,
	type Department,
	EMPLOYEE_STATUS_BADGE,
	EMPLOYEE_STATUSES,
	type EmployeeStatus,
	POSITION_STATUS_BADGE,
	type Source,
	STAGE_BADGE,
	type Stage,
	TIME_OFF_STATUS_BADGE,
	TIME_OFF_STATUSES,
	TIME_OFF_TYPE_COLOR,
	TIME_OFF_TYPES,
	type TimeOffStatus,
	type TimeOffType,
} from "./lib/codes";
export {
	absenceDays,
	fullName,
	type LeaveBalance,
	leaveBalance,
	workingDayKeys,
} from "./lib/leave";
export {
	type CandidateRow,
	type CareerEventRow,
	type EmployeeRow,
	type PositionRow,
	readPeopleTables,
	type TimeOffRequestRow,
} from "./lib/sample-data";
export {
	type BreakdownSlice,
	buildCategorySeries,
	buildDailySeries,
	type CategoryPoint,
	changeRatio,
	type DailyPoint,
	type KpiItem,
	periodDayKeys,
	totalsOf,
} from "./lib/series";
export {
	calendarDaysFromNow,
	dayKeyToMs,
	dayKeyToUtcDate,
	formatRelativeDay,
	formatRelativeTime,
	isWeekend,
	shiftDays,
	startOfLocalDay,
	toDayKey,
} from "./lib/time";
