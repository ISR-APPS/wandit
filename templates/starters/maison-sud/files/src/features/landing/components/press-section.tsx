// The press section: one quote in the serif, with no photograph, and a hairline rail of publication names.
// It is the only social proof of the page. LandingPage renders it on the second ground.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { GRID, MICRO_CAPS_TIGHT, WRAP } from "../lib/type-styles";

// The three publications of the rail, the newest first.
const SOURCES: readonly { nameKey: TranslationKey; dateKey: TranslationKey }[] =
	[
		{ nameKey: "press.source1Name", dateKey: "press.source1Date" },
		{ nameKey: "press.source2Name", dateKey: "press.source2Date" },
		{ nameKey: "press.source3Name", dateKey: "press.source3Date" },
	];

/** Section "Press". The rail ends on the last line of the quote; the fourth column stays empty. */
export function PressSection() {
	const { t } = useT();
	return (
		<section className="bg-canvas py-(--ms-rhythm)">
			<div className={cn(WRAP, GRID, "gap-y-8")}>
				<ul
					data-reveal="lift"
					className="order-2 self-end md:order-none md:col-span-3"
				>
					{SOURCES.map((source) => (
						<li
							key={source.nameKey}
							className="border-foreground/10 border-t py-3.5 last:border-b"
						>
							<span className="block text-[0.98rem] leading-snug">
								{t(source.nameKey)}
							</span>
							<span className={cn(MICRO_CAPS_TIGHT, "mt-1 block")}>
								{t(source.dateKey)}
							</span>
						</li>
					))}
				</ul>
				<figure
					data-reveal="lift"
					className="order-1 md:order-none md:col-span-9 md:col-start-4 lg:col-span-8 lg:col-start-5"
				>
					<blockquote className="ms-serif text-[clamp(1.5rem,3.4vw,2.7rem)] leading-[1.28]">
						{t("press.quote")}
					</blockquote>
					<figcaption className="mt-[clamp(1.8rem,3vw,2.6rem)] max-w-[34ch] border-foreground/18 border-t pt-3.5 text-[0.86rem] text-muted-foreground leading-[1.55]">
						{t("press.attribution")}
					</figcaption>
				</figure>
			</div>
		</section>
	);
}
