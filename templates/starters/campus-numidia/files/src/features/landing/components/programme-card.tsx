// One block of the programmes checkerboard: length, seats, name, summary, yearly price, and an apply link.
// ProgrammesSection renders four of them, each on its own ground: sky, pale sky, sand, and hairline white.
import { cn } from "~/shared/lib/utils";
import { CHIP } from "../lib/type-styles";

/** The ground of the card. Two are saturated (sky), two are light, as the world budget allows. */
type ProgrammeTone = "sky" | "pale" | "sand" | "line";

type ProgrammeCardProps = {
	tone: ProgrammeTone;
	name: string;
	/** Length and diploma, for example "3 years · Professional bachelor". */
	length: string;
	/** Seats a year, for example "60 seats". */
	seats: string;
	body: string;
	/** Yearly fee with its currency, for example "340,000 DA". */
	price: string;
	/** The caps line under the price: the period and the payment moments. */
	period: string;
	linkLabel: string;
};

const TONE_CLASSES: Record<ProgrammeTone, string> = {
	sky: "border-(--cn-sky) bg-(--cn-sky) text-background",
	pale: "border-(--cn-pale) bg-(--cn-pale)",
	sand: "border-(--cn-sand) bg-(--cn-sand)",
	line: "border-border bg-card",
};

/** A 14px flat block with no shadow. The price sits at the bottom of every card, on one line. */
export function ProgrammeCard({
	tone,
	name,
	length,
	seats,
	body,
	price,
	period,
	linkLabel,
}: ProgrammeCardProps) {
	const isDark = tone === "sky";
	const chipClass = isDark
		? "bg-background/16 text-background"
		: "border border-foreground/18 text-foreground";
	return (
		<article
			data-pop=""
			className={cn(
				"cn-r flex flex-col gap-[13px] border p-[clamp(20px,2vw,26px)] min-[1080px]:min-h-[352px] min-[580px]:min-h-[300px]",
				TONE_CLASSES[tone],
			)}
		>
			<div className="flex flex-wrap gap-[7px] min-[1080px]:flex-col min-[1080px]:items-start">
				<span className={cn(CHIP, chipClass)}>{length}</span>
				<span className={cn(CHIP, chipClass)}>{seats}</span>
			</div>
			<h3 className="mt-0.5 font-display font-semibold text-[clamp(1.15rem,1.5vw,1.35rem)] leading-[1.15] tracking-[-0.016em]">
				{name}
			</h3>
			<p
				className={cn(
					"text-[0.9375rem] leading-[1.55]",
					isDark ? "text-background/88" : "text-(--cn-ink-2)",
				)}
			>
				{body}
			</p>
			<p className="mt-auto pt-2 font-bold font-display text-[clamp(1.45rem,1.9vw,1.8rem)] tabular-nums leading-none tracking-[-0.03em]">
				{price}
				<small className="mt-[7px] block font-sans font-semibold text-[0.6875rem] uppercase leading-none tracking-[0.13em] opacity-75">
					{period}
				</small>
			</p>
			<p
				className={cn(
					"mt-0.5 border-t pt-[13px]",
					isDark ? "border-background/24" : "border-foreground/14",
				)}
			>
				<a
					href="#enrol"
					className={cn(
						"inline-flex min-h-11 items-center font-semibold text-[0.875rem]",
						isDark ? "cn-link-on-dark" : "cn-link",
					)}
				>
					<span>{linkLabel}</span>
				</a>
			</p>
		</article>
	);
}
