// The email address of the firm as text. The contact ledger and the request plate render it.
// A long address must not break in the middle of a word on a phone, so it can break only after the "@".
import { useT } from "~/shared/i18n";

/** The address of `site.email`, with one line-break point after the "@". */
export function EmailText() {
	const { t } = useT();
	const email = t("site.email");
	const atIndex = email.indexOf("@");
	// A value with no "@" has no break point: it shows as it is, with no stray sign.
	if (atIndex < 0) {
		return email;
	}
	return (
		<>
			{email.slice(0, atIndex + 1)}
			<wbr />
			<span className="whitespace-nowrap">{email.slice(atIndex + 1)}</span>
		</>
	);
}
