// The masthead of the paper: the top line (dateline, edition, weather), the wordmark h1, the heavy bar, and the rubric nav.
// LandingPage renders it first. The rubrics are anchors of the same page, so they work with no script.
// Under 720px the rubric row becomes a "Sections" button (SectionMenu) and a link to the letters page.
// The load press roll is CSS only (kiosque.css): the rules wipe, then each line rises in reading order.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { RUBRICS } from "../lib/content";
import { FURNITURE } from "../lib/type-styles";
import { SectionMenu } from "./section-menu";

/** The top of the front page. It does not stick: a paper keeps its masthead on page 1. */
export function Masthead() {
	const { t } = useT();
	const topLine = [t("site.dateline"), t("site.edition"), t("site.weather")];
	return (
		<header className="ks-wrap">
			<div
				aria-hidden="true"
				className="ks-load-wipe h-px bg-(--ks-rule-strong)"
			/>
			<div
				className={cn(
					FURNITURE,
					"flex flex-col items-center gap-1 border-(--ks-rule-strong) border-b py-2.5 text-center font-medium text-[0.72rem] tracking-[0.09em] min-[720px]:flex-row min-[720px]:items-baseline min-[720px]:justify-between min-[720px]:gap-6 min-[720px]:text-[0.76rem]",
				)}
			>
				{topLine.map((line, index) => (
					<span
						key={line}
						className={cn(
							"ks-load-rise",
							index === 0 && "[--ks-delay:120ms] min-[720px]:text-start",
							index === 1 && "[--ks-delay:200ms] min-[720px]:flex-1",
							index === 2 && "[--ks-delay:280ms] min-[720px]:text-end",
						)}
					>
						{line}
					</span>
				))}
			</div>
			<h1 className="ks-load-rise ks-load-slow pt-[clamp(1.1rem,3vw,2rem)] pb-[clamp(0.6rem,1.6vw,1.1rem)] text-center font-display font-extrabold text-[clamp(3.4rem,10vw,7.6rem)] leading-[0.95] tracking-[-0.01em] [--ks-delay:300ms]">
				{t("site.brand")}
			</h1>
			<p
				className={cn(
					FURNITURE,
					"ks-load-rise mx-auto max-w-[60ch] text-balance pb-4 text-center font-medium text-[0.72rem] text-foreground/78 leading-relaxed tracking-[0.14em] [--ks-delay:560ms] min-[1024px]:max-w-none min-[720px]:text-[0.76rem]",
				)}
			>
				{t("site.tagline")}
			</p>
			<div
				aria-hidden="true"
				className="ks-load-wipe h-1 bg-foreground [--ks-delay:640ms]"
			/>
			<nav
				aria-label={t("site.navLabel")}
				className="hidden justify-center border-(--ks-rule-strong) border-b min-[720px]:flex"
			>
				{/* No load rise here: the nav toggles display at 720px, and a toggle replays the animation. */}
				{RUBRICS.map((rubric) => (
					<a
						key={rubric.href}
						href={rubric.href}
						className={cn(
							FURNITURE,
							"flex min-h-11 items-center gap-2 border-(--ks-rule) border-e px-[clamp(0.9rem,1.6vw,1.4rem)] py-3 font-semibold text-[0.76rem] tracking-[0.11em] transition-colors duration-200 first:border-s hover:text-primary focus-visible:text-primary",
						)}
					>
						{t(rubric.labelKey)}
						<span className="font-normal text-foreground/70">
							{t("site.pageAbbr")} {rubric.page}
						</span>
					</a>
				))}
			</nav>
			<div className="flex items-stretch justify-between border-(--ks-rule-strong) border-b min-[720px]:hidden">
				<SectionMenu />
				<a
					href="#letters"
					className={cn(
						FURNITURE,
						"flex min-h-12 items-center gap-2 border-(--ks-rule) border-s ps-4 font-bold text-[0.74rem] text-primary tracking-[0.11em]",
					)}
				>
					{t("site.writeToUs")}
					<span className="font-normal text-foreground/70">
						{t("site.pageAbbr")} 5
					</span>
				</a>
			</div>
		</header>
	);
}
