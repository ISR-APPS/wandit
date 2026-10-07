/**
 * The plan of a Plan Mode turn in the thread. An open card shows the whole
 * plan: the title, the summary, the numbered sections, the choices the
 * agent made, and the "Build this plan" pill. A closed card (a later reply
 * exists) keeps the title and the summary, and hides the rest behind a
 * disclosure. Rendered by chat-message.tsx for each `data-plan` part. Pure
 * presentation: `onBuild` hands the build to the caller, who sends it.
 */

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { HammerIcon } from "@phosphor-icons/react/Hammer";
import { LightbulbIcon } from "@phosphor-icons/react/Lightbulb";
import { ListChecksIcon } from "@phosphor-icons/react/ListChecks";
import type { TurnPlanData } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
import { cn } from "@wandit/ui/lib/utils";
import { MotionConfig, motion } from "motion/react";
import { useState } from "react";

import { formatNumber, useTranslation } from "@/lib/i18n";
import { BOOT_EASE } from "../../lib/constants";
import {
	CARD_PRIMARY_PILL_CLASS,
	CardMedallion,
	MessageCard,
} from "./message-card";

/** Props of one `data-plan` part, as chat-message.tsx passes them. */
export type PlanCardProps = {
	/** The plan the agent wrote with `present_plan`, in the user's language. */
	plan: TurnPlanData;
	/** True while no reply follows the card and no turn runs (lib/turn-parts.ts). Only an open card shows the button. */
	isOpen: boolean;
	/** Sends the build turn. Null while a send is in flight: the button is then disabled. */
	onBuild: (() => void) | null;
};

// A bullet as a small round dot at the start of the line. It sits on the
// first text line, also when the item wraps. The color class comes per list.
const BULLET_CLASS =
	"relative ps-3.5 before:absolute before:start-0.5 before:top-[0.55em] before:size-1.5 before:rounded-full";

/** The plan card: the whole plan with the build pill while open; title and summary with a disclosure once closed. */
export function PlanCard({ plan, isOpen, onBuild }: PlanCardProps) {
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(false);
	const head = <PlanHead plan={plan} />;
	// The harness turns a malformed `present_plan` call into an empty plan.
	// A build of it gets no plan text, so only a typed reply answers it.
	const hasContent =
		plan.title.trim() !== "" ||
		plan.summary.trim() !== "" ||
		plan.sections.length > 0;

	if (!isOpen) {
		// A plan with no section and no choice has nothing to disclose.
		if (plan.sections.length === 0 && plan.assumptions.length === 0) {
			return <MessageCard className="p-0 pb-4">{head}</MessageCard>;
		}
		return (
			<MessageCard className="p-0">
				{head}
				<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
					<CollapsibleContent>
						<PlanBody plan={plan} />
					</CollapsibleContent>
					<CollapsibleTrigger className="group mx-4 mt-2.5 mb-3.5 flex items-center gap-1 rounded-sm font-grotesk font-medium text-[12.5px] text-night/55 outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/55 dark:hover:text-foreground">
						{t(
							isExpanded
								? "appBuilder.chat.plan.hideFull"
								: "appBuilder.chat.plan.showFull",
						)}
						<CaretDownIcon
							weight="bold"
							className="size-3 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
							aria-hidden
						/>
					</CollapsibleTrigger>
				</Collapsible>
			</MessageCard>
		);
	}

	return (
		// The card arrives when the turn ends, so it rises in once. Reduced motion keeps only the fade.
		<MotionConfig reducedMotion="user">
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.32, ease: BOOT_EASE }}
			>
				{/* An open plan waits for the user, so its border asks for attention like an open approval. The halo is spark (#faab3f) at 12 %. */}
				<MessageCard className="overflow-hidden border-spark/60 p-0 shadow-[0_0_0_3px_rgb(250_171_63/0.12)] dark:border-spark/50">
					{head}
					<PlanBody plan={plan} />
					<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-night/[0.07] border-t bg-night/[0.015] px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
						{hasContent ? (
							<Button
								size="sm"
								disabled={onBuild === null}
								onClick={onBuild ?? undefined}
								className={cn(CARD_PRIMARY_PILL_CLASS, "gap-1.5")}
							>
								<HammerIcon weight="bold" aria-hidden />
								{t("appBuilder.chat.plan.build")}
							</Button>
						) : null}
						<span className="font-sans text-[12.5px] text-night/55 leading-snug dark:text-foreground/55">
							{t("appBuilder.chat.plan.changeHint")}
						</span>
					</div>
				</MessageCard>
			</motion.div>
		</MotionConfig>
	);
}

/** The medallion, the "Plan" eyebrow, the title, and the summary. Empty texts leave their line out. */
function PlanHead({ plan }: { plan: TurnPlanData }) {
	const { t } = useTranslation();
	return (
		<div className="px-4 pt-4">
			<div className="flex items-center gap-3">
				<CardMedallion icon={ListChecksIcon} />
				<div className="min-w-0">
					<p className="font-grotesk font-semibold text-[11px] text-ember-text uppercase tracking-[0.08em] rtl:tracking-normal">
						{t("appBuilder.chat.plan.eyebrow")}
					</p>
					{plan.title.trim() !== "" ? (
						<h3
							dir="auto"
							className="font-grotesk font-semibold text-[16px] text-night leading-snug dark:text-foreground"
						>
							{plan.title}
						</h3>
					) : null}
				</div>
			</div>
			{plan.summary.trim() !== "" ? (
				<p
					dir="auto"
					className="mt-2.5 font-sans text-[14px] text-night/75 leading-relaxed dark:text-foreground/75"
				>
					{plan.summary}
				</p>
			) : null}
		</div>
	);
}

/** The numbered sections with their bullets, then the choices the agent made. Hidden parts: no section, no choice. */
function PlanBody({ plan }: { plan: TurnPlanData }) {
	const { t, locale } = useTranslation();
	return (
		<>
			{plan.sections.length > 0 ? (
				<ol className="mt-4 flex flex-col gap-3.5 px-4">
					{plan.sections.map((section, index) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: one present_plan call fixes the list. It never reorders, and two lines can have the same text.
							key={index}
							className="grid grid-cols-[22px_1fr] gap-x-2.5"
						>
							<span
								aria-hidden
								className="grid size-[22px] place-items-center rounded-full bg-night/[0.05] font-grotesk font-semibold text-[11px] text-night/60 tabular-nums dark:bg-white/[0.07] dark:text-foreground/60"
							>
								{formatNumber(index + 1, locale)}
							</span>
							<div className="min-w-0 pt-px">
								<h4
									dir="auto"
									className="font-grotesk font-semibold text-[13.5px] text-night leading-snug dark:text-foreground"
								>
									{section.title}
								</h4>
								{section.items.length > 0 ? (
									<ul className="mt-1.5 flex flex-col gap-1">
										{section.items.map((item, itemIndex) => (
											<li
												// biome-ignore lint/suspicious/noArrayIndexKey: one present_plan call fixes the list. It never reorders, and two lines can have the same text.
												key={itemIndex}
												dir="auto"
												className={cn(
													BULLET_CLASS,
													"font-sans text-[13.5px] text-night/75 leading-snug before:bg-ember/70 dark:text-foreground/75 dark:before:bg-spark/70",
												)}
											>
												{item}
											</li>
										))}
									</ul>
								) : null}
							</div>
						</li>
					))}
				</ol>
			) : null}
			{plan.assumptions.length > 0 ? (
				<div className="mx-4 mt-4 rounded-[14px] bg-sand px-3 py-2.5 dark:bg-white/[0.04]">
					<p className="flex items-center gap-1.5 font-grotesk font-medium text-[12px] text-night/60 dark:text-foreground/60">
						<LightbulbIcon
							weight="duotone"
							className="size-3.5 shrink-0 text-spark-deep dark:text-spark"
							aria-hidden
						/>
						{t("appBuilder.chat.plan.assumptions")}
					</p>
					<ul className="mt-1.5 flex flex-col gap-1">
						{plan.assumptions.map((assumption, index) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: one present_plan call fixes the list. It never reorders, and two lines can have the same text.
								key={index}
								dir="auto"
								className={cn(
									BULLET_CLASS,
									"font-sans text-[13px] text-night/65 leading-snug before:bg-night/25 dark:text-foreground/65 dark:before:bg-white/25",
								)}
							>
								{assumption}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</>
	);
}
