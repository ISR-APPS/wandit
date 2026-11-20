/**
 * The "where credits go" section of the /pricing page. components/pricing.tsx renders it.
 * One table in three groups: the fixed prices from the contracts, the metered AI work, and free publishing.
 * Publishing has no row in the metering operation registry of the API, so it costs no credits.
 */
import { AndroidLogoIcon } from "@phosphor-icons/react/AndroidLogo";
import { ChatCircleTextIcon } from "@phosphor-icons/react/ChatCircleText";
import { DesktopIcon } from "@phosphor-icons/react/Desktop";
import { FilmStripIcon } from "@phosphor-icons/react/FilmStrip";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { ImageIcon } from "@phosphor-icons/react/Image";
import {
	DESKTOP_BUILD_CREDITS,
	MOBILE_BUILD_ANDROID_CREDITS,
} from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { type ReactNode, useId } from "react";

import { formatNumber, useDictionary, useTranslation } from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";
import { Reveal } from "./reveal";

// Small capitals over a group of rows. Arabic letters join, so `rtl:` removes the letter spacing.
const GROUP_LABEL_CLASS =
	"font-semibold text-[11px] text-night/55 uppercase tracking-[0.12em] rtl:tracking-normal";

/** The table of credit uses, with its title at the start on a large screen. */
export function PricingCreditUses() {
	const { locale, t } = useTranslation();
	const where = useDictionary().landing.pricing.where;
	const titleId = useId();
	const creditsText = (credits: number) =>
		t("credits.creditUnit", {
			count: credits,
			countDisplay: formatNumber(credits, locale),
		});

	return (
		<section
			aria-labelledby={titleId}
			className="mx-auto grid max-w-7xl gap-10 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20"
		>
			<div className="lg:sticky lg:top-28 lg:self-start">
				<p className="font-semibold text-ember-deep text-sm uppercase tracking-[0.16em] rtl:tracking-normal">
					{where.kicker}
				</p>
				<h2 id={titleId} className={cn(SECTION_TITLE_CLASS, "mt-4")}>
					{where.title}
				</h2>
				<p className="mt-6 max-w-[42ch] text-lg text-night/65 leading-relaxed">
					{where.sub}
				</p>
			</div>

			<Reveal>
				<div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_1px_0_rgb(11_16_51/0.06),0_24px_48px_-28px_rgb(11_16_51/0.35)] md:rounded-[2rem]">
					<table className="w-full border-collapse text-start">
						<caption className="sr-only">{where.title}</caption>
						<thead className="sr-only">
							<tr>
								<th scope="col">{where.columns.action}</th>
								<th scope="col">{where.columns.price}</th>
							</tr>
						</thead>
						<tbody>
							<GroupRow label={where.groups.fixed} />
							<UseRow
								icon={<AndroidLogoIcon weight="duotone" />}
								label={where.items.androidBuild}
								price={creditsText(MOBILE_BUILD_ANDROID_CREDITS)}
								priceKind="fixed"
							/>
							<UseRow
								icon={<DesktopIcon weight="duotone" />}
								label={where.items.desktopBuild}
								price={creditsText(DESKTOP_BUILD_CREDITS)}
								priceKind="fixed"
							/>
						</tbody>
						<tbody>
							<GroupRow label={where.groups.metered} note={where.meteredNote} />
							<UseRow
								icon={<ChatCircleTextIcon weight="duotone" />}
								label={where.items.builderMessages}
								price={where.meteredPrice}
								priceKind="metered"
							/>
							<UseRow
								icon={<ImageIcon weight="duotone" />}
								label={where.items.images}
								price={where.meteredPrice}
								priceKind="metered"
							/>
							<UseRow
								icon={<FilmStripIcon weight="duotone" />}
								label={where.items.video}
								price={where.meteredPrice}
								priceKind="metered"
							/>
						</tbody>
						<tbody>
							<GroupRow label={where.groups.free} />
							<UseRow
								icon={<GlobeIcon weight="duotone" />}
								label={where.items.publishing}
								price={where.freePrice}
								priceKind="free"
							/>
						</tbody>
					</table>
				</div>
			</Reveal>
		</section>
	);
}

/** The header row of one group. It spans both columns. */
function GroupRow({
	label,
	note,
}: {
	label: string;
	/** One line under the label. Only the metered group has one. */
	note?: string;
}) {
	return (
		<tr>
			<th
				scope="rowgroup"
				colSpan={2}
				className="bg-night/[0.025] px-5 pt-5 pb-3 text-start font-normal md:px-7"
			>
				<span className={GROUP_LABEL_CLASS}>{label}</span>
				{note ? (
					<span className="mt-1 block text-night/60 text-sm">{note}</span>
				) : null}
			</th>
		</tr>
	);
}

/** One action and its price. The price style says the kind: a credit count, the AI cost, or free. */
function UseRow({
	icon,
	label,
	price,
	priceKind,
}: {
	/** A Phosphor icon element. The row sizes and colors it. */
	icon: ReactNode;
	label: string;
	/** The price text, already translated and formatted. */
	price: string;
	priceKind: "fixed" | "metered" | "free";
}) {
	return (
		<tr className="border-night/[0.06] border-t">
			<th
				scope="row"
				className="px-5 py-4 text-start font-medium text-[15px] md:px-7 md:text-base"
			>
				<span className="flex items-center gap-3">
					<span
						aria-hidden
						className="grid size-9 shrink-0 place-items-center rounded-xl bg-night/[0.04] text-night/70 [&_svg]:size-5"
					>
						{icon}
					</span>
					{label}
				</span>
			</th>
			<td className="px-5 py-4 text-end md:px-7">
				<bdi
					className={cn(
						"whitespace-nowrap font-semibold text-[15px] tabular-nums",
						priceKind === "fixed" && "text-night",
						priceKind === "metered" && "text-night/60",
						priceKind === "free" &&
							"rounded-full bg-spark/25 px-2.5 py-1 text-ember-deep text-sm",
					)}
				>
					{price}
				</bdi>
			</td>
		</tr>
	);
}
