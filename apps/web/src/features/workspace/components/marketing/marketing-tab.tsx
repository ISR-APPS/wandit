// Marketing tab: the AI-maintained plan for the project — goal progress,
// this week's advice, channel mix, audiences, a week-1 checklist and
// campaign ideas. Content is mock (lib/mock-marketing.ts) until strategy
// artifacts land; goal progress is real, computed from the lead book so it
// always agrees with the Leads tab. Header controls live in
// marketing-controls.tsx via shell/main-pane-header.tsx.

import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { Check, UserRound } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { Spark } from "@/components/logo";
import { useLeadsQuery } from "../../api/leads.queries";
import { WORKSPACE_COPY } from "../../lib/constants";
import {
	type ChecklistItem,
	getMarketingPlan,
	type IdeaStatus,
	type MarketingPlan,
} from "../../lib/mock-marketing";
import { useWorkspace } from "../../lib/store";

const COPY = WORKSPACE_COPY.marketing;

const IDEA_STATUS_META: Record<
	IdeaStatus,
	{ label: string; badgeVariant: "success" | "warning" | "secondary" }
> = {
	ready: { label: COPY.ideaStatus.ready, badgeVariant: "success" },
	draft: { label: COPY.ideaStatus.draft, badgeVariant: "warning" },
	idea: { label: COPY.ideaStatus.idea, badgeVariant: "secondary" },
};

function Kicker({ children }: { children: ReactNode }) {
	return (
		<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
			{children}
		</p>
	);
}

const SKELETON_KEYS = ["goal", "take", "mix", "list"];

export function MarketingTab() {
	const { projectId, project, projectPending } = useWorkspace();
	const leadsQuery = useLeadsQuery(projectId, project?.leadCount);

	const plan = useMemo(
		() => (project ? getMarketingPlan(project) : null),
		[project],
	);

	const confirmed = useMemo(
		() =>
			(leadsQuery.data ?? []).filter((lead) => lead.status === "confirmed")
				.length,
		[leadsQuery.data],
	);

	if (projectPending || !plan) {
		return (
			<div className="h-full overflow-y-auto">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-8">
					{SKELETON_KEYS.map((key) => (
						<Skeleton key={key} className="h-32 rounded-xl" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 md:px-8">
				<GoalCard
					plan={plan}
					confirmed={confirmed}
					confirmedPending={leadsQuery.isPending}
				/>
				<TakeCard take={plan.take} />
				<div className="grid gap-4 md:grid-cols-2">
					<ChannelsCard plan={plan} />
					<AudienceCard plan={plan} />
				</div>
				<ChecklistCard items={plan.checklist} />
				<IdeasCard plan={plan} />
			</div>
		</div>
	);
}

function GoalCard({
	plan,
	confirmed,
	confirmedPending,
}: {
	plan: MarketingPlan;
	confirmed: number;
	confirmedPending: boolean;
}) {
	const pct = Math.min(100, Math.round((confirmed / plan.goalTarget) * 100));
	const onTrack = pct >= 25;

	return (
		<section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
			<div className="min-w-0">
				<Kicker>{COPY.goalKicker}</Kicker>
				<h3 className="mt-1.5 font-display font-semibold text-xl">
					{plan.goal}
				</h3>
			</div>
			<div className="flex items-center gap-3">
				<div className="text-right">
					<p className="font-medium font-mono text-lg tabular-nums">
						{confirmedPending ? "—" : confirmed}
						<span className="font-normal text-muted-foreground">
							{" "}
							/ {plan.goalTarget}
						</span>
					</p>
					<p
						className={cn(
							"font-mono text-[10px]",
							onTrack ? "text-success" : "text-muted-foreground",
						)}
					>
						{onTrack ? COPY.goalOnTrack : COPY.goalBehind}
					</p>
				</div>
				<div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-gradient-ember"
						style={{ width: `${confirmedPending ? 0 : pct}%` }}
					/>
				</div>
			</div>
		</section>
	);
}

function TakeCard({ take }: { take: string }) {
	return (
		<section className="flex items-start gap-3 rounded-xl bg-foreground p-5 text-background">
			<span className="grid size-6 shrink-0 place-items-center rounded-md bg-gradient-ember">
				<Spark className="size-3.5 text-white" />
			</span>
			<div className="min-w-0">
				<p className="font-mono text-[10px] text-primary uppercase tracking-widest dark:text-primary-foreground">
					{COPY.takeKicker}
				</p>
				<p className="mt-1.5 text-background/85 text-sm leading-relaxed">
					{take}
				</p>
			</div>
		</section>
	);
}

function ChannelsCard({ plan }: { plan: MarketingPlan }) {
	return (
		<section className="rounded-xl border bg-card p-5">
			<Kicker>{COPY.channelsKicker}</Kicker>
			<div className="mt-4 flex flex-col gap-4">
				{plan.channels.map((channel) => (
					<div key={channel.key}>
						<div className="flex items-baseline justify-between gap-2">
							<span className="font-medium text-sm">{channel.name}</span>
							<span className="font-mono text-muted-foreground text-xs tabular-nums">
								{channel.share}%
							</span>
						</div>
						<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
							{channel.note}
						</p>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className={cn("h-full rounded-full", channel.barClass)}
								style={{ width: `${channel.share}%` }}
							/>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function AudienceCard({ plan }: { plan: MarketingPlan }) {
	return (
		<section className="rounded-xl border bg-card p-5">
			<Kicker>{COPY.audienceKicker}</Kicker>
			<div className="mt-4 flex flex-col divide-y">
				{plan.personas.map((persona) => (
					<div
						key={persona.key}
						className="flex gap-3 py-3.5 first:pt-0 last:pb-0"
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
							<UserRound className="size-4" />
						</span>
						<div className="min-w-0">
							<p className="font-medium text-sm">
								{persona.name}{" "}
								<span className="font-normal text-muted-foreground text-xs">
									{persona.ageRange}
								</span>
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
								{persona.description}
							</p>
							<div className="mt-2 flex gap-1.5">
								{persona.platforms.map((platform) => (
									<span
										key={platform}
										className="rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[9px] text-muted-foreground tracking-wider"
									>
										{platform}
									</span>
								))}
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function ChecklistCard({ items }: { items: ChecklistItem[] }) {
	const { setTab, chatOpen, toggleChat } = useWorkspace();
	const done = items.filter((item) => item.state === "done").length;

	return (
		<section className="rounded-xl border bg-card p-5">
			<div className="flex items-center justify-between">
				<Kicker>{COPY.checklistKicker}</Kicker>
				<span className="font-mono text-[10px] text-muted-foreground">
					{COPY.checklistDone(done, items.length)}
				</span>
			</div>
			<div className="mt-3 flex flex-col gap-0.5">
				{items.map((item) => (
					<div
						key={item.key}
						className={cn(
							"flex items-center gap-3 rounded-lg px-3 py-2.5",
							item.state === "current" &&
								"bg-primary/5 ring-1 ring-primary/25 ring-inset",
						)}
					>
						{item.state === "done" ? (
							<span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-success/15 text-success">
								<Check className="size-3" strokeWidth={3} />
							</span>
						) : item.state === "current" ? (
							<span className="grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-primary">
								<span className="size-1.5 rounded-full bg-primary" />
							</span>
						) : (
							<span className="size-[18px] shrink-0 rounded-full border border-border" />
						)}
						<div className="min-w-0 flex-1">
							<p
								className={cn(
									"text-sm",
									item.state === "done" &&
										"text-muted-foreground line-through decoration-border",
									item.state === "current" && "font-medium",
								)}
							>
								{item.label}
							</p>
							{item.detail ? (
								<p className="mt-0.5 text-muted-foreground text-xs">
									{item.detail}
								</p>
							) : null}
						</div>
						{item.state === "current" ? (
							<Button
								size="sm"
								className="h-7 shrink-0 rounded-lg px-2.5 text-xs"
								onClick={() => {
									if (!chatOpen) toggleChat();
								}}
							>
								{COPY.askWandit}
							</Button>
						) : item.linkTab ? (
							<Button
								variant="outline"
								size="sm"
								className="h-7 shrink-0 rounded-lg px-2.5 text-xs"
								onClick={() => setTab(item.linkTab as "assets" | "leads")}
							>
								{item.linkTab === "leads" ? COPY.openLeads : COPY.view}
							</Button>
						) : null}
					</div>
				))}
			</div>
		</section>
	);
}

function IdeasCard({ plan }: { plan: MarketingPlan }) {
	return (
		<section className="rounded-xl border bg-card px-5 py-2">
			<div className="pt-3 pb-1">
				<Kicker>{COPY.ideasKicker}</Kicker>
			</div>
			<div className="flex flex-col divide-y">
				{plan.ideas.map((idea) => {
					const status = IDEA_STATUS_META[idea.status];
					return (
						<div key={idea.key} className="flex items-center gap-3 py-3.5">
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">{idea.name}</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{idea.detail}
								</p>
							</div>
							<span className="shrink-0 font-mono text-[9px] text-muted-foreground tracking-widest">
								{idea.platform}
							</span>
							<Badge
								variant={status.badgeVariant}
								className="shrink-0 font-mono text-[10px]"
							>
								{status.label}
							</Badge>
						</div>
					);
				})}
			</div>
		</section>
	);
}
