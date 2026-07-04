// Assets "Canvas" view: the same assets as a pannable, zoomable mood board
// instead of a strict grid — each card sits in a reserved cell so it can
// never overlap, jittered with a small deterministic rotation/offset per
// version id so the board reads as scattered rather than mechanical.

import { Button } from "@wandit/ui/components/button";
import { Separator } from "@wandit/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { Minus, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { PageVersion } from "../../api/dto";
import { hashString } from "../../lib/helpers";
import { AssetCard } from "./asset-card";

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.3;
const ZOOM_STEP = 0.1;

/** Small deterministic scatter so the same version always lands the same way. */
function boardJitter(seed: string) {
	const hash = hashString(seed);
	const rotate = ((hash % 7) - 3) * 1.1; // -3.3..3.3deg
	const translateY = (((hash >> 3) % 9) - 4) * 5; // -20..20px
	return { rotate, translateY };
}

/**
 * Jitter is set as custom properties, read by a `transform:` *class* (not an
 * inline `transform`) — an inline transform would always beat a Tailwind
 * hover class on specificity, no matter what the hover class touches. The
 * hover class straightens the card by declaring its own `transform:` that
 * drops the rotate() term, which — being a class too — cleanly wins.
 */
type JitterVars = CSSProperties & { "--jr": string; "--jy": string };

export function AssetsCanvasBoard({ versions }: { versions: PageVersion[] }) {
	const { t } = useTranslation();
	const [zoom, setZoom] = useState(1);

	return (
		<div className="relative h-full min-h-0">
			<div aria-hidden className="absolute inset-0 bg-dots" />
			<div className="relative h-full overflow-auto">
				<div
					className="grid gap-x-8 gap-y-14 p-10 pb-24"
					style={{
						gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 17rem))",
						transform: `scale(${zoom})`,
						transformOrigin: "top left",
						width: `${100 / zoom}%`,
					}}
				>
					{versions.map((version) => {
						const { rotate, translateY } = boardJitter(version.id);
						const jitterVars: JitterVars = {
							"--jr": `${rotate}deg`,
							"--jy": `${translateY}px`,
						};
						return (
							<div
								key={version.id}
								style={jitterVars}
								className="transition-transform duration-200 ease-out [transform:translateY(var(--jy))_rotate(var(--jr))] hover:z-10 hover:[transform:translateY(var(--jy))]"
							>
								<AssetCard version={version} />
							</div>
						);
					})}
				</div>
			</div>

			<div className="absolute end-3 bottom-3 flex items-center gap-0.5 rounded-lg border bg-background/90 p-0.5 shadow-sm backdrop-blur-sm">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("workspace.assets.zoomOut")}
							disabled={zoom <= ZOOM_MIN}
							onClick={() =>
								setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
							}
						>
							<Minus className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top">
						{t("workspace.assets.zoomOut")}
					</TooltipContent>
				</Tooltip>
				<Separator
					orientation="vertical"
					className="mx-0.5 data-[orientation=vertical]:h-4"
				/>
				<span className="w-9 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
					{Math.round(zoom * 100)}%
				</span>
				<Separator
					orientation="vertical"
					className="mx-0.5 data-[orientation=vertical]:h-4"
				/>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("workspace.assets.zoomIn")}
							disabled={zoom >= ZOOM_MAX}
							onClick={() =>
								setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
							}
						>
							<Plus className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top">
						{t("workspace.assets.zoomIn")}
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
