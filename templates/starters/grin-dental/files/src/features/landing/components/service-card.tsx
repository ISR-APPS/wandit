// One sticker of the services grid: a tilted icon tile, the title, a short text, and the price pill.
// ServicesSection renders six. The featured one (with a ribbon) is teal with a sun ribbon and a sun price.
// A die-cut dashed line rings each sticker; on hover the sticker turns straight and grows.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Service } from "../lib/content";
import { DISPLAY, PILL } from "../lib/styles";
import { ServiceIcon } from "./service-icon";

/** `index` alternates the tile color and its tilt: peach and left on even cards, mint and right on odd ones. */
export function ServiceCard({
	service,
	index,
}: {
	service: Service;
	index: number;
}) {
	const { t } = useT();
	const isFeatured = service.ribbonKey !== undefined;
	const isEven = index % 2 === 0;
	return (
		<article
			className={cn(
				"gd-sticker gd-diecut gd-tilt gd-lift relative px-5 py-5 sm:px-6.5 sm:pt-7 sm:pb-6.5",
				service.tiltClass,
				isFeatured &&
					"gd-diecut-light gd-on-dark bg-(--gd-teal) text-background",
			)}
		>
			{service.ribbonKey !== undefined && (
				<span className="gd-outline-thin gd-shadow-3 absolute end-4 -top-4 rotate-3 rounded-full bg-(--gd-sun) px-[0.95em] py-[0.34em] font-bold font-display text-[0.78rem] text-foreground uppercase tracking-[0.07em]">
					{t(service.ribbonKey)}
				</span>
			)}
			{/* On a phone the icon tile and the title share one row, so the six cards stay short. */}
			<div className="mb-3 flex items-center gap-4 sm:mb-2 sm:block">
				<div
					className={cn(
						"gd-outline-thin gd-shadow-3 flex size-14 shrink-0 items-center justify-center rounded-[calc(var(--radius)*1.25)] sm:mb-4.5 sm:size-18",
						isFeatured
							? "-rotate-3 bg-background"
							: isEven
								? "-rotate-3 bg-(--gd-peach)"
								: "rotate-3 bg-(--gd-mint)",
					)}
				>
					<ServiceIcon kind={service.icon} className="size-9 sm:size-11.5" />
				</div>
				<h3 className={cn(DISPLAY, "text-[1.45rem] leading-[1.05]")}>
					{t(service.titleKey)}
				</h3>
			</div>
			<p
				className={cn(
					"mb-5 font-bold text-[0.98rem] leading-relaxed",
					isFeatured ? "text-background/85" : "text-foreground/72",
				)}
			>
				{t(service.bodyKey)}
			</p>
			<span className={cn(PILL, "-rotate-2 bg-(--gd-sun) text-foreground")}>
				{t(service.priceKey)}
			</span>
		</article>
	);
}
