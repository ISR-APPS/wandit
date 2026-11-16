// One treatment card: the photo in its mask, a capsule, the serif name, one honest line, and the price.
// CareSection renders three of them. The card is flat (no shadow) on the soft cream-white of the world.
// "split" puts the photo beside the text from 768px; "stacked" keeps it on top.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Photo } from "../lib/photos";
import { CapsuleBadge } from "./capsule-badge";
import { PhotoMask } from "./photo-mask";

type CareCardProps = {
	photo: Photo;
	/** Translated description of the photo. */
	alt: string;
	/** Translated capsule label, for example "By appointment". */
	badge: string;
	title: string;
	body: string;
	/** The price in dinars, already formatted with a no-break space, for example "12 000". */
	price: string;
	/** The length of the visit, for example "1 h 15". */
	duration: string;
	/** "split": photo beside the text from 768px. "stacked": photo on top. */
	layout: "stacked" | "split";
	/** Grid placement of the card, from CareSection. */
	className?: string;
	/** Height of the photo mask in the stacked layout. */
	maskHeightClassName?: string;
	/** An object-position class that picks the crop. */
	imageClassName?: string;
};

/** An <article> with a definition list for the price and the duration. */
export function CareCard({
	photo,
	alt,
	badge,
	title,
	body,
	price,
	duration,
	layout,
	className,
	maskHeightClassName,
	imageClassName,
}: CareCardProps) {
	const { t } = useT();
	const isSplit = layout === "split";
	return (
		<article
			data-reveal=""
			className={cn(
				"grid min-w-0 overflow-hidden rounded-[30px] border border-(--lumia-hair) bg-card",
				isSplit && "md:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.1fr)]",
				className,
			)}
		>
			<PhotoMask
				photo={photo}
				alt={alt}
				maskClassName={cn(
					"rounded-[36px]",
					isSplit
						? "h-[clamp(230px,68vw,390px)] md:h-full md:min-h-80"
						: cn("h-[clamp(230px,68vw,390px)]", maskHeightClassName),
				)}
				imageClassName={imageClassName}
			/>
			<div
				className={cn(
					"grid content-start gap-4 p-[clamp(1.4rem,3vw,2.1rem)]",
					isSplit && "md:content-center",
				)}
			>
				<CapsuleBadge>{badge}</CapsuleBadge>
				<h3 className="text-balance font-display font-normal text-[clamp(1.75rem,3vw,2.45rem)] leading-[1.05]">
					{title}
				</h3>
				<p className="max-w-[46ch] text-[16px]">{body}</p>
				<dl className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
					<dt className="sr-only">{t("care.priceLabel")}</dt>
					<dd className="m-0 flex items-center gap-2.5">
						<span className="font-display text-[clamp(1.55rem,2.3vw,2rem)] leading-none">
							{price}
						</span>
						<span className="inline-flex items-center rounded-full border border-(--lumia-hair) bg-(--lumia-blush)/74 px-2.5 py-1.5 font-semibold text-[11px] uppercase leading-none tracking-[0.14em]">
							{t("care.currency")}
						</span>
					</dd>
					<dt className="sr-only">{t("care.durationLabel")}</dt>
					<dd className="m-0 inline-flex min-h-[29px] items-center rounded-full border border-(--lumia-hair) px-2.5 py-1 font-semibold text-(--lumia-ink-soft) text-[14px]">
						{duration}
					</dd>
				</dl>
			</div>
		</article>
	);
}
