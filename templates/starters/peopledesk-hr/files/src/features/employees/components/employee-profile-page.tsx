// The profile of one employee. It follows the kit profile page: a title row, tabs, then a 1/3 + 2/3 grid.
// The left column holds the profile card, the vacation meter, and the contract badges.
// The right column holds the career timeline, then the time-off history beside the team.
// The /app/employees/$employeeId route renders it after its loader. The Time off and Team tabs show the full lists.
import {
	AirplaneTiltIcon,
	ArrowLeftIcon,
	BuildingsIcon,
	CalendarBlankIcon,
	ClockIcon,
	EnvelopeSimpleIcon,
	type Icon,
	MapPinIcon,
	SealCheckIcon,
	SignOutIcon,
	TrendUpIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type CareerEventRow,
	dayKeyToMs,
	EMPLOYEE_STATUS_BADGE,
	fillMessage,
	formatDayRange,
	PersonAvatar,
	TIME_OFF_STATUS_BADGE,
	TimeOffTypeMark,
} from "~/features/people";
import {
	RequestTable,
	type TimeOffRequest,
	timeOffRequestsQueryOptions,
} from "~/features/time-off";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type EmployeeProfile,
	employeeQueryOptions,
	type PersonLink,
} from "../api/employees.queries";

const routeApi = getRouteApi("/app/employees/$employeeId");

/** The three tabs of the page. */
const PROFILE_TABS = ["overview", "timeOff", "team"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

// The overview cards show the latest few rows. The tabs show every row.
const OVERVIEW_REQUESTS = 5;
const OVERVIEW_TEAM = 5;
// Rows per page of the time-off tab.
const TIME_OFF_PAGE_SIZE = 10;

// One icon per career event in the timeline circle.
const CAREER_ICON = {
	joined: UserPlusIcon,
	probation_passed: SealCheckIcon,
	promoted: TrendUpIcon,
	notice_given: SignOutIcon,
	leave_started: AirplaneTiltIcon,
} satisfies Record<CareerEventRow["kind"], Icon>;

/** The profile page. An id with no row shows the not-found state, with a link back to the list. */
export function EmployeeProfilePage() {
	const { employeeId } = routeApi.useParams();
	const { data: profile } = useSuspenseQuery(employeeQueryOptions(employeeId));
	const { data: requests } = useSuspenseQuery(timeOffRequestsQueryOptions());
	if (!profile) {
		return <EmployeeNotFound />;
	}
	return (
		<ProfileContent
			profile={profile}
			requests={requests
				.filter((request) => request.employeeId === profile.employee.id)
				.sort((first, second) =>
					second.startDate.localeCompare(first.startDate),
				)}
		/>
	);
}

type ProfileContentProps = {
	profile: EmployeeProfile;
	/** The time-off requests of this employee, the latest first day first. */
	requests: TimeOffRequest[];
};

// The page of a profile that exists. The tab is state of the page.
function ProfileContent({ profile, requests }: ProfileContentProps) {
	const { t } = useT();
	const [tab, setTab] = useState<ProfileTab>("overview");
	// The manager first, then the direct reports, then the peers.
	const team: TeamMember[] = [
		...(profile.manager
			? [{ person: profile.manager, relation: "manager" as const }]
			: []),
		...profile.reports.map((person) => ({
			person,
			relation: "report" as const,
		})),
		...profile.peers.map((person) => ({ person, relation: "peer" as const })),
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("employees.profileTitle")}
				actions={
					<>
						<Button asChild variant="outline">
							<Link to="/app/employees">
								<ArrowLeftIcon className="rtl:rotate-180" />
								{t("employees.allEmployees")}
							</Link>
						</Button>
						<Button asChild>
							<a href={`mailto:${profile.employee.email}`}>
								<EnvelopeSimpleIcon />
								{t("employees.sendEmail")}
							</a>
						</Button>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(PROFILE_TABS.find((option) => option === value) ?? "overview")
				}
			>
				<TabsList>
					{PROFILE_TABS.map((option) => (
						<TabsTrigger key={option} value={option}>
							{t(`employees.tabs.${option}`)}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{tab === "overview" ? (
				<div className="grid items-start gap-4 xl:grid-cols-3">
					<div className="grid gap-4">
						<ProfileCard profile={profile} />
						<VacationCard profile={profile} />
						<ContractCard profile={profile} />
					</div>
					<div className="grid min-w-0 gap-4 xl:col-span-2">
						<CareerCard events={profile.careerEvents} />
						<div className="grid items-start gap-4 xl:grid-cols-2">
							<TimeOffHistoryCard
								requests={requests.slice(0, OVERVIEW_REQUESTS)}
								onViewAll={() => setTab("timeOff")}
							/>
							<TeamCard
								team={team.slice(0, OVERVIEW_TEAM)}
								onViewAll={() => setTab("team")}
							/>
						</div>
					</div>
				</div>
			) : tab === "timeOff" ? (
				<RequestTable
					requests={requests}
					variant="list"
					pageSize={TIME_OFF_PAGE_SIZE}
					searchable={false}
					noResults={t("employees.noRequests")}
				/>
			) : (
				<TeamCard team={team} />
			)}
		</div>
	);
}

// The kit profile card: the avatar and the name, a strip of three figures, then the contact lines.
function ProfileCard({ profile }: { profile: EmployeeProfile }) {
	const { t, locale } = useT();
	const { employee, balance } = profile;
	const number = new Intl.NumberFormat(locale);
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const figures = [
		{ label: t("employees.vacationLeft"), value: balance.remaining },
		{ label: t("employees.daysTaken"), value: balance.taken },
		{ label: t("employees.reports"), value: profile.reports.length },
	];
	const lines = [
		{
			id: "email",
			icon: EnvelopeSimpleIcon,
			text: (
				<a href={`mailto:${employee.email}`} className="hover:underline">
					{employee.email}
				</a>
			),
		},
		{
			id: "location",
			icon: MapPinIcon,
			text: t(`locations.${employee.location}`),
		},
		{
			id: "department",
			icon: BuildingsIcon,
			text: t(`departments.${employee.department}`),
		},
		{
			id: "start",
			icon: CalendarBlankIcon,
			text: fillMessage(t("employees.startedOn"), {
				date: dateFormat.format(dayKeyToMs(employee.startDate)),
			}),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-4 text-center">
					<PersonAvatar name={profile.name} className="size-20 text-2xl" />
					<div className="grid gap-1">
						<h2 className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							<span dir="auto">{profile.name}</span>
							<Badge variant={EMPLOYEE_STATUS_BADGE[employee.status]}>
								{t(`employeeStatuses.${employee.status}`)}
							</Badge>
						</h2>
						<p className="text-muted-foreground text-sm" dir="auto">
							{employee.title}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center *:py-3 rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.label} className="grid gap-0.5 px-1">
							<dt className="text-muted-foreground text-xs">{figure.label}</dt>
							{/* The figure shows above its label, as in the kit; the markup keeps dt first. */}
							<dd className="order-first font-semibold text-lg tabular-nums">
								{number.format(figure.value)}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4 text-sm">
					{lines.map((line) => (
						<li key={line.id} className="flex items-center gap-3">
							<line.icon
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden
							/>
							<span className="min-w-0 truncate">{line.text}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

// The kit progress card: the share of the vacation allowance that is taken or booked.
function VacationCard({ profile }: { profile: EmployeeProfile }) {
	const { t, locale } = useT();
	const { balance } = profile;
	const number = new Intl.NumberFormat(locale);
	const used = balance.taken + balance.booked;
	// A person who joined today can have an allowance of 0. The bar then shows empty.
	const share = balance.allowance > 0 ? used / balance.allowance : 0;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("employees.vacationUsedTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("employees.vacationUsedDescription"), {
						used: number.format(used),
						allowance: number.format(balance.allowance),
						pending: number.format(balance.pending),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress value={used} max={balance.allowance} />
				<span className="text-muted-foreground text-sm tabular-nums">
					{new Intl.NumberFormat(locale, {
						style: "percent",
						maximumFractionDigits: 0,
					}).format(share)}
				</span>
			</CardContent>
		</Card>
	);
}

// The kit skills card: the contract facts as outline badges.
function ContractCard({ profile }: { profile: EmployeeProfile }) {
	const { t, locale } = useT();
	const { employee } = profile;
	const number = new Intl.NumberFormat(locale);
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const badges = [
		employee.id,
		t(`contracts.${employee.contract}`),
		fillMessage(t("employees.hoursPerWeek"), {
			hours: number.format(employee.weeklyHours),
		}),
		fillMessage(t("employees.allowancePerYear"), {
			days: number.format(employee.annualAllowance),
		}),
		...(employee.endDate
			? [
					fillMessage(t("employees.endsOn"), {
						date: dateFormat.format(dayKeyToMs(employee.endDate)),
					}),
				]
			: []),
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("employees.contractTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{badges.map((text) => (
						<li key={text}>
							<Badge variant="outline">{text}</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

// The kit activity card: the career events on a vertical rule, the newest first.
function CareerCard({ events }: { events: CareerEventRow[] }) {
	const { t, locale } = useT();
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("employees.careerTitle")}</CardTitle>
				<CardDescription>{t("employees.careerDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="ps-9">
				<ol className="relative border-s">
					{events.map((event, index) => {
						const EventIcon = CAREER_ICON[event.kind];
						return (
							<li
								key={event.id}
								className={
									index === events.length - 1
										? "ms-6 grid gap-2"
										: "ms-6 mb-8 grid gap-2"
								}
							>
								<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted">
									<EventIcon className="size-3 text-primary" aria-hidden />
								</span>
								<h3 className="flex flex-wrap items-center gap-2 font-semibold">
									{t(`careerEvents.${event.kind}`)}
									{index === 0 ? (
										<Badge variant="outline">{t("employees.latest")}</Badge>
									) : null}
								</h3>
								<time
									dateTime={event.day}
									className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
								>
									<ClockIcon className="size-3" aria-hidden />
									{dateFormat.format(dayKeyToMs(event.day))}
								</time>
								{event.title ? (
									<p className="text-muted-foreground text-sm" dir="auto">
										{event.previousTitle
											? fillMessage(t("employees.promotedFrom"), {
													from: event.previousTitle,
													to: event.title,
												})
											: event.title}
									</p>
								) : null}
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}

type TimeOffHistoryCardProps = {
	/** The latest requests of the employee, the latest first day first. */
	requests: TimeOffRequest[];
	/** Opens the Time off tab. */
	onViewAll: () => void;
};

// The kit transaction card: a short table of the latest requests. A date range opens the request dialog.
function TimeOffHistoryCard({ requests, onViewAll }: TimeOffHistoryCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("employees.timeOffTitle")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="link"
						size="sm"
						className="h-auto p-0 text-muted-foreground"
						onClick={onViewAll}
					>
						{t("common.viewAll")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{requests.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("employees.noRequests")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("timeOff.type")}</TableHead>
								<TableHead>{t("timeOff.dates")}</TableHead>
								<TableHead>{t("timeOff.status")}</TableHead>
								<TableHead className="text-end">{t("timeOff.days")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{requests.map((request) => (
								<TableRow key={request.id}>
									<TableCell>
										<TimeOffTypeMark type={request.type} />
									</TableCell>
									<TableCell className="whitespace-nowrap tabular-nums">
										<Link
											to="/app/time-off"
											search={{ request: request.id }}
											className="hover:underline"
										>
											{formatDayRange(
												request.startDate,
												request.endDate,
												locale,
											)}
										</Link>
									</TableCell>
									<TableCell>
										<Badge variant={TIME_OFF_STATUS_BADGE[request.status]}>
											{t(`timeOffStatuses.${request.status}`)}
										</Badge>
									</TableCell>
									<TableCell className="text-end font-medium tabular-nums">
										{number.format(request.days)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

// One row of the team card. The relation picks the label above the job title.
type TeamMember = {
	person: PersonLink;
	relation: "manager" | "report" | "peer";
};

type TeamCardProps = {
	/** The manager first, then the direct reports, then the peers. */
	team: TeamMember[];
	/** Opens the Team tab. The Team tab itself passes nothing, so the card has no "View all". */
	onViewAll?: () => void;
};

// The kit connections card: one row per person, with an outline button to the profile.
function TeamCard({ team, onViewAll }: TeamCardProps) {
	const { t } = useT();
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("employees.teamTitle")}</CardTitle>
				{onViewAll ? (
					<CardAction>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto p-0 text-muted-foreground"
							onClick={onViewAll}
						>
							{t("common.viewAll")}
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{team.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("employees.noTeam")}
					</p>
				) : (
					<ul className="grid gap-4">
						{team.map(({ person, relation }) => (
							<li
								key={person.id}
								className="flex items-center justify-between gap-3"
							>
								<div className="flex min-w-0 items-center gap-3">
									<PersonAvatar name={person.name} className="size-9" />
									<div className="grid min-w-0 justify-items-start">
										<span className="truncate font-medium" dir="auto">
											{person.name}
										</span>
										{/* The relation and a long job title wrap: a single line runs under the View button. */}
										<span className="text-muted-foreground text-xs" dir="auto">
											{fillMessage(t(`employees.relations.${relation}`), {
												title: person.title,
											})}
										</span>
									</div>
								</div>
								<Button asChild variant="outline" size="sm">
									<Link
										to="/app/employees/$employeeId"
										params={{ employeeId: person.id }}
										aria-label={fillMessage(t("employees.viewProfileOf"), {
											name: person.name,
										})}
									>
										{t("employees.view")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
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
				<Link to="/app/employees">{t("employees.allEmployees")}</Link>
			</Button>
		</div>
	);
}

/** Placeholder while the profile loader runs. The route sets it as pendingComponent. */
export function EmployeeProfileSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<Skeleton className="h-9 w-64" />
			<div className="grid items-start gap-4 xl:grid-cols-3">
				<div className="grid gap-4">
					<Skeleton className="h-112" />
					<Skeleton className="h-32" />
				</div>
				<div className="grid gap-4 xl:col-span-2">
					<Skeleton className="h-72" />
					<div className="grid gap-4 xl:grid-cols-2">
						<Skeleton className="h-64" />
						<Skeleton className="h-64" />
					</div>
				</div>
			</div>
		</div>
	);
}
