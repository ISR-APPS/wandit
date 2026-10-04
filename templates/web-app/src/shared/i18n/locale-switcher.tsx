// Language switcher for a header. The landing header renders it.
// It renders nothing while the app has one language, and it writes through setLocale.
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { isLocale, localeMeta, locales } from "./config";
import { setLocale, useT } from "./provider";

/** Header select of the app languages. Renders nothing while `locales` has one code. */
export function LocaleSwitcher() {
	const { locale } = useT();
	// One language: there is nothing to switch. A second code in `locales` shows it.
	if (locales.length < 2) {
		return null;
	}
	return (
		<Select
			value={locale}
			onValueChange={(value) => {
				if (isLocale(value)) {
					setLocale(value);
				}
			}}
		>
			<SelectTrigger className="w-[7.5rem]" aria-label="Language">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{locales.map((code) => (
					<SelectItem key={code} value={code}>
						{localeMeta[code].nativeLabel}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
