// The dialog of one time-off request: its facts, the vacation balance of the person, and the teammates off on the same days.
// TimeOffPage opens it from the URL (?request=). It reads the balance and the overlaps with useQuery after the click.
// It shows no approve button: a decision needs a real table first (STARTER.md).
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	dayKeyToMs,
	formatRelativeDay,
	formatRelativeTime,
	PersonAvatar,
	TIME_OFF_STATUS_BADGE,
	TimeOffTypeMark,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type TimeOffRequest,
	timeOffRequestDetailQueryOptions,
} from "../api/time-off.queries";

type RequestDialogProps = {
	/** The request to show. The dialog keeps it while it closes, so the content does not jump. */
	request: TimeOffRequest | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A controlled dialog. The facts come from the list row; the balance and the overlaps load on open. */
export function RequestDialog({
	request,
	open,
	onOpenChange,
}: RequestDialogProps) {
	const { t } = useT();
	return (
		<Dialog open={open && request !== null} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
				{request ? (
					<RequestDialogBody
						request={request}
						onClose={() => onOpenChange(false)}
					/>
				) : (
					<DialogTitle className="sr-only">
						{t("timeOff.requestsTitle")}
					</DialogTitle>
				)}
			</DialogContent>
		</Dialog>
	);
}

type RequestDialogBodyProps = {
	request: TimeOffRequest;
	onClose: () => void;
};

function RequestDialogBody({ request, onClose }: RequestDialogBodyProps) {
	const { t, locale } = useT();
	const detail = useQuery(timeOffRequestDetailQueryOptions(request.id));
	const now = Date.now();
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const number = new Intl.NumberFormat(locale);
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const range = dateFormat.formatRange(
		new Date(dayKeyToMs(request.startDate)),
		new Date(dayKeyToMs(request.endDate)),
	);
	const decisionKey =
		request.status === "cancelled"
			? "timeOff.cancelledBy"
			: request.status === "declined"
				? "timeOff.declinedBy"
				: "timeOff.approvedBy";

	return (
		<>
			<DialogHeader className="text-start">
				<div className="flex items-center gap-3">
					<PersonAvatar
						name={request.employeeName}
						className="size-10 text-sm"
					/>
					<div className="grid min-w-0 gap-1">
						<DialogTitle className="truncate">
							{request.employeeName}
						</DialogTitle>
						<DialogDescription>
							{`${request.employeeTitle} · ${t(`departments.${request.department}`)}`}
						</DialogDescription>
					</div>
				</div>
			</DialogHeader>
			<div className="flex flex-wrap items-center gap-3 text-sm">
				<Badge variant={TIME_OFF_STATUS_BADGE[request.status]}>
					{t(`timeOffStatuses.${request.status}`)}
				</Badge>
				<TimeOffTypeMark type={request.type} />
				<span className="text-muted-foreground tabular-nums">{request.id}</span>
			</div>
			<dl className="grid gap-4 text-sm sm:grid-cols-2">
				<div className="grid gap-1">
					<dt className="text-muted-foreground">{t("timeOff.dates")}</dt>
					<dd className="tabular-nums">
						{range}
						<span className="block text-muted-foreground">
							{`${dayCount.format(request.days)} · ${formatRelativeDay(request.startDate, now, locale)}`}
						</span>
					</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-muted-foreground">{t("timeOff.sent")}</dt>
					<dd className="tabular-nums">
						{dateTime.format(new Date(request.submittedAt))}
						<span className="block text-muted-foreground">
							{formatRelativeTime(request.submittedAt, now, locale)}
						</span>
					</dd>
				</div>
				<div className="grid gap-1 sm:col-span-2">
					<dt className="text-muted-foreground">{t("timeOff.decision")}</dt>
					<dd>
						{request.decidedAt && request.decidedByName ? (
							<>
								{`${t(decisionKey)} ${request.decidedByName}`}
								<span className="block text-muted-foreground tabular-nums">
									{dateTime.format(new Date(request.decidedAt))}
								</span>
							</>
						) : (
							t("timeOff.waiting")
						)}
					</dd>
				</div>
				{request.note ? (
					<div className="grid gap-1 sm:col-span-2">
						<dt className="text-muted-foreground">{t("timeOff.note")}</dt>
						<dd dir="auto">{request.note}</dd>
					</div>
				) : null}
				{request.decisionNote ? (
					<div className="grid gap-1 sm:col-span-2">
						<dt className="text-muted-foreground">{t("timeOff.reason")}</dt>
						<dd dir="auto">{request.decisionNote}</dd>
					</div>
				) : null}
			</dl>
			{detail.isPending ? (
				<div className="grid gap-2">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-2 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : detail.isError || !detail.data ? (
				<p className="text-destructive text-sm" role="alert">
					{t("timeOff.detailError")}
				</p>
			) : (
				<div className="grid gap-5 rounded-surface bg-muted/60 p-4">
					{request.type === "vacation" ? (
						<div className="grid gap-2 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<span className="font-medium">{t("timeOff.balanceTitle")}</span>
								<span className="text-muted-foreground tabular-nums">
									{`${t("timeOff.balanceLeft")} ${number.format(detail.data.balance.remaining)} / ${number.format(detail.data.balance.allowance)}`}
								</span>
							</div>
							<Progress
								value={detail.data.balance.taken + detail.data.balance.booked}
								max={detail.data.balance.allowance}
								aria-label={t("timeOff.balanceTitle")}
								className="[&>div]:bg-primary"
							/>
						</div>
					) : null}
					<div className="grid gap-2 text-sm">
						<span className="font-medium">{t("timeOff.overlapTitle")}</span>
						{detail.data.overlaps.length === 0 ? (
							<p className="text-muted-foreground">
								{t("timeOff.overlapNone")}
							</p>
						) : (
							<ul className="grid gap-2">
								{detail.data.overlaps.map((person) => (
									<li
										key={`${person.employeeId}-${person.startDate}`}
										className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
									>
										<span className="flex items-center gap-2">
											<TimeOffTypeMark type={person.type} hideLabel />
											{person.name}
										</span>
										<span className="text-muted-foreground tabular-nums">
											{dateFormat.formatRange(
												new Date(dayKeyToMs(person.startDate)),
												new Date(dayKeyToMs(person.endDate)),
											)}
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					{t("timeOff.close")}
				</Button>
				<Button asChild>
					<Link
						to="/app/employees/$employeeId"
						params={{ employeeId: request.employeeId }}
					>
						{t("timeOff.openProfile")}
					</Link>
				</Button>
			</DialogFooter>
		</>
	);
}
