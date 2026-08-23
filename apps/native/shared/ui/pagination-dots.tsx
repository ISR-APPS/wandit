import { cn } from "heroui-native";
import { View, type ViewProps } from "react-native";

type FitCalPaginationDotsProps = ViewProps & {
	activeIndex: number;
	count: number;
};

export function FitCalPaginationDots({
	activeIndex,
	count,
	className,
	...props
}: FitCalPaginationDotsProps) {
	const dots = Array.from({ length: count }, (_, index) => ({
		id: `pagination-dot-${index}`,
		index,
	}));

	return (
		<View className={cn("flex-row gap-[7px]", className)} {...props}>
			{dots.map((dot) => (
				<View
					className={cn(
						"h-[7px] rounded-full",
						dot.index === activeIndex
							? "w-[26px] bg-foreground"
							: "w-[7px] bg-separator",
					)}
					key={dot.id}
				/>
			))}
		</View>
	);
}
