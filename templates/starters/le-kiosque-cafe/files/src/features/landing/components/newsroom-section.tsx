// "The newsroom" (page 4, continued): three halftone portraits with caps bylines and a one-line column each.
// LandingPage renders it after the archives. NEWSROOM of lib/content.ts holds the people.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NEWSROOM } from "../lib/content";
import { FURNITURE } from "../lib/type-styles";
import { PortraitPlate } from "./portrait-plate";
import { SectionHead } from "./section-head";

/**
 * Three cards under a 4px ink bar each. The middle one sits lower from 1000px, as a paper staggers its photos.
 * Under 640px and from 1200px each card sets the portrait beside the byline, as a columnist block.
 */
export function NewsroomSection() {
	const { t } = useT();
	return (
		<section
			id="newsroom"
			aria-labelledby="newsroom-title"
			data-roll-group
			className="ks-wrap ks-section"
		>
			<SectionHead
				titleId="newsroom-title"
				pageKey="newsroom.page"
				titleKey="newsroom.title"
				noteKey="newsroom.note"
			/>
			<div className="grid gap-x-[clamp(1.6rem,3vw,2.6rem)] gap-y-12 min-[1000px]:grid-cols-3 min-[640px]:grid-cols-2 min-[1000px]:pb-9">
				{NEWSROOM.map((journalist, index) => (
					<article
						key={journalist.nameKey}
						data-roll
						className={cn(
							"ks-roll grid grid-cols-[7.5rem_1fr] items-start gap-x-4 border-foreground border-t-4 pt-4.5 min-[1200px]:grid-cols-[44%_1fr] min-[640px]:grid-cols-1 min-[640px]:gap-x-5",
							index === 1 && "min-[1000px]:translate-y-9",
						)}
					>
						<div className="min-[1200px]:max-w-none min-[640px]:max-w-[17rem]">
							<PortraitPlate
								face={journalist.face}
								label={t(journalist.plateKey)}
							/>
						</div>
						<div className="min-[1200px]:mt-0 min-[640px]:mt-4">
							<h3
								className={cn(
									FURNITURE,
									"font-bold text-[0.78rem] tracking-[0.12em]",
								)}
							>
								{t(journalist.nameKey)}
							</h3>
							<p
								className={cn(
									FURNITURE,
									"mt-1 font-medium text-[0.72rem] text-foreground/62 leading-snug",
								)}
							>
								{t(journalist.roleKey)}
							</p>
							<p className="mt-3 border-(--ks-rule) border-t pt-3 text-[0.98rem] italic leading-normal">
								{t(journalist.quoteKey)}
							</p>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
