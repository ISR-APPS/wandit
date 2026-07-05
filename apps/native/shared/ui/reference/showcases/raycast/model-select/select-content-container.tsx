import { Select, useSelect } from "heroui-native";
import { type FC, type PropsWithChildren, useEffect } from "react";
import Animated, {
	Easing,
	FadeOut,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

const AnimatedSelectContent = Animated.createAnimatedComponent(Select.Content);

export const SelectContentContainer: FC<PropsWithChildren> = ({ children }) => {
	const { isOpen } = useSelect();
	const animatedValue = useSharedValue(isOpen ? 1 : 0);

	useEffect(() => {
		animatedValue.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
	}, [isOpen, animatedValue]);

	const rContainerStyle = useAnimatedStyle(() => {
		return {
			opacity: interpolate(animatedValue.value, [0, 1], [0, 1]),
		};
	});

	return (
		<AnimatedSelectContent
			presentation="dialog"
			// @ts-expect-error
			classNames={{
				wrapper: "p-0 justify-start",
				content: "w-full h-full border-0 bg-transparent gap-2",
			}}
			animation={{
				entering: undefined,
				exiting: FadeOut.duration(150).easing(Easing.out(Easing.quad)),
			}}
			style={rContainerStyle}
		>
			{children}
		</AnimatedSelectContent>
	);
};
