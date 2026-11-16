// The ink footer, the only ink sheet of the page.
// A colophon of real links, one honest line, and the monument wordmark cropped by the bottom edge.
// LandingPage renders it last.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { GUTTER, LINK } from "../lib/type-styles";
import { FittedLine } from "./fitted-line";

/** Fit share of the monument, measured for Anton caps. */
const MONUMENT_FIT = 0.2023;

/** The monument line has a negative bottom margin (landing.css), so the page edge cuts about a quarter of its letters. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="sf-ink overflow-clip">
			<div
				className={cn(
					GUTTER,
					"flex flex-wrap items-baseline gap-x-11 gap-y-4 pt-[clamp(3rem,7vh,4.5rem)] pb-9 text-[0.95rem]",
				)}
			>
				<p className="font-bold">{t("footer.address")}</p>
				<a href={t("site.phoneHref")} className={cn(LINK, "tabular-nums")}>
					{t("site.phoneDisplay")}
				</a>
				<a href={t("site.emailHref")} className={cn(LINK, "break-all")}>
					{t("site.email")}
				</a>
				<p className="opacity-75">{t("footer.mention")}</p>
			</div>
			<div
				aria-hidden="true"
				data-slab=""
				data-watch="parent"
				className="sf-monument"
			>
				<FittedLine text={t("footer.monument")} fit={MONUMENT_FIT} />
			</div>
		</footer>
	);
}
