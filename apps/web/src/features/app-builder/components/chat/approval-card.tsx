/**
 * Approval the agent asks before it runs a host tool: a shield medallion, a
 * plain-language title, the agent's reason, and the raw tool input behind
 * "Details", then Deny and Approve pills while the decision is open. An open
 * card gets a spark border to ask for attention. Once a later user turn
 * answers, the card shows the decision line and no buttons. Rendered by
 * chat-message.tsx for each `data-approval` part.
 * Pure presentation: `onDecide` hands the choice to the caller, who sends it.
 */

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CheckCircleIcon } from "@phosphor-icons/react/CheckCircle";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { XCircleIcon } from "@phosphor-icons/react/XCircle";
import { requestNetworkHostToolInputSchema } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import {
	CARD_PRIMARY_PILL_CLASS,
	CARD_SECONDARY_PILL_CLASS,
	CardMedallion,
	MessageCard,
} from "./message-card";

// LIMIT: the details show the first 2 000 characters of the tool input.
// Upgrade: a scroll area with the full input.
const INPUT_PREVIEW_MAX_CHARS = 2000;

/** Props of one `data-approval` part, as chat-message.tsx passes them. */
export type ApprovalCardProps = {
	/** Host tool that waits, for example "request_network_host". Picks the title. */
	toolName: string;
	/** JSON text of the tool call input, as the harness reported it. */
	input: string;
	/** The stored decision; null while open or unknown after a reload. */
	decision: "approved" | "denied" | null;
	/** True while the card waits for the user; false once a later user turn answered. */
	isOpen: boolean;
	/** Hands the decision to the caller, who sends it as the next turn's approval answer. */
	onDecide: (approved: boolean) => void;
};

/** The approval card: title and details always; buttons open, decision line closed. */
export function ApprovalCard({
	toolName,
	input,
	decision,
	isOpen,
	onDecide,
}: ApprovalCardProps) {
	const { t } = useTranslation();
	// A reload after the answer can leave `decision` null; "answered" covers it.
	const decisionLabel =
		decision === "approved"
			? t("appBuilder.chat.approval.approved")
			: decision === "denied"
				? t("appBuilder.chat.approval.denied")
				: t("appBuilder.chat.approval.answered");

	// The input is JSON text from the harness. Broken text gets the generic
	// title; the raw text stays readable in the details.
	let json: unknown = null;
	try {
		json = JSON.parse(input);
	} catch {
		json = null;
	}
	const network =
		toolName === "request_network_host"
			? requestNetworkHostToolInputSchema.safeParse(json)
			: null;
	const title = network?.success
		? t("appBuilder.chat.approvalTitles.request_network_host", {
				host: network.data.host,
			})
		: toolName === "run_sql_write"
			? t("appBuilder.chat.approvalTitles.run_sql_write")
			: toolName === "apply_destructive_migration"
				? t("appBuilder.chat.approvalTitles.apply_destructive_migration")
				: t("appBuilder.chat.approvalTitles.other");

	return (
		<MessageCard
			className={cn(
				"flex items-start gap-3",
				// An open approval stops the turn, so its border asks for attention. The halo is spark (#faab3f) at 12 %.
				isOpen &&
					"border-spark/60 shadow-[0_0_0_3px_rgb(250_171_63/0.12)] dark:border-spark/50",
			)}
		>
			<CardMedallion icon={ShieldCheckIcon} />
			<div className="min-w-0 flex-1 pt-0.5">
				<p
					dir="auto"
					className="font-grotesk font-semibold text-[14px] text-night leading-snug dark:text-foreground"
				>
					{title}
				</p>
				{network?.success ? (
					<p
						dir="auto"
						className="mt-1 font-sans text-[14px] text-night/70 leading-relaxed dark:text-foreground/70"
					>
						{network.data.reason}
					</p>
				) : null}
				<Collapsible className="mt-2">
					<CollapsibleTrigger className="group flex items-center gap-1 rounded-sm font-grotesk font-medium text-[12px] text-night/50 outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/50 dark:hover:text-foreground">
						{t("appBuilder.chat.details")}
						<CaretDownIcon
							weight="bold"
							className="size-3 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
							aria-hidden
						/>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<pre
							dir="ltr"
							className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-[12px] border border-night/[0.07] bg-night/[0.025] p-2.5 font-mono text-[12px] text-night/80 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-foreground/80"
						>
							{input.slice(0, INPUT_PREVIEW_MAX_CHARS)}
						</pre>
					</CollapsibleContent>
				</Collapsible>
				{isOpen ? (
					<div className="mt-3 flex justify-end gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => onDecide(false)}
							className={CARD_SECONDARY_PILL_CLASS}
						>
							{t("appBuilder.chat.approval.deny")}
						</Button>
						<Button
							size="sm"
							onClick={() => onDecide(true)}
							className={CARD_PRIMARY_PILL_CLASS}
						>
							{t("appBuilder.chat.approval.approve")}
						</Button>
					</div>
				) : (
					<div className="mt-3 flex items-center gap-1.5 font-grotesk font-medium text-[13px] text-night/70 dark:text-foreground/70">
						{/* Green only for a yes; a no or an unknown answer stays quiet. */}
						{decision === "denied" ? (
							<XCircleIcon
								weight="fill"
								className="size-4 shrink-0 text-night/35 dark:text-foreground/35"
								aria-hidden
							/>
						) : (
							<CheckCircleIcon
								weight="fill"
								className={cn(
									"size-4 shrink-0",
									decision === "approved"
										? "text-success"
										: "text-night/35 dark:text-foreground/35",
								)}
								aria-hidden
							/>
						)}
						<span>{decisionLabel}</span>
					</div>
				)}
			</div>
		</MessageCard>
	);
}
