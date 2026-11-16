// The campus life section: a head row, then a 12-column mosaic of three photos and one quote of a graduate.
// LandingPage renders it after the timetable. The photos are in public/images; the copy is in the `campus` group.
import { useT } from "~/shared/i18n";
import { BAND, LEDE, WRAP } from "../lib/type-styles";
import { CampusPhoto } from "./campus-photo";
import { SectionHead } from "./section-head";

/** Wide lab photo, tall library photo over two rows, a small classroom photo, and the navy quote plate. */
export function CampusSection() {
	const { t } = useT();
	return (
		<section id="campus" aria-labelledby="campus-title" className={BAND}>
			<div className={WRAP}>
				<SectionHead
					headingId="campus-title"
					eyebrow={t("campus.eyebrow")}
					title={t("campus.title")}
					aside={<p className={LEDE}>{t("campus.lede")}</p>}
				/>
				<div
					data-stagger=""
					className="grid grid-cols-6 items-start gap-3.5 min-[960px]:grid-cols-12"
				>
					<CampusPhoto
						src="/images/computer-lab.webp"
						alt={t("campus.labAlt")}
						width={1600}
						height={900}
						className="col-span-6 min-[960px]:col-span-7"
						frameClassName="h-[clamp(230px,26vw,330px)]"
						imageClassName="object-[50%_58%]"
						captions={[t("campus.labCaption1"), t("campus.labCaption2")]}
					/>
					<CampusPhoto
						src="/images/library.webp"
						alt={t("campus.libraryAlt")}
						width={1080}
						height={1440}
						className="col-span-6 flex flex-col self-stretch min-[960px]:col-span-5 min-[960px]:row-span-2"
						frameClassName="min-h-[clamp(300px,52vw,420px)] flex-1 min-[960px]:min-h-[clamp(380px,45vw,600px)]"
						imageClassName="object-[42%_50%]"
						captions={[
							t("campus.libraryCaption1"),
							t("campus.libraryCaption2"),
						]}
					/>
					<CampusPhoto
						src="/images/lecture-hall.webp"
						alt={t("campus.hallAlt")}
						width={1600}
						height={900}
						className="col-span-6 min-[640px]:col-span-3"
						frameClassName="h-[clamp(200px,20vw,262px)]"
						imageClassName="origin-[0%_100%] scale-[1.7] object-[0%_100%]"
						captions={[t("campus.hallCaption")]}
					/>
					<blockquote
						data-pop=""
						className="cn-r col-span-6 flex flex-col gap-3.5 bg-foreground p-[clamp(20px,2vw,26px)] text-background min-[640px]:col-span-3 min-[960px]:col-span-4 min-[640px]:min-h-[clamp(200px,20vw,262px)]"
					>
						<p className="font-display font-medium text-[clamp(1.08rem,1.42vw,1.34rem)] leading-[1.34] tracking-[-0.012em]">
							{t("campus.quote")}
						</p>
						<footer className="mt-auto text-[0.8125rem] text-background/70 leading-[1.45]">
							<b className="block font-semibold text-(--cn-sand)">
								{t("campus.quoteName")}
							</b>
							{t("campus.quoteRole")}
						</footer>
					</blockquote>
				</div>
			</div>
		</section>
	);
}
