// The sticky header of the home page: wordmark, five section links, the phone, and the application button.
// LandingPage renders it. Under 1000px the section links move into a side sheet behind a menu button.
// The links are anchors of the same page, so they work with no script.
import { ListIcon } from "@phosphor-icons/react";
import { LocaleSwitcher, type TranslationKey, useT } from "~/shared/i18n";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/shared/ui/sheet";
import { WRAP } from "../lib/type-styles";
import { BrandMark } from "./brand-mark";

// Each href is the id of a section element. Each section file sets its own id.
const NAV_LINKS: readonly { href: string; labelKey: TranslationKey }[] = [
	{ href: "#programmes", labelKey: "site.navProgrammes" },
	{ href: "#timetable", labelKey: "site.navTimetable" },
	{ href: "#campus", labelKey: "site.navCampus" },
	{ href: "#admission", labelKey: "site.navAdmission" },
	{ href: "#results", labelKey: "site.navResults" },
];

// The phone sheet also lists the two closing sections.
const MENU_LINKS: readonly { href: string; labelKey: TranslationKey }[] = [
	...NAV_LINKS,
	{ href: "#questions", labelKey: "site.navQuestions" },
	{ href: "#enrol", labelKey: "site.navEnrol" },
];

/** 68px white bar with a hairline. It never carries a shadow, as the campus world sets. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-50 border-border border-b bg-background/95 backdrop-blur-sm">
			<div
				className={`${WRAP} flex min-h-[68px] items-center gap-[clamp(10px,2vw,30px)]`}
			>
				<a
					href="#top"
					aria-label={t("site.homeLabel")}
					className="me-auto flex min-h-11 min-w-0 items-center gap-2.5"
				>
					<BrandMark />
					<b className="whitespace-nowrap font-bold font-display text-[1.08rem] tracking-[-0.02em]">
						{t("site.brand")}
					</b>
					<span className="hidden whitespace-nowrap font-semibold text-[0.625rem] text-muted-foreground uppercase tracking-[0.16em] min-[560px]:inline">
						— {t("site.brandPlace")}
					</span>
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="hidden gap-[clamp(14px,1.7vw,26px)] min-[1000px]:flex"
				>
					{NAV_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="border-transparent border-b-2 py-1 text-(--cn-ink-2) text-[0.875rem] transition-colors hover:border-(--cn-sand-deep) hover:text-foreground"
						>
							{t(link.labelKey)}
						</a>
					))}
				</nav>
				<a
					href={t("site.phoneHref")}
					className="hidden whitespace-nowrap text-[0.875rem] tabular-nums hover:text-(--cn-sky-deep) min-[560px]:inline min-[1000px]:max-[1199px]:hidden"
				>
					{t("site.phoneDisplay")}
				</a>
				<LocaleSwitcher />
				<a
					href="#enrol"
					className="cn-btn inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-[17px] font-semibold text-[0.875rem]"
				>
					<span className="hidden min-[560px]:inline">
						{t("site.headerCta")}
					</span>
					<span className="min-[560px]:hidden">{t("site.headerCtaShort")}</span>
				</a>
				<Sheet>
					<SheetTrigger
						aria-label={t("site.menuOpen")}
						className="-me-2.5 inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-(--cn-pale-2) min-[1000px]:hidden"
					>
						<ListIcon className="size-6" />
					</SheetTrigger>
					<SheetContent side="end" className="cn-page gap-0 bg-background">
						<SheetHeader className="border-border border-b px-6 pt-6 pb-4">
							<SheetTitle className="font-bold font-display text-xl tracking-[-0.02em]">
								{t("site.menuTitle")}
							</SheetTitle>
							<SheetDescription>{t("site.menuDescription")}</SheetDescription>
						</SheetHeader>
						<nav aria-label={t("site.navLabel")} className="flex flex-col px-6">
							{MENU_LINKS.map((link) => (
								<SheetClose asChild key={link.href}>
									<a
										href={link.href}
										className="flex min-h-12 items-center border-border border-b font-display font-semibold text-[1.05rem] tracking-[-0.012em]"
									>
										{t(link.labelKey)}
									</a>
								</SheetClose>
							))}
						</nav>
						<div className="mt-auto flex flex-col gap-3 p-6">
							<a
								href={t("site.phoneHref")}
								className="font-bold font-display text-2xl tabular-nums tracking-[-0.02em]"
							>
								{t("site.phoneDisplay")}
							</a>
							<p className="text-[0.8125rem] text-muted-foreground">
								{t("site.menuHours")}
							</p>
							<SheetClose asChild>
								<a
									href="#enrol"
									className="cn-btn mt-2 inline-flex min-h-12 items-center justify-center rounded-full px-6 font-semibold text-[0.9375rem]"
								>
									{t("site.headerCta")}
								</a>
							</SheetClose>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</header>
	);
}
