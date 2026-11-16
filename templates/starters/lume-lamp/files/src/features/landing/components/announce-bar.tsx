// The ink strip above the header: the edition facts, separated by brass dots.
// LandingPage renders it first. It scrolls away; the header below it stays.
import { Fragment } from "react";
import { useT } from "~/shared/i18n";

/** One line, centered. The first fact is in the light brass. */
export function AnnounceBar() {
	const { t } = useT();
	const facts = [t("announce.units"), t("announce.ships")];
	return (
		<p className="bg-foreground px-(--lume-pad) py-[0.62em] text-center text-[0.72rem] text-background tracking-[0.08em] sm:text-[0.8125rem]">
			<b className="font-medium text-(--lume-brass-light)">
				{t("announce.lead")}
			</b>
			{facts.map((fact) => (
				<Fragment key={fact}>
					<span
						className="mx-[0.5em] text-primary sm:mx-[0.8em]"
						aria-hidden="true"
					>
						·
					</span>
					{fact}
				</Fragment>
			))}
		</p>
	);
}
