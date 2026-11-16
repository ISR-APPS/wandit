// The material library: the drawn living room beside an arched cabinet of six material swatches.
// LandingPage renders it and owns the chosen material. A swatch click retints the room and the whole page.
import { useT } from "~/shared/i18n";
import { MATERIAL_IDS, type MaterialId } from "../lib/materials";
import { ArchTag } from "./arch-tag";
import { RoomVignette } from "./room-vignette";
import { SectionHead } from "./section-head";
import { SwatchTexture } from "./swatch-texture";

/** The material library. `material` is the chosen id; `onSelect` lifts a new choice to the page. */
export function MaterialsSection({
	material,
	onSelect,
}: {
	material: MaterialId;
	onSelect: (material: MaterialId) => void;
}) {
	const { t } = useT();
	return (
		<section
			id="materials"
			aria-labelledby="materials-title"
			className="louz-section louz-sand"
		>
			<div className="mx-auto max-w-[1340px] px-5 sm:px-8">
				<SectionHead
					tag={t("materials.tag")}
					title={
						<>
							{t("materials.titleStart")}{" "}
							<span className="block text-balance">
								{t("materials.titleEnd")}
							</span>
						</>
					}
					titleId="materials-title"
					intro={t("materials.intro")}
					className="mb-12 lg:mb-16"
				/>
				<div className="grid items-start gap-10 lg:grid-cols-[58fr_42fr] lg:gap-16">
					<figure data-reveal>
						<RoomVignette />
						<figcaption
							aria-live="polite"
							className="mt-4 min-h-[3em] max-w-[48ch] text-[0.95rem] text-foreground/80"
						>
							{t(`materials.${material}.note`)}
						</figcaption>
					</figure>
					<div
						data-reveal
						className="louz-cabinet mx-auto w-full max-w-[560px] border-2 border-foreground/70 bg-background px-4 pt-12 pb-6 sm:px-7 lg:pt-14"
					>
						<div className="mb-7 text-center">
							<ArchTag>{t("materials.cabinetTag")}</ArchTag>
						</div>
						<fieldset className="grid min-w-0 grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3">
							<legend className="sr-only">{t("materials.groupLabel")}</legend>
							{MATERIAL_IDS.map((id) => (
								<button
									key={id}
									type="button"
									aria-pressed={id === material}
									onClick={() => onSelect(id)}
									className="louz-swatch flex cursor-pointer flex-col items-center justify-start px-1.5 pt-2 pb-3 text-center sm:px-2"
								>
									<SwatchTexture material={id} />
									<span className="mt-2.5 block font-bold text-[0.92rem] leading-tight">
										{t(`materials.${id}.name`)}
									</span>
									<span className="mt-0.5 block text-[0.76rem] text-foreground/70 leading-snug">
										{t(`materials.${id}.source`)}
									</span>
								</button>
							))}
						</fieldset>
						<p className="mt-6 border-(--louz-hair) border-t pt-4 text-center text-[0.9rem] text-foreground/85">
							{t("materials.honestLine")}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
