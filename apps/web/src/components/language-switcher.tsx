/**
 * Language pickers: the locale rows inside the user menu, and a standalone
 * dropdown for pages without that menu. Both call setLocale of the i18n context.
 */
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { cn } from "@wandit/ui/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { LocaleFlag } from "@/components/language-flags";
import { localeMeta, locales, useI18n } from "@/lib/i18n";

/**
 * Bare list of locale rows for embedding inside an EXISTING dropdown (e.g. the
 * user menu) under a "Language" label/sub. Consumes the i18n context directly.
 * Each row: round flag badge + native label (primary) + the English name as
 * muted secondary text (only when it differs), with an ember check + subtle
 * tint on the active locale. Flag/check use logical placement so the row stays
 * correct under `dir="rtl"`.
 */
export function LanguageSwitcherMenuItems() {
	const { locale, setLocale } = useI18n();

	return (
		<>
			{locales.map((code) => {
				const isActive = code === locale;
				const { nativeLabel, label } = localeMeta[code];

				return (
					<DropdownMenuItem
						key={code}
						onSelect={() => setLocale(code)}
						className={cn(
							"gap-2.5 py-2",
							isActive && "bg-spark/[0.14] focus:bg-spark/20",
						)}
					>
						<LocaleFlag locale={code} className="size-5" />
						<span className="flex flex-1 items-baseline gap-1.5">
							<span className="font-medium">{nativeLabel}</span>
							{label !== nativeLabel ? (
								<span className="font-normal font-sans text-muted-foreground text-xs">
									{label}
								</span>
							) : null}
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
 * Standalone language switcher: a dropdown whose trigger shows a round flag
 * badge for the current locale plus its native label (icon-only below `sm`) and
 * a chevron that flips when open. Sized to sit next to the theme toggle. The
 * menu opens with a localized "Language" header over the shared locale rows.
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
					className="group/lang gap-2"
					aria-label={t("common.changeLanguage")}
				>
					<LocaleFlag locale={locale} />
					<span className="hidden sm:inline">
						{localeMeta[locale].nativeLabel}
					</span>
					<ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/lang:rotate-180" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-52">
				<DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
				<LanguageSwitcherMenuItems />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
