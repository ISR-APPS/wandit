import { Card, Chip, cn } from "heroui-native";
import type { FC } from "react";
import { Image, useWindowDimensions, View } from "react-native";
import Animated, {
	type SharedValue,
	useAnimatedStyle,
} from "react-native-reanimated";
import { useAppTheme } from "../../../contexts/app-theme-context";
import { AppText } from "../../app-text";

const AnimatedView = Animated.createAnimatedComponent(View);

export type PreviewCardProps = {
	index: number;
	title: string;
	image: string;
	liveCount: number;
	category: string;
	brands: string;
	itemWidth: number;
	allItemsWidth: number;
	scrollOffsetX: SharedValue<number>;
};

export const PreviewCard: FC<PreviewCardProps> = ({
	index,
	title,
	image,
	liveCount,
	category,
	brands,
	itemWidth,
	allItemsWidth,
	scrollOffsetX,
}) => {
	const { isDark } = useAppTheme();
	const { width: screenWidth } = useWindowDimensions();

	const shift = (allItemsWidth - screenWidth) / 2;
	const initialLeft = index * itemWidth - shift;

	const rContainerStyle = useAnimatedStyle(() => {
		const normalizedOffset =
			((scrollOffsetX.value % allItemsWidth) + allItemsWidth) % allItemsWidth;
		const left = ((initialLeft - normalizedOffset) % allItemsWidth) + shift;

		return {
			left,
		};
	});

	return (
		<AnimatedView
			className="absolute"
			style={[
				{ width: itemWidth, paddingHorizontal: itemWidth * 0.05 },
				rContainerStyle,
			]}
		>
			<Card
				className={cn(
					"aspect-3/5 rounded-3xl border-0",
					isDark && "border border-border/50",
				)}
			>
				<Card.Body className="mb-4 flex-1 p-2">
					<Image
						source={{ uri: image }}
						className="absolute inset-0 rounded-xl"
					/>
					<Chip className="rounded-md bg-danger">
						<Chip.Label className="font-semibold text-white">
							Live • {liveCount}
						</Chip.Label>
					</Chip>
				</Card.Body>
				<Card.Footer>
					<Card.Title className="font-semibold">{title}</Card.Title>
					<Card.Description>
						<AppText className="font-medium text-blue-500">{category}</AppText>{" "}
						• {brands}
					</Card.Description>
				</Card.Footer>
			</Card>
		</AnimatedView>
	);
};
