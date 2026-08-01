// tweakcn-style theme panel (spec §8): parses the :root tokens from the
// CANONICAL html once per version, overlays pending edits, and renders a
// picker per token — 8 hex colors, radius slider, two curated font selects —
// plus the preset palettes on top and live WCAG contrast warnings
// (foreground/background, primary-foreground/primary, muted/background).

import type { PageTokenName } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Slider } from "@wandit/ui/components/slider";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import {
	usePageVersionsQuery,
	useVersionHtmlQuery,
} from "../../api/pages.queries";
import {
	contrastRatio,
	cssColorToHex,
	formatContrastRatio,
} from "../../lib/preview-editor/contrast";
import {
	extractGoogleFontStylesheetHrefs,
	hasCompletePageTheme,
	matchCuratedFontId,
	type PageColorScheme,
	parsePageTokens,
	tokensEqual,
} from "../../lib/preview-editor/parse-tokens";
import { useWorkspace } from "../../lib/store";
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
const RADIUS_SLIDER_MAX_REM = 2;

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

function useOriginalTheme(projectId: string) {
	const versionsQuery = usePageVersionsQuery(projectId);
	const originalVersionId = useMemo(
		() => versionsQuery.data?.find((version) => version.isBuilderOrigin)?.id,
		[versionsQuery.data],
	);
	const htmlQuery = useVersionHtmlQuery(originalVersionId);
	const tokens = useMemo(
		() => (htmlQuery.data?.html ? parsePageTokens(htmlQuery.data.html) : {}),
		[htmlQuery.data?.html],
	);
	const fontStylesheetHrefs = useMemo(
		() =>
			htmlQuery.data?.html
				? extractGoogleFontStylesheetHrefs(htmlQuery.data.html)
				: [],
		[htmlQuery.data?.html],
	);
	const isLoading =
		versionsQuery.isPending ||
		(Boolean(originalVersionId) && htmlQuery.isPending);

	return { tokens, fontStylesheetHrefs, isLoading };
}

export function ThemePanel({
	baseTokens,
	colorScheme = null,
}: {
	baseTokens: Partial<Record<PageTokenName, string>>;
	colorScheme?: PageColorScheme;
}) {
	const { t } = useTranslation();
	const { projectId } = useWorkspace();
	const editor = usePageEditor();
	const themeEnabled = hasCompletePageTheme(baseTokens);
	const originalTheme = useOriginalTheme(projectId);
	const originalThemeComplete = hasCompletePageTheme(originalTheme.tokens);

	const effective = useMemo(
		() => ({
			...(editor.pendingTokensReset ? originalTheme.tokens : baseTokens),
			...editor.pendingTokens,
		}),
		[
			baseTokens,
			editor.pendingTokens,
			editor.pendingTokensReset,
			originalTheme.tokens,
		],
	);
	const resetUnavailable = !originalTheme.isLoading && !originalThemeComplete;
	const resetDisabled =
		!themeEnabled ||
		originalTheme.isLoading ||
		!originalThemeComplete ||
		tokensEqual(effective, originalTheme.tokens);
	const resetLabel = t("workspace.page.editor.themeReset");
	const resetUnavailableLabel = t(
		"workspace.page.editor.themeResetUnavailable",
	);

	const change = (patch: Partial<Record<PageTokenName, string>>) => {
		if (!themeEnabled) return;
		const changed = Object.fromEntries(
			Object.entries(patch).filter(
				([name, value]) => effective[name as PageTokenName] !== value,
			),
		) as Partial<Record<PageTokenName, string>>;
		if (Object.keys(changed).length === 0) return;
		editor.applyTokens(changed, { ...effective, ...changed });
	};

	const radiusRem = parseRadiusRem(effective.radius);
	const radiusExceedsSlider = radiusRem > RADIUS_SLIDER_MAX_REM;
	const headingFont = matchCuratedFontId(effective["font-heading"] ?? "");
	const bodyFont = matchCuratedFontId(effective["font-body"] ?? "");

	return (
		<section className="flex flex-col gap-4 p-3.5">
			<header className="flex flex-col gap-0.5">
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					{t("workspace.page.editor.theme")}
				</span>
			</header>

			{themeEnabled ? null : (
				<p
					role="status"
					className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-amber-800 text-xs leading-relaxed dark:text-amber-300"
				>
					{t("workspace.page.editor.themeLegacyNotice")}
				</p>
			)}

			<fieldset
				disabled={!themeEnabled}
				aria-label={t("workspace.page.editor.theme")}
				className="flex flex-col gap-4 border-0 p-0 disabled:pointer-events-none disabled:opacity-50"
			>
				<div className="flex flex-col gap-2">
					<span className="text-foreground/80 text-xs">
						{t("workspace.page.editor.presets")}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full"
						disabled={resetDisabled}
						aria-label={resetLabel}
						aria-describedby={
							resetUnavailable ? "theme-reset-unavailable" : undefined
						}
						aria-busy={originalTheme.isLoading || undefined}
						title={resetUnavailable ? resetUnavailableLabel : undefined}
						onClick={() => {
							if (resetDisabled) return;
							editor.resetTokens(
								originalTheme.tokens,
								baseTokens,
								originalTheme.fontStylesheetHrefs,
							);
						}}
					>
						<RotateCcw className="size-3.5" aria-hidden />
						{resetLabel}
					</Button>
					{resetUnavailable ? (
						<p
							id="theme-reset-unavailable"
							role="status"
							className="text-[11px] text-muted-foreground leading-snug"
						>
							{resetUnavailableLabel}
						</p>
					) : null}
					<PresetGrid
						effective={effective}
						colorScheme={colorScheme}
						disabled={!themeEnabled}
					/>
				</div>

				<div className="flex flex-col gap-2.5">
					{COLOR_TOKENS.map((token) => {
						const pair = CONTRAST_PAIRS[token];
						const first = pair ? cssColorToHex(effective[pair[0]] ?? "") : null;
						const second = pair
							? cssColorToHex(effective[pair[1]] ?? "")
							: null;
						const ratio = first && second ? contrastRatio(first, second) : null;
						const lowContrast = ratio !== null && ratio < MIN_CONTRAST;
						const rawValue = effective[token] ?? "";
						return (
							<div key={token} className="flex flex-col gap-1">
								<ColorField
									label={t(`workspace.page.editor.tokens.${token}`)}
									value={cssColorToHex(rawValue) ?? rawValue}
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
						<span
							dir={radiusExceedsSlider ? undefined : "ltr"}
							className="font-mono text-muted-foreground text-xs"
						>
							{radiusExceedsSlider
								? t("workspace.page.editor.radiusFull")
								: formatRem(radiusRem)}
						</span>
					</div>
					<Slider
						disabled={!themeEnabled}
						min={0}
						max={RADIUS_SLIDER_MAX_REM}
						step={0.125}
						value={[Math.min(RADIUS_SLIDER_MAX_REM, Math.max(0, radiusRem))]}
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
			</fieldset>
		</section>
	);
}
