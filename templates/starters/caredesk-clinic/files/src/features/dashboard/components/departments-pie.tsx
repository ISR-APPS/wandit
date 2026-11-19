// The pie of the departments card: the patients of the period per department, with the count beside each slice.
// DepartmentsCard loads this file with React.lazy, so the chart library stays out of the first script of the app.
// A full pie with outside value labels, as the kit department chart draws it.
import { Pie, PieChart } from "recharts";
import { SPECIALTY_TONE, type Specialty } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "~/shared/ui/chart";
import type { DepartmentSlice } from "../lib/summary";

type DepartmentsPieProps = {
	/** Every department, also at 0. */
	slices: DepartmentSlice[];
};

/** A total of 0 draws one muted disc with no tooltip, because recharts draws no sector for a sum of 0. */
export function DepartmentsPie({ slices }: DepartmentsPieProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.patients, 0);
	const chartConfig = Object.fromEntries(
		slices.map((slice) => [
			slice.specialty,
			{
				label: t(`specialties.${slice.specialty}`),
				color: SPECIALTY_TONE[slice.specialty].color,
			},
		]),
	) satisfies ChartConfig;
	const data: {
		specialty: Specialty | "none";
		patients: number;
		fill: string;
	}[] =
		total === 0
			? [{ specialty: "none", patients: 1, fill: "var(--muted)" }]
			: slices
					.filter((slice) => slice.patients > 0)
					.map((slice) => ({
						specialty: slice.specialty,
						patients: slice.patients,
						fill: `var(--color-${slice.specialty})`,
					}));

	return (
		<ChartContainer
			config={chartConfig}
			className="mx-auto aspect-square max-h-80 w-full [&_.recharts-pie-label-text]:fill-foreground"
			role="img"
			aria-label={`${t("dashboard.departmentsTitle")}: ${slices
				.map(
					(slice) =>
						`${t(`specialties.${slice.specialty}`)} ${number.format(slice.patients)}`,
				)
				.join(", ")}`}
		>
			<PieChart margin={{ top: 16, bottom: 16, left: 24, right: 24 }}>
				{total === 0 ? null : (
					<ChartTooltip content={<ChartTooltipContent hideLabel />} />
				)}
				<Pie
					data={data}
					dataKey="patients"
					nameKey="specialty"
					outerRadius="80%"
					stroke="var(--card)"
					strokeWidth={2}
					label={total > 0}
					isAnimationActive={false}
				/>
			</PieChart>
		</ChartContainer>
	);
}
