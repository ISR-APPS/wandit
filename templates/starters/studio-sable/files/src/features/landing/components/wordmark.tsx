// The lowercase wordmark with its accent full stop: the recurring mark of the page.
// The header, the section marks, the phone menu, and the footer monument render it.
// The caller sets the size and the weight on its own element.
import { useT } from "~/shared/i18n";
import { AccentDot } from "./accent-dot";

/** The name of the studio, then the accent full stop. It is inline, so it takes the type of its parent. */
export function Wordmark() {
	const { t } = useT();
	return (
		<>
			{t("site.wordmark")}
			<AccentDot />
		</>
	);
}
