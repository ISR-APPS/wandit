import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { cn } from "@wandit/ui/lib/utils";
import { CheckIcon, Languages } from "lucide-react";

import { localeMeta, locales, useI18n } from "@/lib/i18n";

/**
 * Bare list of locale rows for embedding inside an EXISTING dropdown (e.g. the
 * user menu) under a "Language" label/sub. Consumes the i18n context directly.
 */
export function LanguageSwitcherMenuItems() {
	const { locale, setLocale } = useI18n();

	return (
		<>
			{locales.map((code) => {
				const isActive = code === locale;
				return (
					<DropdownMenuItem
						key={code}
						onSelect={() => setLocale(code)}
						className="gap-2"
					>
						<span
							className={cn(
								"flex-1",
								isActive && "font-medium text-foreground",
							)}
						>
							{localeMeta[code].nativeLabel}
						</span>
						<CheckIcon
							className={cn(
								"size-4 text-primary",
								isActive ? "opacity-100" : "opacity-0",
							)}
						/>
					</DropdownMenuItem>
				);
			})}
		</>
	);
}

/**
 * Standalone language switcher: a dropdown whose trigger shows the Languages
 * icon plus the current locale's native label (icon-only below `sm`). Sized to
 * sit next to the theme toggle. Desert-light styling; active row uses the ember
 * accent.
 */
export function LanguageSwitcher({
	variant = "outline",
}: {
	variant?: "outline" | "ghost";
}) {
	const { locale, t } = useI18n();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant={variant}
					size="sm"
					className="gap-2"
					aria-label={t("common.changeLanguage")}
				>
					<Languages className="size-4" />
					<span className="hidden sm:inline">
						{localeMeta[locale].nativeLabel}
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-36">
				<LanguageSwitcherMenuItems />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
