/**
 * Approval the agent asks before it runs a tool: the tool input as JSON,
 * then Approve and Deny buttons while the decision is open. Once a later
 * user turn answers, the card shows the decision with a check mark and no
 * buttons. Rendered by chat-message.tsx for each `data-approval` part.
 * Pure presentation: `onDecide` hands the choice to the caller, who sends it.
 */

import { Button } from "@wandit/ui/components/button";
import { CircleCheck } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { MessageCard } from "./message-card";

// LIMIT: the card shows the first 2 000 characters of the tool input.
// Upgrade: an expand control for the full input.
const INPUT_PREVIEW_MAX_CHARS = 2000;

/** Props of one `data-approval` part, as chat-message.tsx passes them. */
export type ApprovalCardProps = {
	/** Harness name of the tool that waits, for example "Bash". Shown in the title. */
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

/** The approval card: title and input always; buttons open, decision line closed. */
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

	return (
		<MessageCard className="p-4">
			<p dir="auto" className="font-semibold text-sm">
				{t("appBuilder.chat.approval.title", { tool: toolName })}
			</p>
			<pre
				dir="ltr"
				className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border bg-muted p-2 font-mono text-[12px]"
			>
				{input.slice(0, INPUT_PREVIEW_MAX_CHARS)}
			</pre>
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
