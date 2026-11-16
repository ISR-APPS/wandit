// The info band under the hero: delivery hours, districts, one promise, and the telephone on the hot ground.
// LandingPage renders it after the hero. Its drip edge is the first drip of the page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { WRAP } from "../lib/type-styles";
import { DripEdge } from "./drip-edge";

/** Four facts. From 640px they make one line with a 7px mustard square between two facts. On a phone each fact is a line with its square in front. */
export function InfoBand() {
	const { t } = useT();
	const facts = [
		t("band.delivery"),
		t("band.districts"),
		t("band.sauces"),
		t("site.phoneDisplay"),
	];
	return (
		<div className="sc-on-hot relative border-foreground border-b-2 bg-primary pt-[calc(var(--sc-drip)+10px)] text-primary-foreground">
			<DripEdge variant="a" tone="cream" />
			<ul
				className={cn(
					WRAP,
					"flex flex-col gap-x-[clamp(14px,2.4vw,30px)] gap-y-1.5 py-3.5 font-bold text-[11px] uppercase tracking-[0.12em] sm:flex-row sm:flex-wrap sm:items-center",
				)}
			>
				{facts.map((fact) => (
					<li
						key={fact}
						className="flex items-center gap-[clamp(10px,2.4vw,30px)]"
					>
						{/* In the row the first fact has no square in front of it. */}
						<span
							aria-hidden="true"
							className="size-[7px] shrink-0 bg-(--sc-mustard) sm:[li:first-child>&]:hidden"
						/>
						{fact}
					</li>
				))}
			</ul>
		</div>
	);
}
