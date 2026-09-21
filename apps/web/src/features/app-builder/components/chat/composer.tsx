/**
 * Prompt box of the builder chat: focus chip, growing textarea, the add
 * context menu, the Build | Plan mode menu, credit estimate, dictation, and
 * the send button. Rendered by chat-pane.tsx. Calls `onSend` with the
 * trimmed draft; the pane runs the mutation. Local state: the draft, the
 * mode, the chip. Actions with no backend show the notWired toast.
 */

import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Textarea } from "@wandit/ui/components/textarea";
import {
	ArrowUp,
	ChevronDown,
	Crosshair,
	ImageIcon,
	LayoutTemplate,
	Mic,
	Paperclip,
	Plus,
	X,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import { COMPOSER_MODES, type ComposerMode } from "../../lib/constants";

export type ComposerProps = {
	/** Credits one turn costs, whole credits. Shown next to the mode menu. */
	turnEstimateCredits: number;
	/** Screen or element the next turn targets, or null. Shown as a chip the user can remove. */
	focusLabel: string | null;
	/** True while a turn runs or the chat is not ready yet. Locks the textarea and the send button. */
	isSending: boolean;
	onSend: (input: SendBuilderMessageInput) => void;
};

/** Round pill shared by the add context and mode triggers. Ember on hover, a soft halo while open. */
const PILL_CLASS =
	"rounded-full border-border bg-transparent shadow-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/35 hover:bg-primary/10 hover:text-foreground data-[state=open]:border-primary/40 data-[state=open]:text-foreground data-[state=open]:ring-[3px] data-[state=open]:ring-primary/10";

export function Composer({
	turnEstimateCredits,
	focusLabel,
	isSending,
	onSend,
}: ComposerProps) {
	const { t } = useTranslation();
	const [draft, setDraft] = useState("");
	const [mode, setMode] = useState<ComposerMode>("build");
	// The label the user removed. A different label from the preview shows the chip again.
	// LIMIT: the same label picked again stays hidden until a reload. Upgrade: the page clears thread.focusLabel through a mutation.
	const [clearedLabel, setClearedLabel] = useState<string | null>(null);
	const trimmed = draft.trim();
	const canSend = trimmed.length > 0 && !isSending;
	const notWired = () => toast(t("appBuilder.mock.notWired"));

	function send() {
		if (!canSend) return;
		onSend({ text: trimmed, mode });
		setDraft("");
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends. Shift+Enter, and Enter that ends an IME composition, insert a newline.
		if (
			event.key !== "Enter" ||
			event.shiftKey ||
			event.nativeEvent.isComposing
		) {
			return;
		}
		event.preventDefault();
		send();
	}

	return (
		<div className="group/prompt relative">
			{/* Soft ember ring while the textarea has focus. The card below carries the one rich shadow. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 shadow-[0_0_0_3px_oklch(0.62_0.16_45_/_0.12)] transition-opacity duration-300 group-focus-within/prompt:opacity-100"
			/>
			<div className="relative flex flex-col rounded-3xl bg-background px-4 pt-3.5 pb-3 shadow-composer dark:border dark:bg-card dark:shadow-[0_18px_40px_-20px_rgb(0_0_0_/_0.6)]">
				{focusLabel !== null && focusLabel !== clearedLabel ? (
					<span className="mb-2 flex h-6 items-center gap-1.5 self-start rounded-full border border-primary/30 bg-primary/5 ps-2.5 pe-1 text-primary text-xs">
						<Crosshair className="size-3 shrink-0" aria-hidden />
						<span dir="auto">
							{t("appBuilder.chat.focusChip", { label: focusLabel })}
						</span>
						<button
							type="button"
							aria-label={t("appBuilder.chat.removeFocus")}
							onClick={() => setClearedLabel(focusLabel)}
							className="grid size-4 place-items-center rounded-full outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50"
						>
							<X className="size-3" />
						</button>
					</span>
				) : null}
				{/* The kit textarea grows with its content (field-sizing), so no resize code here. */}
				<Textarea
					rows={1}
					dir="auto"
					value={draft}
					placeholder={t("appBuilder.chat.placeholder")}
					disabled={isSending}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					className="max-h-40 min-h-[38px] resize-none border-0 bg-transparent px-0 py-1.5 text-[15px] leading-[1.5] shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent"
				/>
				<div className="mt-1.5 flex items-center gap-1.5">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon-sm"
								aria-label={t("appBuilder.chat.addContext")}
								className={PILL_CLASS}
							>
								<Plus />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="rounded-2xl p-1.5">
							<DropdownMenuItem onSelect={notWired}>
								<Paperclip />
								{t("appBuilder.chat.attach")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={notWired}>
								<ImageIcon />
								{t("appBuilder.chat.attachImage")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={notWired}>
								<LayoutTemplate />
								{t("appBuilder.chat.attachScreen")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<span className="ms-auto text-muted-foreground text-xs">
						{t("appBuilder.chat.estimate", { count: turnEstimateCredits })}
					</span>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								aria-label={t("appBuilder.chat.modeLabel")}
								className={PILL_CLASS}
							>
								{t(`appBuilder.chat.modes.${mode}`)}
								<ChevronDown className="size-3.5 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="rounded-2xl p-1.5">
							{COMPOSER_MODES.map((option) => (
								<DropdownMenuItem key={option} onSelect={() => setMode(option)}>
									{t(`appBuilder.chat.modes.${option}`)}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("appBuilder.chat.dictate")}
						onClick={notWired}
						className="rounded-full text-muted-foreground hover:text-foreground"
					>
						<Mic />
					</Button>
					<Button
						size="icon-sm"
						aria-label={t("appBuilder.chat.send")}
						disabled={!canSend}
						onClick={send}
						// The send circle is the one control that carries the ember gradient.
						className="rounded-full bg-gradient-ember text-background shadow-[0_2px_8px_-2px_rgb(0_0_0_/_0.3)] transition-opacity hover:opacity-90 disabled:opacity-40"
					>
						<ArrowUp strokeWidth={2.2} />
					</Button>
				</div>
			</div>
		</div>
	);
}
