// Curated preset palettes (contract §4) as one-click swatch cards. Applying
// records ONE set-tokens patch over all 11 token names + live-previews it;
// Save persists (spec §8). Active detection compares the panel's effective
// values (fonts normalized to curated ids, hex lowercased) to the preset.

import {
	PAGE_TOKEN_NAMES,
	type PageTokenName,
	PRESET_PALETTES,
	type PresetPalette,
} from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { Moon, Sun } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { normalizeHex } from "../../lib/preview-editor/contrast";
import { matchCuratedFontId } from "../../lib/preview-editor/parse-tokens";
import { usePageEditor } from "../../lib/use-page-editor";

const CHIP_TOKENS: readonly PageTokenName[] = [
	"background",
	"primary",
	"accent",
	"secondary",
	"foreground",
];

function normalizeTokenValue(name: PageTokenName, value: string): string {
	if (name === "font-heading" || name === "font-body") {
		return matchCuratedFontId(value) ?? value;
	}
	return normalizeHex(value) ?? value.trim().toLowerCase();
}

function presetMatches(
	preset: PresetPalette,
	effective: Partial<Record<PageTokenName, string>>,
): boolean {
	return PAGE_TOKEN_NAMES.every((name) => {
		const current = effective[name];
		return (
			current !== undefined &&
			normalizeTokenValue(name, current) ===
				normalizeTokenValue(name, preset.values[name])
		);
	});
}

export function PresetGrid({
	effective,
}: {
	effective: Partial<Record<PageTokenName, string>>;
}) {
	const { t } = useTranslation();
	const editor = usePageEditor();

	return (
		<div className="grid grid-cols-2 gap-2">
			{PRESET_PALETTES.map((preset) => {
				const active = presetMatches(preset, effective);
				return (
					<button
						key={preset.id}
						type="button"
						aria-pressed={active}
						onClick={() =>
							editor.applyTokens({ ...preset.values }, { ...preset.values })
						}
						className={cn(
							"flex flex-col gap-1.5 rounded-lg border bg-background p-2 text-start transition-colors hover:border-primary/40",
							active && "border-primary ring-1 ring-primary/40",
						)}
					>
						<span className="flex items-center gap-1">
							<span className="min-w-0 flex-1 truncate font-medium text-xs">
								{preset.name}
							</span>
							{preset.rtlFriendly ? (
								<span
									role="img"
									aria-label={t("workspace.page.editor.presetRtl")}
									title={t("workspace.page.editor.presetRtl")}
									className="grid size-4 shrink-0 place-items-center rounded-full bg-muted font-medium text-[10px] text-muted-foreground"
								>
									ع
								</span>
							) : null}
							{preset.mode === "dark" ? (
								<Moon
									aria-label={t("workspace.page.editor.presetDark")}
									className="size-3 shrink-0 text-muted-foreground"
								/>
							) : (
								<Sun
									aria-label={t("workspace.page.editor.presetLight")}
									className="size-3 shrink-0 text-muted-foreground"
								/>
							)}
						</span>
						<span className="flex h-4 overflow-hidden rounded-sm border border-black/5">
							{CHIP_TOKENS.map((token) => (
								<span
									key={token}
									aria-hidden
									className="min-w-0 flex-1"
									style={{ backgroundColor: preset.values[token] }}
								/>
							))}
						</span>
					</button>
				);
			})}
		</div>
	);
}
