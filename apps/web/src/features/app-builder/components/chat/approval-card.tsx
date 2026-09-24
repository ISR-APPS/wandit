/**
 * Approval the agent asks before it runs a host tool: a plain-language
 * title, the agent's reason, and the raw tool input behind "Details", then
 * Approve and Deny buttons while the decision is open. Once a later user
 * turn answers, the card shows the decision with a check mark and no
 * buttons. Rendered by chat-message.tsx for each `data-approval` part.
 * Pure presentation: `onDecide` hands the choice to the caller, who sends it.
 */

import { requestNetworkHostToolInputSchema } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
import { ChevronDown, CircleCheck } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { MessageCard } from "./message-card";

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
		<MessageCard className="p-4">
			<p dir="auto" className="font-semibold text-sm">
				{title}
			</p>
			{network?.success ? (
				<p dir="auto" className="mt-1 text-muted-foreground text-sm">
					{network.data.reason}
				</p>
			) : null}
			<Collapsible className="mt-2">
				<CollapsibleTrigger className="group flex items-center gap-1 rounded-sm text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
					{t("appBuilder.chat.details")}
					<ChevronDown
						className="size-3 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
						aria-hidden
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<pre
						dir="ltr"
						className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border bg-muted p-2 font-mono text-[12px]"
					>
						{input.slice(0, INPUT_PREVIEW_MAX_CHARS)}
					</pre>
				</CollapsibleContent>
			</Collapsible>
			{isOpen ? (
				<div className="mt-3 flex justify-end gap-2">
					<Button size="sm" variant="outline" onClick={() => onDecide(false)}>
						{t("appBuilder.chat.approval.deny")}
					</Button>
					<Button size="sm" onClick={() => onDecide(true)}>
						{t("appBuilder.chat.approval.approve")}
					</Button>
				</div>
			) : (
				<div className="mt-3 flex items-center gap-2 text-sm">
					<CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
					<span>{decisionLabel}</span>
				</div>
			)}
		</MessageCard>
	);
}
