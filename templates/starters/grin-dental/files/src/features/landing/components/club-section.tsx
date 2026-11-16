// The Grin Club: a coral band with a cream dot grid, the membership pitch, four perks, and the starburst badge.
// LandingPage renders it after the reviews. The badge comes first on a phone, at the end from 1024px.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CLUB_PERKS } from "../lib/content";
import { BUTTON_BIG, DISPLAY, TAG, WRAP } from "../lib/styles";
import { ClubBadge } from "./club-badge";

/** Two columns from 1024px. The headline is cream with a hard ink drop. */
export function ClubSection() {
	const { t } = useT();
	// The booking card asks only for a first visit, so the club button opens its own email.
	const clubMailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(t("club.mailSubject"))}`;
	return (
		<section
			id="club"
			aria-labelledby="club-title"
			className="gd-dots-cream gd-on-dark relative scroll-mt-24 overflow-clip border-foreground border-y-[length:var(--gd-line)] bg-primary py-[clamp(3.5rem,7vw,6rem)] text-foreground"
		>
			<div
				className={cn(
					WRAP,
					"grid items-center gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[1.1fr_0.9fr]",
				)}
			>
				<div data-pop="kids">
					<p className={cn(TAG, "mb-5 -rotate-[2.5deg] bg-(--gd-sun)")}>
						{t("club.tag")}
					</p>
					<h2
						id="club-title"
						className={cn(
							DISPLAY,
							"gd-ink-drop mb-5 text-[clamp(2.6rem,5.5vw,4.6rem)] text-background leading-[0.98]",
						)}
					>
						{t("club.title")}
					</h2>
					<p className="mb-6 max-w-[34rem] font-extrabold text-[1.15rem] leading-relaxed">
						{t("club.lede")}
					</p>
					<ul className="mb-8 grid gap-2.5">
						{CLUB_PERKS.map((perkKey) => (
							<li
								key={perkKey}
								className="flex items-baseline gap-3 font-extrabold text-[1.02rem]"
							>
								<span
									aria-hidden="true"
									className="text-(--gd-sun) text-[1.1em] [text-shadow:1px_1px_0_var(--foreground)]"
								>
									★
								</span>
								<span>{t(perkKey)}</span>
							</li>
						))}
					</ul>
					<div>
						<a href={clubMailHref} className={cn(BUTTON_BIG, "gd-btn-sun")}>
							{t("club.cta")}
						</a>
					</div>
				</div>
				<div data-pop="self" className="flex justify-center max-lg:-order-1">
					<div className="w-[min(340px,80%)] max-lg:w-[min(260px,70%)]">
						<ClubBadge />
					</div>
				</div>
			</div>
		</section>
	);
}
