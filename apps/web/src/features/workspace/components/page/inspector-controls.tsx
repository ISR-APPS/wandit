// Small shared controls for the inspector rail (element + theme panels):
// a hex color field (native color input + mono hex text — no color-picker
// primitive exists in @wandit/ui, the native input is the decision) and the
// curated-font Select (contract §3: heading-capable fonts for --font-heading,
// body-capable for --font-body; Arabic-capable group listed first).

import { CURATED_FONTS, type CuratedFontId } from "@wandit/contracts";
import { Input } from "@wandit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { normalizeHex } from "../../lib/preview-editor/contrast";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Label + swatch + hex text. `value` may be any raw CSS color the builder
 * wrote; non-hex values render as read-back text with a neutral swatch until
 * the user picks a hex (the ops pipeline only accepts hex — contract §6).
 */
export function ColorField({
	label,
	value,
	onChange,
	className,
}: {
	label: string;
	value: string;
	onChange: (hex: string) => void;
	className?: string;
}) {
	const hex = normalizeHex(value);
	// Text buffer only while typing; commits every keystroke that IS valid hex.
	const [draft, setDraft] = useState<string | null>(null);

	const commitDraft = (next: string) => {
		setDraft(next);
		if (HEX_RE.test(next.trim())) onChange(next.trim());
	};

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<span className="min-w-0 flex-1 truncate text-foreground/80 text-xs">
				{label}
			</span>
			<input
				type="color"
				aria-label={label}
				value={hex ?? "#000000"}
				onChange={(event) => {
					setDraft(null);
					onChange(event.target.value);
				}}
				className="size-7 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
			/>
			<Input
				dir="ltr"
				value={draft ?? hex ?? value}
				onChange={(event) => commitDraft(event.target.value)}
				onBlur={() => setDraft(null)}
				spellCheck={false}
				className="h-7 w-[88px] shrink-0 px-2 font-mono text-xs"
			/>
		</div>
	);
}

/**
 * Curated-font picker. `value` is a curated id or null (page uses a
 * non-curated font → placeholder). Capability filters per token role.
 */
export function FontSelect({
	value,
	onChange,
	capability,
	placeholder,
	ariaLabel,
}: {
	value: CuratedFontId | null;
	onChange: (id: CuratedFontId) => void;
	capability: "heading" | "body" | "any";
	placeholder: string;
	ariaLabel: string;
}) {
	const { t } = useTranslation();
	const fonts = CURATED_FONTS.filter((font) =>
		capability === "any" ? true : font[capability],
	);
	const arabicFonts = fonts.filter((font) => font.arabic);
	const latinFonts = fonts.filter((font) => !font.arabic);

	return (
		<Select
			value={value ?? undefined}
			onValueChange={(next) => onChange(next as CuratedFontId)}
		>
			<SelectTrigger
				size="sm"
				aria-label={ariaLabel}
				className="w-full text-xs data-[size=sm]:h-8"
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>
						{t("workspace.page.editor.fontsArabicGroup")}
					</SelectLabel>
					{arabicFonts.map((font) => (
						<SelectItem key={font.id} value={font.id} className="text-xs">
							{font.family}
						</SelectItem>
					))}
				</SelectGroup>
				<SelectGroup>
					<SelectLabel>
						{t("workspace.page.editor.fontsLatinGroup")}
					</SelectLabel>
					{latinFonts.map((font) => (
						<SelectItem key={font.id} value={font.id} className="text-xs">
							{font.family}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
