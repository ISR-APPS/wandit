// The face behind the care: the portrait of the dermatologist, her name, two lines of biography, one sentence
// of her own, three calm figures, and her council badge. LandingPage renders it on the cream.
// From 768px the portrait sits beside the text. On a phone the text comes first.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import { GUTTER, SECTION_TITLE, SECTION_Y } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { PhotoMask } from "./photo-mask";

/** The <section id="doctor"> that the header link "The doctor" opens. */
export function PractitionerSection() {
	const { t } = useT();
	const facts = [
		{
			value: t("practitioner.factYearsValue"),
			label: t("practitioner.factYearsLabel"),
		},
		{
			value: t("practitioner.factVisitValue"),
			label: t("practitioner.factVisitLabel"),
		},
		{
			value: t("practitioner.factFollowValue"),
			label: t("practitioner.factFollowLabel"),
		},
	];
	return (
		<section
			id="doctor"
			aria-labelledby="doctor-title"
			className={cn("scroll-mt-4 bg-background", GUTTER, SECTION_Y)}
		>
			<div className="mx-auto grid w-full max-w-[1140px] items-center gap-[clamp(2.5rem,7vw,7rem)] md:grid-cols-[minmax(240px,0.82fr)_minmax(0,1fr)] lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.12fr)]">
				{/* The 22% crop and the 12% phone zoom keep the bright window sky out of the top corner. */}
				<PhotoMask
					photo={PHOTOS.practitioner}
					alt={t("practitioner.alt")}
					className="row-start-2 w-full max-w-[520px] md:row-start-1"
					maskClassName="h-[clamp(420px,118vw,560px)] rounded-[40px] md:h-[clamp(480px,55vw,690px)] md:rounded-[42px]"
					imageClassName="object-[22%_42%] max-md:origin-[15%_80%] max-md:scale-[1.12]"
				/>
				<div data-reveal="" className="grid justify-items-start gap-[1.35rem]">
					<h2 id="doctor-title" className={cn(SECTION_TITLE, "max-w-[18ch]")}>
						{t("practitioner.title")}
					</h2>
					<h3 className="font-display font-normal text-(--lumia-bronze-deep) text-[clamp(1.45rem,2.4vw,2rem)] leading-[1.15]">
						{t("practitioner.name")}
					</h3>
					<p className="font-medium text-[clamp(1.0625rem,1.7vw,1.1875rem)]">
						{t("practitioner.bio")}
					</p>
					<blockquote className="m-0 border-(--lumia-hair) border-s ps-5 font-display text-[clamp(1.4rem,2.2vw,1.85rem)] leading-[1.25]">
						{t("practitioner.quote")}
					</blockquote>
					<dl className="m-0 grid w-full grid-cols-3 gap-4 border-(--lumia-hair) border-t pt-5">
						{facts.map((fact) => (
							<div key={fact.label} className="grid content-start gap-1">
								<dt className="order-2 text-(--lumia-ink-soft) text-[14px] leading-snug">
									{fact.label}
								</dt>
								<dd className="order-1 m-0 font-display text-[clamp(1.6rem,2.4vw,2rem)] leading-none">
									{fact.value}
								</dd>
							</div>
						))}
					</dl>
					<CapsuleBadge>{t("practitioner.badge")}</CapsuleBadge>
				</div>
			</div>
		</section>
	);
}
