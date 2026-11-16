// Section 02: the wall of prints, the one scrubbed scene of the page.
// landing-page.tsx renders it. It reads WALL_COLUMNS from lib/content.ts and the scroll progress from use-drift-progress.ts.
// Three columns move at different speeds inside a clipped window; landing.css holds the math.
import { useT } from "~/shared/i18n";
import { useDriftProgress } from "../hooks/use-drift-progress";
import { WALL_COLUMNS } from "../lib/content";
import { H2, KICKER, META, NOTE, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { PhotoFrame } from "./photo-frame";

/** The section closes flush on the wall, so its facts move up into the head as a third column. */
export function GallerySection() {
	const { t } = useT();
	const driftRef = useDriftProgress();
	return (
		<section
			id="gallery"
			aria-labelledby="gallery-title"
			className="border-foreground/15 border-t bg-card pt-(--yr-section-tight)"
		>
			<div className={WRAP}>
				<CutGroup className="grid items-end gap-[18px] pb-[clamp(2rem,4vh,3.2rem)] min-[861px]:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,clamp(210px,23vw,330px))] min-[861px]:gap-x-[clamp(20px,3vw,44px)]">
					<div className="yr-cut">
						<p className={KICKER}>{t("gallery.kicker")}</p>
						<h2 id="gallery-title" className={`${H2} mt-3.5`}>
							<span className="block">{t("gallery.titleLine1")}</span>
							<span className="block">{t("gallery.titleLine2")}</span>
						</h2>
					</div>
					<p
						className={`${META} yr-cut border-foreground/15 border-t pt-3 leading-loose [--cut:1]`}
					>
						<span className="block">{t("gallery.facts1")}</span>
						<span className="block">{t("gallery.facts2")}</span>
					</p>
					<p
						className={`${NOTE} yr-cut max-w-[60ch] [--cut:2] min-[861px]:text-end`}
					>
						{t("gallery.note")}
					</p>
				</CutGroup>
			</div>

			{/* One labelled image for a screen reader. The eighteen frames inside are decoration. */}
			<div
				ref={driftRef}
				role="img"
				aria-label={t("gallery.wallLabel")}
				className="yr-drift border-foreground/15 border-y"
			>
				<div
					aria-hidden="true"
					className="grid grid-cols-2 gap-(--yr-drift-gap) px-(--yr-drift-gap) min-[761px]:grid-cols-3"
				>
					{WALL_COLUMNS.map((column) => (
						<div
							key={column.id}
							className="yr-drift-col grid content-start gap-(--yr-drift-gap)"
						>
							{column.prints.map((print, index) => (
								<PhotoFrame
									// biome-ignore lint/suspicious/noArrayIndexKey: a column can hold one photograph twice, and its fixed list never reorders.
									key={index}
									photo={print.photo}
									exif="standard"
									isDecorative
									className={print.isWide ? "aspect-[3/2]" : "aspect-[3/4]"}
								/>
							))}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
