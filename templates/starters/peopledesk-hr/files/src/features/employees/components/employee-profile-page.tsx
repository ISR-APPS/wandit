// The profile of one employee: the job facts and the time-off history, and a rail with the
// vacation balance, the manager, the direct reports, and the career timeline.
// The /app/employees/$employeeId route renders it after its loader. A request row opens the time-off dialog.
import { ArrowLeftIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	CARD_TITLE_CLASS,
	dayKeyToMs,
	EMPLOYEE_STATUS_BADGE,
	PersonAvatar,
	TIME_OFF_STATUS_BADGE,
	TimeOffTypeMark,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import {
	type EmployeeProfile,
	employeeQueryOptions,
} from "../api/employees.queries";
import { LeaveBalanceCard } from "./leave-balance-card";
import { PersonRow } from "./person-row";

const routeApi = getRouteApi("/app/employees/$employeeId");

// Three layouts. A wide main area (56rem) has a main column and a 20rem rail. Below it the two
// columns melt into one grid ("contents"). From 42rem (a 1024 px screen) that grid has two columns:
// the wide cards take both, and the balance sits beside the manager. On a phone it is one list.
// The orders put the balance and the manager before the long time-off list. The wide layout keeps the source order.
const ORDER = {
	facts:
		"order-1 @2xl/main:col-span-2 @4xl/main:order-none @4xl/main:col-span-1",
	balance: "order-2 @4xl/main:order-none",
	manager: "order-3 @4xl/main:order-none",
	reports:
		"order-3 @2xl/main:col-span-2 @4xl/main:order-none @4xl/main:col-span-1",
	timeOff:
		"order-4 @2xl/main:col-span-2 @4xl/main:order-none @4xl/main:col-span-1",
	career:
		"order-5 @2xl/main:col-span-2 @4xl/main:order-none @4xl/main:col-span-1",
};
// A column wrapper: no box of its own below 56rem, a stack of cards on a wide main area.
const COLUMN = "contents @4xl/main:grid @4xl/main:gap-6";

/** The profile page. An id with no row shows the not-found state, with a link back to the list. */
export function EmployeeProfilePage() {
	const { employeeId } = routeApi.useParams();
	const { data: profile } = useSuspenseQuery(employeeQueryOptions(employeeId));
	if (!profile) {
		return <EmployeeNotFound />;
	}
	return <ProfileContent profile={profile} />;
}

// The page of a profile that exists.
function ProfileContent({ profile }: { profile: EmployeeProfile }) {
	const { t, locale } = useT();
	const { employee } = profile;
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const number = new Intl.NumberFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const formatDay = (day: string) =>
		dateFormat.format(new Date(dayKeyToMs(day)));

	const facts = [
		{ label: t("employees.employeeId"), value: employee.id },
		{
			label: t("employees.department"),
			value: t(`departments.${employee.department}`),
		},
		{
			label: t("employees.location"),
			value: t(`locations.${employee.location}`),
		},
		{
			label: t("employees.contract"),
			value: t(`contracts.${employee.contract}`),
		},
		{
			label: t("employees.weeklyHours"),
			value: new Intl.NumberFormat(locale, {
				style: "unit",
				unit: "hour",
				unitDisplay: "long",
			}).format(employee.weeklyHours),
		},
		{ label: t("employees.started"), value: formatDay(employee.startDate) },
		...(employee.endDate
			? [{ label: t("employees.lastDay"), value: formatDay(employee.endDate) }]
			: []),
	];

	return (
		<div className="grid gap-6">
			<Link
				to="/app/employees"
				className="inline-flex w-fit items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
				{t("employees.backToList")}
			</Link>
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="flex min-w-0 flex-1 items-center gap-4">
					<PersonAvatar name={profile.name} className="size-14 text-lg" />
					<div className="grid min-w-0 flex-1 gap-1">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<h1
								className="font-(--heading-weight) font-display text-3xl tracking-(--heading-tracking)"
								dir="auto"
							>
								{profile.name}
							</h1>
							<Badge variant={EMPLOYEE_STATUS_BADGE[employee.status]}>
								{t(`employeeStatuses.${employee.status}`)}
							</Badge>
						</div>
						<p className="text-muted-foreground" dir="auto">
							{`${employee.title} · ${t(`departments.${employee.department}`)}`}
						</p>
					</div>
				</div>
				<Button asChild variant="outline" className="self-start sm:self-auto">
					<a href={`mailto:${employee.email}`}>
						<EnvelopeSimpleIcon aria-hidden />
						{t("employees.sendEmail")}
					</a>
				</Button>
			</header>

			{/* Below 56rem the cards of one row stretch to one height, so the balance and the manager line up. */}
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-[minmax(0,1fr)_20rem] @4xl/main:items-start gap-6">
				<div className={COLUMN}>
					<Card className={ORDER.facts}>
						<CardHeader>
							<CardTitle className={CARD_TITLE_CLASS}>
								{t("employees.factsTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid @3xl/main:grid-cols-3 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
								{facts.map((fact) => (
									<div key={fact.label} className="grid gap-1">
										<dt className="text-muted-foreground">{fact.label}</dt>
										<dd className="font-medium tabular-nums">{fact.value}</dd>
									</div>
								))}
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("employees.email")}
									</dt>
									<dd className="truncate font-medium">
										<a
											className="hover:underline"
											href={`mailto:${employee.email}`}
										>
											{employee.email}
										</a>
									</dd>
								</div>
							</dl>
						</CardContent>
					</Card>

					<Card className={ORDER.timeOff}>
						<CardHeader>
							<CardTitle className={CARD_TITLE_CLASS}>
								{t("employees.timeOffTitle")}
							</CardTitle>
							<CardDescription>
								{t("employees.timeOffDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							{profile.requests.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("employees.timeOffEmpty")}
								</p>
							) : (
								<>
									{/* A phone gets a two-line list: the four table columns need about 28rem. */}
									<ul className="grid @md/main:hidden divide-y divide-border">
										{profile.requests.map((request) => (
											<li key={request.id}>
												<Link
													to="/app/time-off"
													search={{ request: request.id }}
													className="grid gap-1 py-3 text-sm"
												>
													<span className="flex items-center justify-between gap-3">
														<TimeOffTypeMark type={request.type} />
														<Badge
															variant={TIME_OFF_STATUS_BADGE[request.status]}
														>
															{t(`timeOffStatuses.${request.status}`)}
														</Badge>
													</span>
													<span className="flex flex-wrap gap-x-2 text-muted-foreground tabular-nums">
														<span>
															{dateFormat.formatRange(
																new Date(dayKeyToMs(request.startDate)),
																new Date(dayKeyToMs(request.endDate)),
															)}
														</span>
														<span aria-hidden>·</span>
														<span>{dayCount.format(request.days)}</span>
													</span>
												</Link>
											</li>
										))}
									</ul>
									<div className="@md/main:block hidden">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>{t("timeOff.type")}</TableHead>
													<TableHead>{t("timeOff.dates")}</TableHead>
													<TableHead className="text-end">
														{t("timeOff.days")}
													</TableHead>
													<TableHead>{t("timeOff.status")}</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{profile.requests.map((request) => (
													<TableRow key={request.id}>
														<TableCell className="whitespace-nowrap">
															<TimeOffTypeMark type={request.type} />
														</TableCell>
														<TableCell className="whitespace-nowrap tabular-nums">
															<Link
																to="/app/time-off"
																search={{ request: request.id }}
																className="hover:underline"
															>
																{dateFormat.formatRange(
																	new Date(dayKeyToMs(request.startDate)),
																	new Date(dayKeyToMs(request.endDate)),
																)}
															</Link>
														</TableCell>
														<TableCell className="text-end tabular-nums">
															{number.format(request.days)}
														</TableCell>
														<TableCell>
															<Badge
																variant={TIME_OFF_STATUS_BADGE[request.status]}
															>
																{t(`timeOffStatuses.${request.status}`)}
															</Badge>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				</div>

				<div className={COLUMN}>
					<LeaveBalanceCard
						balance={profile.balance}
						className={ORDER.balance}
					/>
					<Card className={ORDER.manager}>
						<CardHeader>
							<CardTitle className={CARD_TITLE_CLASS}>
								{t("employees.managerTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							{profile.manager ? (
								<PersonRow person={profile.manager} />
							) : (
								<p className="text-muted-foreground text-sm">
									{t("employees.noManager")}
								</p>
							)}
						</CardContent>
					</Card>
					{profile.reports.length > 0 ? (
						<Card className={ORDER.reports}>
							<CardHeader>
								<CardTitle
									className={cn(
										CARD_TITLE_CLASS,
										"flex items-baseline justify-between gap-3",
									)}
								>
									{t("employees.reportsTitle")}
									<span className="font-numeric text-muted-foreground tabular-nums">
										{number.format(profile.reports.length)}
									</span>
								</CardTitle>
							</CardHeader>
							<CardContent>
								{/* The card spans two columns from 42rem, so the people sit in two columns there. */}
								<ul className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 gap-3">
									{profile.reports.map((person) => (
										<li key={person.id}>
											<PersonRow person={person} />
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					) : null}
					<Card className={ORDER.career}>
						<CardHeader>
							<CardTitle className={CARD_TITLE_CLASS}>
								{t("employees.careerTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ol className="grid">
								{profile.careerEvents.map((event, index) => {
									const isLast = index === profile.careerEvents.length - 1;
									return (
										<li
											key={event.id}
											className="grid grid-cols-[1rem_1fr] gap-x-3 text-sm"
										>
											<span className="flex flex-col items-center">
												<span
													className={cn(
														"mt-1.5 size-2.5 shrink-0 rounded-full",
														index === 0
															? "bg-primary"
															: "bg-muted-foreground/40",
													)}
													aria-hidden
												/>
												{isLast ? null : (
													<span className="w-px flex-1 bg-border" aria-hidden />
												)}
											</span>
											<div className={cn("grid gap-0.5", !isLast && "pb-5")}>
												<span className="font-medium">
													{t(`careerEvents.${event.kind}`)}
												</span>
												{event.title ? (
													<span dir="auto">{event.title}</span>
												) : null}
												{event.previousTitle ? (
													<span className="text-muted-foreground" dir="auto">
														{t("employees.promotedFrom")} {event.previousTitle}
													</span>
												) : null}
												<span className="text-muted-foreground tabular-nums">
													{formatDay(event.day)}
												</span>
											</div>
										</li>
									);
								})}
							</ol>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

// The state of an id with no employee row.
function EmployeeNotFound() {
	const { t } = useT();
	return (
		<div className="grid justify-items-start gap-4">
			<h1 className="font-(--heading-weight) font-display text-2xl tracking-(--heading-tracking)">
				{t("employees.notFoundTitle")}
			</h1>
			<p className="text-muted-foreground">
				{t("employees.notFoundDescription")}
			</p>
			<Button asChild variant="outline">
				<Link to="/app/employees">{t("employees.backToList")}</Link>
			</Button>
		</div>
	);
}

// Placeholder blocks of the main column. Fixed keys, because the blocks never reorder.
const SKELETON_BLOCKS = ["facts", "time-off"];

/** Placeholder while the profile loader runs. The route sets it as pendingComponent. */
export function EmployeeProfileSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-4 w-32" />
			<div className="flex items-center gap-4">
				<Skeleton className="size-14 rounded-full" />
				<div className="grid gap-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-4 w-40" />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-[minmax(0,1fr)_20rem] items-start gap-6">
				<div className="grid gap-6">
					{SKELETON_BLOCKS.map((key) => (
						<Skeleton key={key} className="h-48 rounded-surface" />
					))}
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-72 rounded-surface" />
					<Skeleton className="h-48 rounded-surface" />
				</div>
			</div>
		</div>
	);
}
