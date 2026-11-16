// The hours and the address of the clinic on one flat plate. BookingSection renders it under the waiting room photo.
// The header link "Access" goes to its id. The telephone and the email are sample details of the `site` group.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL, PLATE } from "../lib/type-styles";

// The clock rows of the hours table: the key of the day and the key of its hours.
const HOURS_ROWS = [
	{ day: "access.weekdays", hours: "access.weekdaysHours" },
	{ day: "access.friday", hours: "access.fridayHours" },
	{ day: "access.saturday", hours: "access.saturdayHours" },
	{ day: "access.laboratory", hours: "access.laboratoryHours" },
] as const;

const CONTACT_LINK =
	"inline-flex min-h-11 items-center text-(--sp-teal-deep) underline decoration-primary/40 underline-offset-4 transition-colors duration-200 hover:decoration-primary md:min-h-0";

/** The plate with the id "access". The last row of the table is in teal: it is the only row with no clock time. */
export function AccessPlate({ className }: { className?: string }) {
	const { t } = useT();
	return (
		<aside
			id="access"
			aria-labelledby="access-title"
			className={cn(
				PLATE,
				"scroll-mt-24 p-[clamp(20px,2.4vw,30px)]",
				className,
			)}
		>
			<h3
				id="access-title"
				className={cn(LABEL, "text-muted-foreground tracking-[0.14em]")}
			>
				{t("access.label")}
			</h3>
			<table className="mt-4 w-full border-collapse text-sm">
				<thead>
					<tr className={cn(LABEL, "text-muted-foreground tracking-[0.14em]")}>
						<th
							scope="col"
							className="border-border border-b pb-2.5 text-start font-semibold"
						>
							{t("access.columnDay")}
						</th>
						<th
							scope="col"
							className="border-border border-b pb-2.5 text-end font-semibold"
						>
							{t("access.columnHours")}
						</th>
					</tr>
				</thead>
				<tbody>
					{HOURS_ROWS.map((row) => (
						<tr key={row.day} className="border-border/70 border-b">
							<td className="py-2.5 align-baseline">{t(row.day)}</td>
							<td className="whitespace-nowrap py-2.5 ps-4 text-end align-baseline text-muted-foreground tabular-nums">
								{t(row.hours)}
							</td>
						</tr>
					))}
					{/* The urgent row spans both columns, so its long text never squeezes the day column.
					    On a phone its hours wrap under the label and stay at the end edge. */}
					<tr className="text-(--sp-teal-deep)">
						<td colSpan={2} className="py-2.5">
							<span className="flex flex-wrap gap-x-4">
								<span>{t("access.urgent")}</span>
								<span className="ms-auto">{t("access.urgentHours")}</span>
							</span>
						</td>
					</tr>
				</tbody>
			</table>
			<address className="mt-5.5 text-[0.9375rem] text-muted-foreground not-italic leading-[1.7]">
				<span className="block font-medium text-foreground">
					{t("access.addressName")}
				</span>
				<span className="block">{t("access.addressStreet")}</span>
				<span className="block">{t("access.addressCity")}</span>
				<span className="mt-1 flex flex-wrap gap-x-5">
					<a
						href={t("site.phoneHref")}
						className={cn(CONTACT_LINK, "tabular-nums")}
					>
						{t("site.phoneDisplay")}
					</a>
					<a href={`mailto:${t("site.email")}`} className={CONTACT_LINK}>
						{t("site.email")}
					</a>
				</span>
			</address>
			<p className="mt-4.5 border-border/70 border-t pt-4 text-[0.8125rem] text-muted-foreground leading-[1.65]">
				{t("access.note")}
			</p>
		</aside>
	);
}
