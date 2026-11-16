// The phone call bar: two large actions fixed at the bottom edge, the telephone and "List a home".
// LandingPage renders it. Under 1024px it slides up after the first screen (hooks/use-is-past-hero.ts).
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useIsPastHero } from "../hooks/use-is-past-hero";
import { DISPLAY, FIGURES } from "../lib/type-styles";

/** Hidden from 1024px up, where the header shows the telephone. The links stay out of the tab order while the bar is down. */
export function CallBar() {
	const { t } = useT();
	const isShown = useIsPastHero();
	const linkClass = cn(
		DISPLAY,
		"flex min-h-13 items-center justify-center px-2 text-[17px] leading-none tracking-[0.06em]",
	);

	return (
		<div
			data-shown={isShown}
			aria-hidden={!isShown}
			className="rn-callbar fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-foreground border-t-2 bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
		>
			<a
				href={t("site.phoneHref")}
				tabIndex={isShown ? undefined : -1}
				className={cn(linkClass, FIGURES)}
			>
				{t("site.phoneDisplay")}
			</a>
			<a
				href="#sell"
				tabIndex={isShown ? undefined : -1}
				className={cn(linkClass, "bg-primary text-primary-foreground")}
			>
				{t("site.listHome")}
			</a>
		</div>
	);
}
