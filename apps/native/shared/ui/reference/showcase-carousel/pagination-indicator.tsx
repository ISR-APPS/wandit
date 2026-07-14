import { View } from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
} from "react-native-reanimated";

const AnimatedView = Animated.createAnimatedComponent(View);

export type PaginationIndicatorProps = {
	index: number;
	scrollY: SharedValue<number>;
	itemSize: number;
};

export function PaginationIndicator({
	index,
	scrollY,
	itemSize,
}: PaginationIndicatorProps) {
	const rContainerStyle = useAnimatedStyle(() => {
		return {
			opacity: interpolate(
				scrollY.get() / itemSize,
				[index - 2, index - 1, index, index + 1, index + 2],
				[0.2, 0.5, 1, 0.5, 0.2],
				Extrapolation.CLAMP,
			),
			transform: [
				{
					scaleX: interpolate(
						scrollY.get() / itemSize,
						[index - 2, index - 1, index, index + 1, index + 2],
						[1, 1.4, 2, 1.4, 1],
						Extrapolation.CLAMP,
					),
				},
			],
		};
	});

	return (
		<AnimatedView
			className="h-[2px] w-3 bg-foreground"
			style={[
				{
					transformOrigin: ["100%", "50%", 0],
				},
				rContainerStyle,
			]}
		/>
	);
}
