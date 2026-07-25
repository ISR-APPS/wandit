// tweakcn-style theme panel (spec §8): parses the :root tokens from the
// CANONICAL html once per version, overlays pending edits, and renders a
// picker per token — 8 hex colors, radius slider, two curated font selects —
// plus the preset palettes on top and live WCAG contrast warnings
// (foreground/background, primary-foreground/primary, muted/background;
// non-hex builder values skip the check silently).

import type { PageTokenName } from "@wandit/contracts";
import { Slider } from "@wandit/ui/components/slider";
import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import {
	contrastRatio,
	formatContrastRatio,
} from "../../lib/preview-editor/contrast";
import { matchCuratedFontId } from "../../lib/preview-editor/parse-tokens";
import { usePageEditor } from "../../lib/use-page-editor";
import { ColorField, FontSelect } from "./inspector-controls";
import { PresetGrid } from "./preset-grid";

const COLOR_TOKENS: readonly Extract<
	PageTokenName,
	| "background"
	| "foreground"
	| "primary"
	| "primary-foreground"
	| "secondary"
	| "accent"
	| "muted"
	| "border"
>[] = [
	"background",
	"foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"accent",
	"muted",
	"border",
];

/** Contrast pair per token row the warning renders UNDER. */
const CONTRAST_PAIRS: Partial<
	Record<PageTokenName, readonly [PageTokenName, PageTokenName]>
> = {
	foreground: ["foreground", "background"],
	"primary-foreground": ["primary-foreground", "primary"],
	muted: ["muted", "background"],
};

const MIN_CONTRAST = 4.5;

function parseRadiusRem(value: string | undefined): number {
	if (!value) return 0.75;
	const match = /^(\d+(?:\.\d+)?)(px|rem|em)$/.exec(value.trim());
	if (!match) return 0.75;
	const amount = Number.parseFloat(match[1] ?? "0");
	return match[2] === "px" ? amount / 16 : amount;
}

function formatRem(value: number): string {
	return `${Number(value.toFixed(3))}rem`;
}

export function ThemePanel({
	baseTokens,
}: {
	baseTokens: Partial<Record<PageTokenName, string>>;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();

	const effective = useMemo(
		() => ({ ...baseTokens, ...editor.pendingTokens }),
		[baseTokens, editor.pendingTokens],
	);

	const change = (patch: Partial<Record<PageTokenName, string>>) => {
		editor.applyTokens(patch, { ...effective, ...patch });
	};

	const radiusRem = parseRadiusRem(effective.radius);
	const headingFont = matchCuratedFontId(effective["font-heading"] ?? "");
	const bodyFont = matchCuratedFontId(effective["font-body"] ?? "");

	return (
		<section className="flex flex-col gap-4 p-3.5">
			<header className="flex flex-col gap-0.5">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					{t("workspace.page.editor.theme")}
				</span>
			</header>

			<div className="flex flex-col gap-2">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.presets")}
				</span>
				<PresetGrid effective={effective} />
			</div>

			<div className="flex flex-col gap-2.5">
				{COLOR_TOKENS.map((token) => {
					const pair = CONTRAST_PAIRS[token];
					const ratio = pair
						? contrastRatio(effective[pair[0]] ?? "", effective[pair[1]] ?? "")
						: null;
					const lowContrast = ratio !== null && ratio < MIN_CONTRAST;
					return (
						<div key={token} className="flex flex-col gap-1">
							<ColorField
								label={t(`workspace.page.editor.tokens.${token}`)}
								value={effective[token] ?? ""}
								onChange={(hex) => change({ [token]: hex })}
							/>
							{lowContrast ? (
								<p className="flex items-start gap-1.5 text-[11px] text-amber-700 leading-snug dark:text-amber-500">
									<AlertTriangle
										className="mt-px size-3 shrink-0"
										aria-hidden
									/>
									{t("workspace.page.editor.contrastWarning", {
										ratio: formatContrastRatio(ratio),
									})}
								</p>
							) : null}
						</div>
					);
				})}
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-foreground/80 text-xs">
						{t("workspace.page.editor.radius")}
					</span>
					<span dir="ltr" className="font-mono text-muted-foreground text-xs">
						{formatRem(radiusRem)}
					</span>
				</div>
				<Slider
					min={0}
					max={2}
					step={0.125}
					value={[Math.min(2, Math.max(0, radiusRem))]}
					onValueChange={([next]) => {
						if (typeof next === "number") change({ radius: formatRem(next) });
					}}
					aria-label={t("workspace.page.editor.radius")}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.tokens.font-heading")}
				</span>
				<FontSelect
					value={headingFont}
					onChange={(id) => change({ "font-heading": id })}
					capability="heading"
					placeholder={t("workspace.page.editor.pageFont")}
					ariaLabel={t("workspace.page.editor.tokens.font-heading")}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="text-foreground/80 text-xs">
					{t("workspace.page.editor.tokens.font-body")}
				</span>
				<FontSelect
					value={bodyFont}
					onChange={(id) => change({ "font-body": id })}
					capability="body"
					placeholder={t("workspace.page.editor.pageFont")}
					ariaLabel={t("workspace.page.editor.tokens.font-body")}
				/>
			</div>
		</section>
	);
}
