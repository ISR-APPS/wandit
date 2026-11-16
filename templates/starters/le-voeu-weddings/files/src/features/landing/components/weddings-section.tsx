// The portfolio plate: three past weddings in a staggered grid on the liner ground.
// LandingPage renders it after the services. A tall portrait sits low on the start side, a wide table photo high on the end side,
// and a square of rings with a short story under it. The script word "Together" crosses the edge of the portrait.
// The section carries data-scrub="pass" for the petals of its gutters.
import { useT } from "~/shared/i18n";
import { H2, LABEL, NOTE, SECTION, WRAP } from "../lib/type-styles";
import { PetalLayer } from "./petal-layer";
import { PhotoFrame } from "./photo-frame";
import { ScriptWord } from "./script-word";

/** The plate grid: 0.86fr and 1.14fr. Below 900px the photos stack, the wide one first. */
export function WeddingsSection() {
	const { t } = useT();
	return (
		<section
			id="weddings"
			aria-labelledby="weddings-title"
			data-scrub="pass"
			className={`${SECTION} relative overflow-hidden bg-(--voeu-liner)`}
		>
			<PetalLayer count={4} />
			<div className={`${WRAP} relative`}>
				<div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(0,1.16fr)_minmax(0,0.84fr)] min-[900px]:gap-[clamp(24px,4vw,64px)]">
					<div data-reveal="lift">
						<p className={LABEL}>{t("weddings.label")}</p>
						<h2 id="weddings-title" className={`${H2} mt-5`}>
							<span className="block">{t("weddings.titleLine1")}</span>
							<span className="block">{t("weddings.titleLine2")}</span>
						</h2>
					</div>
					{/* The note hangs on its rule at the cap line of the title, not at the foot of the title. */}
					<p
						data-reveal="lift"
						className={`${NOTE} max-w-[34ch] min-[900px]:mt-[clamp(34px,3.4vw,46px)]`}
					>
						{t("weddings.note")}
					</p>
				</div>
				<div className="mt-[clamp(40px,5vw,66px)] grid items-start gap-[30px] min-[900px]:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] min-[900px]:gap-[clamp(22px,3vw,54px)]">
					<PhotoFrame
						src="/images/stationery.webp"
						alt={t("weddings.stationeryAlt")}
						width={1000}
						height={1334}
						caption={t("weddings.stationeryCaption")}
						isCool
						motion="photo"
						className="order-2 mt-9 min-[900px]:order-1 min-[900px]:ms-[clamp(0px,4vw,60px)] min-[900px]:mt-[clamp(0px,6vw,96px)]"
						frameClassName="aspect-[3/4]"
						overlay={
							<ScriptWord
								word="together"
								reveal="write"
								className="voeu-script-liner absolute start-[7%] top-0 z-10 -translate-y-[72%] text-[clamp(2.8rem,12vw,3.6rem)] min-[900px]:start-0 min-[900px]:top-[14%] min-[900px]:-translate-x-[34%] min-[900px]:translate-y-0 min-[900px]:text-[clamp(2.2rem,4vw,3.4rem)] min-[900px]:rtl:translate-x-[34%]"
							/>
						}
					/>
					<div className="order-1 min-[900px]:order-2">
						<PhotoFrame
							src="/images/table.webp"
							alt={t("weddings.tableAlt")}
							width={1600}
							height={900}
							caption={t("weddings.tableCaption")}
							motion="photo"
							frameClassName="aspect-[16/9]"
						/>
						<div className="mt-[clamp(28px,3vw,44px)] grid items-center gap-[22px] sm:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] sm:gap-[clamp(18px,2.4vw,34px)]">
							<PhotoFrame
								src="/images/rings.webp"
								alt={t("weddings.ringsAlt")}
								width={1000}
								height={1334}
								caption={t("weddings.ringsCaption")}
								isCool
								motion="photo"
								frameClassName="aspect-square"
								imageClassName="object-[50%_58%]"
							/>
							<p
								data-reveal="lift"
								className="text-pretty border-(--voeu-hair) border-t pt-4 text-[0.95rem] text-foreground/78 leading-[1.74]"
							>
								{t("weddings.ringsStory")}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
