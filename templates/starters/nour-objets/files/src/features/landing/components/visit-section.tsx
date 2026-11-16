// Section 07, the reservation: the shop details beside the reservation ledger and the three steps that follow it.
// LandingPage renders it. It reads the "visit" and "site" groups of messages.ts.
// The section posts no data. STARTER.md says where a real form goes.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BAND,
	CONTACT_LINK,
	KICKER,
	LEDGER_LABEL,
	MONO,
	NOTE,
	TITLE,
	WRAP,
} from "../lib/type-styles";
import { ReservationLedger } from "./reservation-ledger";

/** What the shop does after it has the list, in three rows. */
const STEPS: readonly { titleKey: TranslationKey; bodyKey: TranslationKey }[] =
	[
		{ titleKey: "visit.step1Title", bodyKey: "visit.step1Body" },
		{ titleKey: "visit.step2Title", bodyKey: "visit.step2Body" },
		{ titleKey: "visit.step3Title", bodyKey: "visit.step3Body" },
	];

/** From 940px the shop details take 43% and stick under the header while the ledger scrolls. */
export function VisitSection() {
	const { t } = useT();
	return (
		<section id="visit" className={BAND}>
			<div
				className={`${WRAP} grid gap-[clamp(32px,4vw,60px)] min-[940px]:grid-cols-[minmax(0,43fr)_minmax(0,57fr)]`}
			>
				<div
					data-reveal=""
					className="min-[940px]:sticky min-[940px]:top-24 min-[940px]:self-start"
				>
					<div className="nour-fade">
						<p className={KICKER}>{t("visit.kicker")}</p>
						<h2 className={`${TITLE} mt-3.5 max-w-[14ch]`}>
							{t("visit.title")}
						</h2>
						<p className={`${NOTE} mt-[18px] max-w-[46ch]`}>
							{t("visit.note")}
						</p>
					</div>
					<dl className="nour-fade mt-[clamp(26px,3vw,36px)] grid grid-cols-2 gap-x-5 gap-y-[18px] border-foreground/16 border-t pt-[18px]">
						<div>
							<dt className={LEDGER_LABEL}>{t("visit.addressLabel")}</dt>
							<dd className="mt-1 text-[14px] leading-[1.4]">
								{t("site.address1")}
								<br />
								{t("site.address2")}
							</dd>
						</div>
						<div>
							<dt className={LEDGER_LABEL}>{t("visit.hoursLabel")}</dt>
							<dd className="mt-1 text-[14px] leading-[1.4]">
								{t("site.hours1")}
								<br />
								{t("site.hours2")}
							</dd>
						</div>
						<div>
							<dt className={LEDGER_LABEL}>{t("visit.phoneLabel")}</dt>
							{/* -mt-1.5 lifts the 44px touch box, so the words sit as close to the label as the address. */}
							<dd className="-mt-1.5 text-[14px]">
								<a href={t("site.phoneHref")} className={CONTACT_LINK}>
									{t("site.phone")}
								</a>
							</dd>
						</div>
						<div>
							<dt className={LEDGER_LABEL}>{t("visit.emailLabel")}</dt>
							<dd className="-mt-1.5 text-[14px]">
								<a
									href={t("site.emailHref")}
									className={`${CONTACT_LINK} break-all`}
								>
									{t("site.email")}
								</a>
							</dd>
						</div>
					</dl>
				</div>

				<div data-reveal="">
					<ReservationLedger />

					<h3
						className={cn(
							MONO,
							"nour-fade mt-[clamp(34px,4vw,52px)] border-foreground border-b pb-[9px] text-foreground",
						)}
					>
						{t("visit.stepsHead")}
					</h3>
					<ol>
						{STEPS.map((step, index) => (
							<li
								key={step.titleKey}
								className="nour-fade grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 border-foreground/9 border-b py-3.5 min-[621px]:grid-cols-[40px_minmax(0,0.8fr)_minmax(0,1.2fr)]"
							>
								<span className="nour-mono text-[13px] tracking-[0.02em]">
									{String(index + 1).padStart(2, "0")}
								</span>
								<span className="font-medium text-[15px] leading-[1.3] tracking-[-0.012em]">
									{t(step.titleKey)}
								</span>
								<span className="col-start-2 text-[13.5px] text-muted-foreground leading-[1.5] min-[621px]:col-start-3">
									{t(step.bodyKey)}
								</span>
							</li>
						))}
					</ol>
				</div>
			</div>
		</section>
	);
}
