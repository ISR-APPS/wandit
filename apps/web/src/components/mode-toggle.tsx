/**
 * A round button that switches between the light and the dark theme.
 * The dashboard top bar, LandingNav (pricing, terms, privacy), and the billing page render it.
 * It calls setTheme of the theme provider.
 */
import { MoonIcon } from "@phosphor-icons/react/Moon";
import { SunIcon } from "@phosphor-icons/react/Sun";
import { Button } from "@wandit/ui/components/button";

import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/lib/i18n";

/** The sun shows in light mode and the moon in dark mode. Each one turns and scales in when its theme starts. */
export function ModeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const { t } = useTranslation();

	return (
		<Button
			variant="ghost"
			size="icon"
			className="relative"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
		>
			<SunIcon
				aria-hidden
				weight="duotone"
				className="size-[1.1rem] rotate-0 scale-100 transition-all motion-reduce:transition-none dark:-rotate-90 dark:scale-0"
			/>
			<MoonIcon
				aria-hidden
				weight="duotone"
				className="absolute size-[1.1rem] rotate-90 scale-0 transition-all motion-reduce:transition-none dark:rotate-0 dark:scale-100"
			/>
			<span className="sr-only">{t("common.toggleTheme")}</span>
		</Button>
	);
}
