// Shows the service map, work orders, and technician coverage.
// The /app route renders it with a sample dispatch shift.
import { ArrowUpRightIcon, MapPinIcon, TruckIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";

const [firstCall, ...otherCalls] = [
	{
		id: "RD-0619",
		address: "48 Piermont Avenue",
		district: "Waterfront",
		task: "Cooling system inspection",
		crew: "A. Reyes",
		window: "09:20–10:05",
		priority: "Priority",
		marker: "start-[27%] top-[32%]",
	},
	{
		id: "RD-0628",
		address: "21 Laurel Court",
		district: "North Park",
		task: "New meter installation",
		crew: "T. Watanabe",
		window: "10:10–11:00",
		priority: "Scheduled",
		marker: "start-[56%] top-[20%]",
	},
	{
		id: "RD-0630",
		address: "19 Halcyon Street",
		district: "East Bank",
		task: "Pressure fault",
		crew: "M. Haddad",
		window: "10:45–11:30",
		priority: "Priority",
		marker: "start-[72%] top-[53%]",
	},
	{
		id: "RD-0635",
		address: "6 Kingfisher Mews",
		district: "South Dock",
		task: "Quarterly equipment check",
		crew: "S. Ellis",
		window: "12:10–12:45",
		priority: "Scheduled",
		marker: "start-[44%] top-[70%]",
	},
];
const calls = [firstCall, ...otherCalls];

/** Restricts the shift list to priority calls when the dispatcher selects that filter. */
export function DashboardPage() {
	const { t } = useT();
	const [priorityOnly, setPriorityOnly] = useState(false);
	const [activeCall, setActiveCall] = useState(firstCall);
	const shownCalls = calls.filter(
		(call) => !priorityOnly || call.priority === "Priority",
	);
	return (
		<div className="mx-auto grid max-w-[90rem] gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="text-primary text-sm">
						{t("dashboard.fieldServicePortland")}
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-tight sm:text-5xl">
						{t("dashboard.morningDispatch")}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{t("dashboard.weekdayShiftCallsAndTechnicianAssignments")}
					</p>
				</div>
				<Badge variant="outline" className="gap-2">
					<TruckIcon />
					{t("dashboard.activeCrewCount")}
				</Badge>
			</div>
			<div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
				<section
					aria-label={t("dashboard.serviceMap")}
					className="relative min-h-76 overflow-hidden rounded-2xl border bg-muted"
				>
					<div
						aria-hidden="true"
						className="absolute -inset-14 rotate-12"
						style={{
							background:
								"repeating-linear-gradient(0deg, transparent 0 42px, var(--background) 42px 50px, transparent 50px 66px), repeating-linear-gradient(90deg, transparent 0 25px, var(--background) 25px 33px, transparent 33px 60px)",
						}}
					/>
					<div
						aria-hidden="true"
						className="absolute -end-7 top-0 h-[115%] w-2/5 rotate-24 bg-primary/10"
					/>
					<span className="absolute start-4 top-4 rounded-lg border bg-card px-3 py-2 font-medium text-sm shadow-control">
						{t("dashboard.serviceDistricts")}
					</span>
					{calls.map((call) => (
						<button
							key={call.id}
							type="button"
							aria-label={call.district}
							aria-pressed={activeCall === call}
							onClick={() => setActiveCall(call)}
							className={cn(
								"absolute grid size-9 place-items-center rounded-full border bg-card text-primary shadow-control transition-transform hover:scale-110 aria-pressed:bg-primary aria-pressed:text-primary-foreground",
								call.marker,
							)}
						>
							<MapPinIcon size="20" />
						</button>
					))}
				</section>
				<section
					className="grid content-between gap-4 rounded-2xl border bg-card p-6"
					aria-labelledby="stop-title"
				>
					<div>
						<p className="text-primary text-sm">
							{activeCall.id} · {activeCall.district}
						</p>
						<h2 id="stop-title" className="mt-2 font-semibold text-2xl">
							{activeCall.address}
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							{activeCall.task}
						</p>
					</div>
					<dl className="grid grid-cols-2 gap-4 border-t pt-4">
						<div>
							<dt className="text-muted-foreground text-xs">
								{t("dashboard.technician")}
							</dt>
							<dd className="mt-1 font-medium">{activeCall.crew}</dd>
						</div>
						<div>
							<dt className="text-muted-foreground text-xs">
								{t("dashboard.arrivalWindow")}
							</dt>
							<dd className="mt-1 font-numeric">{activeCall.window}</dd>
						</div>
					</dl>
					<div>
						<Badge>{activeCall.priority}</Badge>
					</div>
				</section>
			</div>
			<section
				id="service-calls"
				className="scroll-mt-40 overflow-hidden rounded-2xl border bg-card"
				aria-labelledby="calls-heading"
			>
				<div className="flex flex-wrap items-center justify-between gap-3 p-5">
					<h2 id="calls-heading" className="font-semibold text-xl">
						{t("dashboard.serviceCalls")}
					</h2>
					<Button
						type="button"
						size="sm"
						variant={priorityOnly ? "default" : "outline"}
						aria-pressed={priorityOnly}
						onClick={() => setPriorityOnly(!priorityOnly)}
					>
						{t("dashboard.priorityOnly")}
					</Button>
				</div>
				<ul className="divide-y border-t">
					{shownCalls.map((call) => (
						<li key={call.id}>
							<button
								type="button"
								className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-start hover:bg-muted sm:grid-cols-[7rem_1fr_8rem_1rem] sm:px-5"
								onClick={() => setActiveCall(call)}
								aria-pressed={activeCall === call}
							>
								<span className="font-numeric text-primary text-sm">
									{call.id}
								</span>
								<span className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
									<strong className="block font-medium">{call.address}</strong>
									<span className="text-muted-foreground text-sm">
										{call.task}
									</span>
								</span>
								<span className="text-muted-foreground text-sm">
									{call.crew}
								</span>
								<ArrowUpRightIcon className="hidden sm:block" />
							</button>
						</li>
					))}
				</ul>
			</section>
			<section
				id="coverage"
				className="scroll-mt-40 rounded-2xl border bg-card p-5"
				aria-labelledby="coverage-title"
			>
				<h2 id="coverage-title" className="font-semibold text-xl">
					{t("dashboard.crewCoverage")}
				</h2>
				<ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{calls.map((call) => (
						<li key={call.id} className="rounded-lg bg-muted p-4">
							<strong className="block">{call.district}</strong>
							<span className="text-muted-foreground text-sm">
								{call.crew} · {call.window}
							</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
