// Apps page — a real route, but the feature itself is still cooking: a
// polished coming-soon teaser for connecting external apps (ads platforms,
// sheets, messaging) at the dashboard level. Same visual language as the
// dashboard's empty states: dotted backdrop, card tile, display heading.

import {
	Blocks,
	Clapperboard,
	Megaphone,
	MessageCircle,
	Table2,
	Truck,
} from "lucide-react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { DashboardShell } from "../components/shell/dashboard-shell";

const PREVIEW_TILES: Array<{
	key: string;
	icon: typeof Megaphone;
	nameKey: TranslationKey;
	hintKey: TranslationKey;
}> = [
	{
		key: "metaAds",
		icon: Megaphone,
		nameKey: "projects.appsPage.tiles.metaAds.name",
		hintKey: "projects.appsPage.tiles.metaAds.hint",
	},
	{
		key: "tiktokAds",
		icon: Clapperboard,
		nameKey: "projects.appsPage.tiles.tiktokAds.name",
		hintKey: "projects.appsPage.tiles.tiktokAds.hint",
	},
	{
		key: "sheets",
		icon: Table2,
		nameKey: "projects.appsPage.tiles.sheets.name",
		hintKey: "projects.appsPage.tiles.sheets.hint",
	},
	{
		key: "whatsapp",
		icon: MessageCircle,
		nameKey: "projects.appsPage.tiles.whatsapp.name",
		hintKey: "projects.appsPage.tiles.whatsapp.hint",
	},
	{
		key: "codPilot",
		icon: Truck,
		nameKey: "projects.appsPage.tiles.codPilot.name",
		hintKey: "projects.appsPage.tiles.codPilot.hint",
	},
];

export default function AppsPage() {
	const { t } = useTranslation();

	return (
		<DashboardShell titleKey="projects.nav.apps">
			<div className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-dots"
				/>
				<div className="relative flex w-full max-w-xl flex-col items-center text-center">
					<div className="flex size-14 items-center justify-center rounded-2xl border bg-card shadow-xs">
						<Blocks className="size-6 text-primary" />
					</div>
					<span className="mt-5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{t("projects.appsPage.badge")}
					</span>
					<h2 className="mt-3 font-display font-semibold text-2xl tracking-tight md:text-3xl">
						{t("projects.appsPage.heading")}
					</h2>
					<p className="mt-2 max-w-md text-balance text-muted-foreground text-sm">
						{t("projects.appsPage.body")}
					</p>

					<p className="mt-10 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{t("projects.appsPage.previewNote")}
					</p>
					<div className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
						{PREVIEW_TILES.map((tile) => (
							<div
								key={tile.key}
								// An odd tile count leaves the last one alone on a row;
								// stretching it across both columns keeps the grid even.
								className="flex items-center gap-3 rounded-xl border bg-card/70 p-3.5 text-start opacity-80 sm:last:odd:col-span-2"
							>
								<span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
									<tile.icon className="size-4" aria-hidden />
								</span>
								<div className="min-w-0">
									<p className="truncate font-medium text-sm">
										{t(tile.nameKey)}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{t(tile.hintKey)}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</DashboardShell>
	);
}
