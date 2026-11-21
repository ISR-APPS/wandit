/**
 * The "Clone" chip of a prompt box. A click opens a small form that asks for
 * the address of a public web page. The builder composer and the dashboard
 * prompt box (features/projects, through the barrel) render it.
 * It checks the address with `publicWebUrlSchema` and gives it to the caller.
 */

import { CopySimpleIcon } from "@phosphor-icons/react/CopySimple";
import { publicWebUrlSchema } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { useId, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { PROMPT_CHIP_CLASS } from "./builder-model-picker";
import {
	PANEL_FIELD_LABEL_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
} from "./more/panel-shell";

/** Props of the Clone chip. The caller wraps it in a TooltipProvider. */
export type CloneSiteChipProps = {
	/** Gets the clone request ("Clone this website: <url>") when the user confirms a valid address. The caller puts it first in the draft. */
	onCloneRequest: (request: string) => void;
	/** True while the prompt box cannot send, for example during a send. */
	disabled?: boolean;
	/** `md` is 36 px high, for the dashboard hero box. `sm` is 32 px, for the builder composer. */
	size?: "sm" | "md";
	/** Extra classes of the "Clone" text. The builder composer makes it screen-reader only in a narrow row. */
	labelClassName?: string;
};

/**
 * A chip with the look of the Plan chip, and a popover with one address
 * field. It holds no clone state: the draft text of the caller is the state.
 */
export function CloneSiteChip({
	onCloneRequest,
	disabled = false,
	size = "sm",
	labelClassName,
}: CloneSiteChipProps) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const [address, setAddress] = useState("");
	// True after a confirm with a bad address, until the user changes the field.
	const [isAddressRefused, setIsAddressRefused] = useState(false);
	const inputId = useId();
	const errorId = useId();

	function confirm() {
		// The same guard as the `capture_site` tool, so the agent gets no address that the tool refuses.
		const parsed = publicWebUrlSchema.safeParse(address.trim());
		if (!parsed.success) {
			setIsAddressRefused(true);
			return;
		}
		onCloneRequest(t("appBuilder.chat.clone.message", { url: parsed.data }));
		setAddress("");
		setIsOpen(false);
	}

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={disabled}
							className={cn(
								PROMPT_CHIP_CLASS,
								"gap-1.5",
								// The kit `sm` size pads a button with an svg child through `has-[>svg]`, so the padding uses the same variant.
								size === "md"
									? "h-9 text-[13.5px] has-[>svg]:ps-3 has-[>svg]:pe-3.5"
									: "h-8 text-[13px] has-[>svg]:ps-2.5 has-[>svg]:pe-3",
							)}
						>
							<CopySimpleIcon
								weight="bold"
								className="size-4 shrink-0"
								aria-hidden
							/>
							<span className={labelClassName}>
								{t("appBuilder.chat.clone.toggle.label")}
							</span>
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-64 text-center">
					{t("appBuilder.chat.clone.toggle.hint")}
				</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="start"
				// On a phone the sheet keeps 12 px from each screen edge.
				className="w-80 max-w-[calc(100vw-24px)]"
				// React sends a click in this portal to the parents of the chip. The
				// dashboard prompt row then moves the focus from the field to its textarea.
				onClick={(event) => event.stopPropagation()}
			>
				<form
					// The browser check of a `url` field shows its own text, so this form shows the error.
					noValidate
					className="flex flex-col gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						confirm();
					}}
				>
					<Label htmlFor={inputId} className={PANEL_FIELD_LABEL_CLASS}>
						{t("appBuilder.chat.clone.urlLabel")}
					</Label>
					<Input
						id={inputId}
						type="url"
						dir="ltr"
						value={address}
						onChange={(event) => {
							setAddress(event.target.value);
							setIsAddressRefused(false);
						}}
						placeholder={t("appBuilder.chat.clone.urlPlaceholder")}
						aria-invalid={isAddressRefused}
						aria-describedby={isAddressRefused ? errorId : undefined}
						autoComplete="off"
						autoCapitalize="none"
						spellCheck={false}
						className={PANEL_INPUT_CLASS}
					/>
					{isAddressRefused ? (
						<p
							id={errorId}
							role="alert"
							className="px-1 text-destructive text-xs"
						>
							{t("appBuilder.chat.clone.urlInvalid")}
						</p>
					) : null}
					<p className="px-1 font-sans text-[12px] text-night/60 dark:text-foreground/60">
						{t("appBuilder.chat.clone.notice")}
					</p>
					<Button
						type="submit"
						size="sm"
						className={cn(PANEL_PRIMARY_BUTTON_CLASS, "mt-1")}
					>
						{t("appBuilder.chat.clone.confirm")}
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	);
}
