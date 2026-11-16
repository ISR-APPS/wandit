// The slow word band between the numbers and the sell section: what the agency does, in large capitals.
// LandingPage renders it. It uses Marquee at the slow speed; the words live in the `words` group of messages.ts.
import { Fragment } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISPLAY } from "../lib/type-styles";
import { Marquee } from "./marquee";

/** Decorative band on the secondary ground. The sell section below says the same facts in text. */
export function WordBand() {
	const { t } = useT();
	const words = [
		t("words.sell"),
		t("words.buy"),
		t("words.let"),
		t("words.value"),
		t("words.phone"),
		t("words.prices"),
	];

	return (
		<Marquee isSlow className="border-foreground/12 border-t bg-secondary">
			{words.map((word) => (
				<Fragment key={word}>
					<span
						className={cn(
							DISPLAY,
							"py-3.5 text-[clamp(34px,5vw,64px)] leading-[1.15]",
						)}
					>
						{word}
					</span>
					<span
						aria-hidden="true"
						className="mx-8.5 inline-block size-2 shrink-0 bg-primary"
					/>
				</Fragment>
			))}
		</Marquee>
	);
}
