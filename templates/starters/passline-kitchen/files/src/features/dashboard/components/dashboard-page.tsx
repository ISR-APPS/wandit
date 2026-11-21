// Shows open and completed tickets for one sample kitchen service.
// The /app route renders the board. Ticket updates last until the page reloads.
import { CheckIcon, ClockIcon, CookingPotIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";

const stations = ["All stations", "Grill", "Cold", "Sides"] as const;
const tickets = [
	{
		id: "T-46",
		table: "Table 12",
		station: "Grill",
		elapsed: "12 min",
		items: ["2 × Hanger steak", "1 × Grilled cabbage"],
		note: "One steak medium rare",
	},
	{
		id: "T-48",
		table: "Table 08",
		station: "Cold",
		elapsed: "8 min",
		items: ["1 × Beet salad", "2 × Chicory plate"],
		note: "Dressing on the side",
	},
	{
		id: "T-51",
		table: "Table 03",
		station: "Sides",
		elapsed: "5 min",
		items: ["2 × Crispy potatoes", "1 × Roast carrots"],
		note: "Send with mains",
	},
	{
		id: "T-54",
		table: "Table 14",
		station: "Grill",
		elapsed: "2 min",
		items: ["1 × Charred trout", "2 × Grilled cabbage"],
		note: "Fire mains together",
	},
];

/** Lets the kitchen filter by station and move a sample ticket to Completed. */
export function DashboardPage() {
	const { t } = useT();
	const [station, setStation] =
		useState<(typeof stations)[number]>("All stations");
	const [completed, setCompleted] = useState<string[]>([]);
	const open = tickets.filter((ticket) => !completed.includes(ticket.id));
	const visible = open.filter(
		(ticket) => station === "All stations" || ticket.station === station,
	);
	return (
		<div className="mx-auto grid max-w-7xl gap-5">
			<div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-card p-5 sm:p-6">
				<div>
					<p className="text-primary text-sm">
						{t("dashboard.mainKitchenService02")}
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-tight">
						{t("dashboard.dinnerTicketRail")}
					</h1>
				</div>
				<div className="flex items-center gap-3">
					<CookingPotIcon size="28" className="text-primary" />
					<div>
						<p className="text-muted-foreground text-xs">
							{t("dashboard.openTickets")}
						</p>
						<p className="font-numeric text-3xl" aria-live="polite">
							{open.length}
						</p>
					</div>
				</div>
			</div>
			<section aria-labelledby="rail-title">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="rail-title" className="font-semibold text-xl">
						{t("dashboard.activeOrders")}
					</h2>
					<div className="flex flex-wrap gap-1">
						{stations.map((choice) => (
							<Button
								key={choice}
								type="button"
								size="sm"
								variant={station === choice ? "default" : "outline"}
								aria-pressed={station === choice}
								onClick={() => setStation(choice)}
							>
								{choice}
							</Button>
						))}
					</div>
				</div>
				<ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{visible.map((ticket) => (
						<li
							key={ticket.id}
							className="flex flex-col overflow-hidden rounded-xl border bg-card"
						>
							<div className="flex items-center justify-between gap-2 bg-muted p-3">
								<span className="font-mono text-xs">{ticket.id}</span>
								<Badge variant="outline">{ticket.station}</Badge>
							</div>
							<div className="flex flex-1 flex-col gap-3 p-4">
								<div>
									<h3 className="font-semibold text-lg">{ticket.table}</h3>
									<span className="flex items-center gap-1 font-mono text-primary text-xs">
										<ClockIcon />
										{ticket.elapsed}
									</span>
								</div>
								<ul className="grid gap-1.5 border-y py-3 text-sm">
									{ticket.items.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
								<p className="flex-1 text-muted-foreground text-xs">
									{ticket.note}
								</p>
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onClick={() =>
										setCompleted((current) => [...current, ticket.id])
									}
								>
									<CheckIcon data-icon="inline-start" />
									{t("dashboard.markComplete")}
								</Button>
							</div>
						</li>
					))}
				</ul>
				{visible.length === 0 && (
					<p
						role="status"
						className="rounded-xl border bg-card p-5 text-muted-foreground text-sm"
					>
						{t("dashboard.noOpenTicketsAtThisStation")}
					</p>
				)}
			</section>
			<section
				id="timing"
				aria-labelledby="timing-title"
				className="scroll-mt-32 rounded-xl border bg-card p-5"
			>
				<h2 id="timing-title" className="font-semibold">
					{t("dashboard.courseTiming")}
				</h2>
				<dl className="mt-4 flex flex-wrap gap-6 sm:gap-10">
					<div>
						<dt className="text-muted-foreground text-sm">
							{t("dashboard.coldCourseTarget")}
						</dt>
						<dd className="mt-1 font-numeric text-2xl">8 min</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-sm">
							{t("dashboard.mainsTarget")}
						</dt>
						<dd className="mt-1 font-numeric text-2xl">16 min</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-sm">
							{t("dashboard.sidesTarget")}
						</dt>
						<dd className="mt-1 font-numeric text-2xl">6 min</dd>
					</div>
				</dl>
			</section>
			<section
				id="completed"
				aria-labelledby="completed-title"
				className="scroll-mt-32 rounded-xl border bg-card p-5"
			>
				<h2 id="completed-title" className="font-semibold">
					{t("dashboard.completedTickets")}
				</h2>
				{completed.length === 0 ? (
					<p className="mt-2 text-muted-foreground text-sm">
						{t("dashboard.completedTicketsAppearHereDuringThisService")}
					</p>
				) : (
					<ul className="mt-2 divide-y">
						{tickets
							.filter((ticket) => completed.includes(ticket.id))
							.map((ticket) => (
								<li
									key={ticket.id}
									className="flex items-center justify-between gap-3 py-2 text-sm"
								>
									<span>
										{ticket.id} · {ticket.table} · {ticket.station}
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() =>
											setCompleted((current) =>
												current.filter((id) => id !== ticket.id),
											)
										}
									>
										{t("dashboard.reopen")}
									</Button>
								</li>
							))}
					</ul>
				)}
			</section>
		</div>
	);
}
