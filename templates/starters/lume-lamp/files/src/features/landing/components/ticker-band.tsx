// The ink ribbon between the hero and the design chapter: four lamp facts that move in a loop.
// LandingPage renders it. landing.css moves the track by -50%, so two equal chunks make a seamless loop.
// With reduced motion the track stands still. Screen readers skip it: the facts repeat later on the page.
import { useT } from "~/shared/i18n";

/** One chunk: the four facts two times, each with a brass dot after it. */
function TickerChunk() {
	const { t } = useT();
	const items = [
		{ lead: t("ticker.item1"), turn: t("ticker.item1Turn"), end: "" },
		{
			lead: t("ticker.item2"),
			turn: t("ticker.item2Turn"),
			end: t("ticker.item2End"),
		},
		{ lead: t("ticker.item3"), turn: "", end: "" },
		{ lead: t("ticker.item4"), turn: t("ticker.item4Turn"), end: "" },
	];
	// Two passes, so one chunk is wider than a 1600px screen.
	const passes = ["a", "b"];
	return (
		<div className="flex flex-none items-baseline whitespace-nowrap">
			{passes.flatMap((pass) =>
				items.map((item) => (
					<span key={`${pass}-${item.lead}`} className="flex items-baseline">
						<span className="px-[1.4rem] font-display text-[1.05rem] tracking-[0.06em]">
							{item.lead}
							{item.turn !== "" && (
								<>
									{" "}
									<em className="lume-serif text-(--lume-brass-light) tracking-normal">
										{item.turn}
									</em>
								</>
							)}
							{item.end !== "" && ` ${item.end}`}
						</span>
						<span className="text-primary">·</span>
					</span>
				)),
			)}
		</div>
	);
}

/** Full bleed, about 3.3rem tall, with a faint brass line above and below. */
export function TickerBand() {
	return (
		<div
			aria-hidden="true"
			className="overflow-hidden border-primary/15 border-y bg-foreground py-[1.05rem] text-background"
		>
			<div className="lume-ticker-track">
				<TickerChunk />
				<TickerChunk />
			</div>
		</div>
	);
}
