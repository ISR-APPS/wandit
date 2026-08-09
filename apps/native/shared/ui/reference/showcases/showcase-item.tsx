import { Image as ExpoImage } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { Chip, cn, Surface } from "heroui-native";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
	useDerivedValue,
} from "react-native-reanimated";
import { useAppTheme } from "../../contexts/app-theme-context";
import { AppText } from "../app-text";

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ShowcaseComponent = {
	name: string;
	href: string;
};

export type ShowcaseItemData = {
	imageLight: string;
	imageDark: string;
	title: string;
	description: string;
	href: string;
	components: ShowcaseComponent[];
};

export type ShowcaseItemProps = {
	index: number;
	scrollY: SharedValue<number>;
	item: ShowcaseItemData;
	itemSize: number;
};

export function ShowcaseItem({
	item,
	index,
	scrollY,
	itemSize,
}: ShowcaseItemProps) {
	const router = useRouter();

	const { isDark } = useAppTheme();

	const animatedIndex = useDerivedValue(() => {
		return scrollY.get() / itemSize;
	});

	const rContainerStyle = useAnimatedStyle(() => {
		const translateY =
			Platform.OS === "ios"
				? interpolate(
						scrollY.get(),
						[(index - 1) * itemSize, index * itemSize, index * itemSize + 1],
						[0, 0, 1],
					)
				: 0;

		return {
			opacity: interpolate(
				animatedIndex.get(),
				[index - 1, index, index + 1],
				[0, 1, 0],
			),
			transform: [
				{
					translateY,
				},
				{
					scale: interpolate(
						scrollY.get(),
						[(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
						[1.2, 1, 0.5],
						{
							extrapolateRight: Extrapolation.CLAMP,
						},
					),
				},
			],
		};
	});

	const rImageStyle = useAnimatedStyle(() => {
		return {
			opacity: interpolate(
				animatedIndex.get(),
				[index - 1, index, index + 1],
				[0, isDark ? 0.15 : 0.3, 0],
			),
			transform: [
				{
					translateY: interpolate(
						scrollY.get(),
						[(index - 1) * itemSize, index * itemSize, index * itemSize + 1],
						[0, 0, 1],
					),
				},
				{
					scale: interpolate(
						scrollY.get(),
						[(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
						[5, 1, 1],
						{
							extrapolateRight: Extrapolation.CLAMP,
						},
					),
				},
			],
		};
	});

	return (
		<View className="flex-1">
			<AnimatedView style={[StyleSheet.absoluteFill, rImageStyle]}>
				<ExpoImage
					source={{ uri: isDark ? item.imageDark : item.imageLight }}
					style={StyleSheet.absoluteFill}
					blurRadius={100}
				/>
			</AnimatedView>
			<AnimatedView
				className="flex-1 items-center justify-center p-8"
				style={[rContainerStyle]}
			>
				<Pressable
					className="mb-5"
					onPress={() => router.push(item.href as Href)}
				>
					<AppText className="font-semibold text-2xl/7 text-foreground">
						{item.title}
					</AppText>
				</Pressable>
				<AnimatedPressable onPress={() => router.push(item.href as Href)}>
					<Surface
						className={cn(
							"aspect-[1/2] w-[62%] items-center justify-center rounded-3xl border border-neutral-100 p-0 shadow-2xl shadow-black/5",
							isDark && "border-neutral-900 shadow-none",
						)}
					>
						<ExpoImage
							source={{ uri: isDark ? item.imageDark : item.imageLight }}
							style={StyleSheet.absoluteFill}
							transition={200}
						/>
					</Surface>
				</AnimatedPressable>
				<View className="w-[82%] gap-5 pt-8">
					<View className="flex-row flex-wrap justify-center gap-2">
						{item.components.map((component) => (
							<Chip
								key={component.href}
								variant="secondary"
								size="sm"
								onPress={() => router.push(component.href as Href)}
							>
								{component.name}
							</Chip>
						))}
					</View>
					<AppText className="text-center font-medium text-base text-foreground/60">
						{item.description}
					</AppText>
				</View>
			</AnimatedView>
		</View>
	);
}
