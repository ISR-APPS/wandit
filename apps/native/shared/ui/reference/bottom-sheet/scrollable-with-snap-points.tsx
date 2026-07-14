import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheetFooter, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BottomSheet, Button, Card, cn, Separator } from "heroui-native";
import { type ComponentProps, useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { withUniwind } from "uniwind";
import { useAppTheme } from "../../contexts/app-theme-context";
import { AppText } from "../app-text";

const StyledIonicons = withUniwind(Ionicons);
type BottomSheetFooterProps = ComponentProps<typeof BottomSheetFooter>;

export const ScrollableWithSnapPointsContent = () => {
	const [isOpen, setIsOpen] = useState(false);

	const { isDark } = useAppTheme();

	const snapPoints = useMemo(() => ["40%", "80%"], []);

	const taxiOptions = [
		{
			id: "priority",
			name: "Taxi Priority",
			icon: "flash-outline" as const,
			time: "1 min",
			capacity: "4",
			price: "c. €12-19",
			highlight: false,
		},
		{
			id: "comfort",
			name: "Taxi Comfort",
			icon: "star-outline" as const,
			time: "6 min",
			capacity: "4",
			price: "c. €11-18",
			highlight: false,
		},
		{
			id: "green",
			name: "Green Taxi",
			icon: "leaf-outline" as const,
			time: "6 min",
			capacity: "4",
			price: "c. €11-17",
			highlight: false,
		},
		{
			id: "premium",
			name: "Premium",
			icon: "car-sport-outline" as const,
			time: "10 min",
			capacity: "4",
			description: "High end cars, top drivers",
			price: "€30.89",
			highlight: true,
		},
		{
			id: "xl",
			name: "Taxi XL",
			icon: "car-outline" as const,
			time: "2 min",
			capacity: "5-8",
			price: "c. €12-19",
			highlight: false,
		},
	];

	const renderFooter = useCallback(
		(props: BottomSheetFooterProps) => (
			<BottomSheetFooter {...props}>
				<View className="bg-overlay px-4 pb-safe-offset-3">
					<Separator className="-mx-4 mb-3" />
					<Button variant="danger" onPress={() => setIsOpen(false)}>
						Order Premium now
					</Button>
				</View>
			</BottomSheetFooter>
		),
		[],
	);

	return (
		<View className="flex-1">
			<View className="flex-1 items-center justify-center">
				<BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
					<BottomSheet.Trigger asChild>
						<Button variant="secondary" isDisabled={isOpen}>
							Scrollable with snap points
						</Button>
					</BottomSheet.Trigger>
					<BottomSheet.Portal>
						<BottomSheet.Overlay />
						<BottomSheet.Content
							snapPoints={snapPoints}
							enableOverDrag={false}
							enableDynamicSizing={false}
							footerComponent={renderFooter}
							contentContainerClassName="h-full px-0"
							handleComponent={() => null}
						>
							<View className="flex-row items-center justify-between pr-5 pb-3 pl-7">
								<BottomSheet.Title className="font-bold text-xl">
									Select a way to travel
								</BottomSheet.Title>
								<BottomSheet.Close />
							</View>
							<Separator className="-mx-5" />
							<BottomSheetScrollView
								contentContainerClassName="pb-safe-offset-12"
								showsVerticalScrollIndicator={false}
							>
								<View className="mb-4 px-3">
									{taxiOptions.map((option) => (
										<Card
											key={option.id}
											className={cn(
												"mb-2 flex-row items-center shadow-none",
												!option.highlight
													? "bg-transparent"
													: isDark
														? "bg-green-900/40"
														: "bg-green-50",
											)}
										>
											<View
												className={cn(
													"mr-3 size-12 items-center justify-center rounded-full",
													option.highlight
														? "bg-black"
														: option.icon === "leaf-outline"
															? "bg-green-500"
															: "bg-black",
												)}
											>
												<StyledIonicons
													name={option.icon}
													size={24}
													className="text-white"
												/>
											</View>
											<Card.Body className="flex-1">
												<Card.Title className="font-semibold text-base">
													{option.name}
												</Card.Title>
												<Card.Description className="text-sm">
													in {option.time} • {option.capacity}
												</Card.Description>
												{option.description && (
													<Card.Description className="mt-1 text-success text-xs">
														{option.description}
													</Card.Description>
												)}
											</Card.Body>
											<View className="flex-row items-center">
												<AppText className="font-semibold text-base text-foreground">
													{option.price}
												</AppText>
												{option.highlight && (
													<StyledIonicons
														name="chevron-forward"
														size={20}
														className="ml-2 text-muted"
													/>
												)}
											</View>
										</Card>
									))}
								</View>
								<View className="px-3">
									<Card
										className={cn(
											"mb-4 flex-row items-center",
											isDark ? "bg-amber-900/40" : "bg-amber-50",
										)}
									>
										<View className="mr-3 size-8 items-center justify-center rounded-full bg-yellow-400">
											<AppText className="font-bold text-black text-xs">
												P
											</AppText>
										</View>
										<Card.Body className="flex-1">
											<Card.Title className="font-semibold text-sm">
												10% off all trips with PLUS
											</Card.Title>
											<Card.Description className="text-xs">
												Subscribe for €6.99/month
											</Card.Description>
										</Card.Body>
										<StyledIonicons
											name="chevron-forward"
											size={20}
											className="text-muted"
										/>
									</Card>
									<Card
										className={cn(
											"mb-8 flex-row items-center",
											isDark ? "bg-gray-900/40" : "bg-gray-100",
										)}
									>
										<View className="mr-3 size-10 items-center justify-center rounded-lg bg-red-500">
											<StyledIonicons
												name="person"
												size={20}
												className="text-white"
											/>
										</View>
										<Card.Body className="flex-1">
											<Card.Title className="font-semibold text-sm">
												Personal
											</Card.Title>
											<Card.Description className="text-xs">
												Visa ••••
											</Card.Description>
										</Card.Body>
										<StyledIonicons
											name="chevron-forward"
											size={20}
											className="text-muted"
										/>
									</Card>
									<View className="mb-6 px-4">
										<BottomSheet.Title className="mb-3 font-semibold">
											Trip Details
										</BottomSheet.Title>
										<BottomSheet.Description className="mb-2 text-sm">
											Estimated arrival time: 10 minutes
										</BottomSheet.Description>
										<BottomSheet.Description className="mb-2 text-sm">
											Distance: 4.2 km
										</BottomSheet.Description>
										<BottomSheet.Description className="text-sm">
											Your driver will arrive at the pickup location shortly.
											Please be ready when they arrive.
										</BottomSheet.Description>
									</View>
									<View className="mb-6 px-4">
										<BottomSheet.Title className="mb-3 font-semibold">
											Important Information
										</BottomSheet.Title>
										<BottomSheet.Description className="mb-2 text-sm">
											• All prices include taxes and fees
										</BottomSheet.Description>
										<BottomSheet.Description className="mb-2 text-sm">
											• Payment will be processed after trip completion
										</BottomSheet.Description>
										<BottomSheet.Description className="mb-2 text-sm">
											• Cancellation fees may apply if cancelled after 2 minutes
										</BottomSheet.Description>
										<BottomSheet.Description className="text-sm">
											• For support, contact us through the app or call
											+1-800-TAXI-HELP
										</BottomSheet.Description>
									</View>
									<View className="px-4">
										<BottomSheet.Title className="mb-3 font-semibold">
											Safety & Security
										</BottomSheet.Title>
										<BottomSheet.Description className="mb-2 text-sm">
											All our drivers are verified and background-checked. Your
											safety is our top priority.
										</BottomSheet.Description>
										<BottomSheet.Description className="text-sm">
											Share your trip details with friends and family for added
											security.
										</BottomSheet.Description>
									</View>
								</View>
							</BottomSheetScrollView>
						</BottomSheet.Content>
					</BottomSheet.Portal>
				</BottomSheet>
			</View>
		</View>
	);
};
