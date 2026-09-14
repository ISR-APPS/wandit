// Language switcher for the header.
// The landing header renders it; it writes through the i18n provider.

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { isLocale, localeMeta, locales, useSetLocale, useT } from "~/i18n";

export function LocaleSwitcher() {
	const { locale } = useT();
	const setLocale = useSetLocale();
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
