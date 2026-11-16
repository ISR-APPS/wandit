// The monument footer: the wordmark at display size over a navy rule, then the legal lines and the movements.
// LandingPage renders it last. It carries no credit line.
import { useT } from "~/shared/i18n";
import { MOVEMENTS } from "../lib/content";
import { Wordmark } from "./wordmark";

/** The closing of the page. The wordmark never wraps: 7vw keeps it inside a phone screen. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="border-foreground/12 border-t pt-[clamp(2.4rem,5vh,4rem)] pb-8">
			<div className="cap-wrap">
				<p className="border-primary border-b pb-[clamp(1rem,2.5vh,1.8rem)] leading-none">
					<Wordmark className="text-[clamp(2.4rem,7vw,6rem)] tracking-[-0.03em]" />
				</p>
				<div className="flex flex-wrap justify-between gap-x-8 gap-y-3 pt-5">
					<p className="font-semibold text-[0.65625rem] text-foreground/60 uppercase leading-[1.7] tracking-[0.12em]">
						{t("footer.legalLine1")}
						<br />
						{t("footer.legalLine2")}
					</p>
					<nav
						aria-label={t("footer.navLabel")}
						className="grid grid-cols-3 gap-x-5 min-[35rem]:flex min-[35rem]:flex-wrap"
					>
						{MOVEMENTS.map((movement) => (
							<a
								key={movement.href}
								href={movement.href}
								className="inline-flex min-h-11 items-center font-semibold text-[0.65625rem] text-primary uppercase tracking-[0.12em] underline decoration-transparent underline-offset-[6px] transition-colors duration-[180ms] ease-linear hover:decoration-primary min-[56.25rem]:min-h-0"
							>
								{t(movement.label)}
							</a>
						))}
					</nav>
				</div>
			</div>
		</footer>
	);
}
