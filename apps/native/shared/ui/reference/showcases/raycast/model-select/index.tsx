import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Button, cn, colorKit, Select, useThemeColor } from "heroui-native";
import {
	Platform,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { useAppTheme } from "../../../../contexts/app-theme-context";
import { simulatePress } from "../../../../helpers/utils/simulate-press";
import { AppText } from "../../../app-text";
import { SelectBlurBackdrop } from "../../../select/select-blur-backdrop";
import { SelectContentContainer } from "./select-content-container";
import { SelectItem } from "./select-item";
import type { ModelOption } from "./types";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const StyledAnimatedScrollView = withUniwind(AnimatedScrollView);
const StyledFeather = withUniwind(Feather);

type Props = {
	data: ModelOption[];
	model: ModelOption;
	setModel: (model: ModelOption) => void;
};

export const ModelSelect = ({ data, model, setModel }: Props) => {
	const insets = useSafeAreaInsets();
	const { height: screenHeight } = useWindowDimensions();

	const { isDark } = useAppTheme();

	const themeColorSurface = useThemeColor("surface");

	return (
		<Select
			presentation="dialog"
			value={model}
			onValueChange={(value) => {
				const modelValue = data.find((m) => m.value === value?.value);
				setModel(modelValue!);
			}}
			defaultValue={data[0]}
		>
			<Select.Trigger variant="unstyled" asChild>
				<Button
					variant="tertiary"
					size="sm"
					className={cn(
						"h-11 rounded-full border border-neutral-400/25 bg-transparent px-4",
						isDark && "border-neutral-600/25",
					)}
					onPress={() => {
						if (Platform.OS === "android") return;
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
					}}
				>
					<AppText className="text-foreground">{model.emoji}</AppText>
					<AppText className="font-medium text-foreground">
						{model.label}
					</AppText>
				</Button>
			</Select.Trigger>
			<Select.Portal>
				{Platform.OS === "android" ? (
					<Select.Overlay className="bg-background" />
				) : (
					<SelectBlurBackdrop />
				)}

				<SelectContentContainer>
					<View
						className="absolute right-0 left-0 z-50 flex-row items-center justify-center px-8 py-2"
						style={{
							top: insets.top + 8,
						}}
					>
						<Pressable onPress={simulatePress}>
							<AppText className="text-foreground text-lg">Edit</AppText>
						</Pressable>
						<View className="flex-1" />
						<Pressable className="absolute" onPress={simulatePress}>
							<AppText
								className={cn(
									"font-semibold text-foreground text-xl",
									isDark && "font-bold",
								)}
							>
								Presets
							</AppText>
						</Pressable>
						<Pressable onPress={simulatePress}>
							<AppText className="text-foreground text-medium">
								<StyledFeather
									name="plus"
									size={20}
									className="text-foreground"
								/>
							</AppText>
						</Pressable>
					</View>

					<StyledAnimatedScrollView
						entering={SlideInDown.withInitialValues({
							originY: 100,
						})
							.springify()
							.damping(70)
							.stiffness(1000)}
						showsVerticalScrollIndicator={false}
						contentContainerClassName="gap-2"
						contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
					>
						<Select.Close
							className="h-auto w-auto bg-transparent"
							pressableFeedbackHighlightProps={{
								isAnimatedStyleActive: false,
							}}
						>
							<View style={{ height: insets.top + screenHeight * 0.25 }} />
						</Select.Close>
						{data.map((m) => (
							<SelectItem key={m.value} data={m} />
						))}
					</StyledAnimatedScrollView>
					<LinearGradient
						colors={[
							themeColorSurface,
							colorKit.setAlpha(themeColorSurface, 0).hex(),
						]}
						style={[styles.topGradient, { height: insets.top + 100 }]}
					/>
					<LinearGradient
						colors={[
							colorKit.setAlpha(themeColorSurface, 0).hex(),
							themeColorSurface,
						]}
						style={[styles.bottomGradient, { height: insets.bottom + 100 }]}
					/>
				</SelectContentContainer>
			</Select.Portal>
		</Select>
	);
};

const styles = StyleSheet.create({
	topGradient: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		pointerEvents: "none",
	},
	bottomGradient: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		pointerEvents: "none",
	},
});
