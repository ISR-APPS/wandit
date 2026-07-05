import {
	cn,
	Tabs as HeroTabs,
	type ItemMeasurements,
	type MeasurementsContextValue,
	type TabsContentProps,
	type TabsIndicatorAnimation,
	type TabsIndicatorProps,
	type TabsLabelProps,
	type TabsListProps,
	type TabsProps,
	type TabsScrollViewProps,
	type TabsSeparatorAnimation,
	type TabsSeparatorProps,
	type TabsTriggerProps,
	type TabsTriggerRenderProps,
	useTabs as useHeroTabs,
	useTabsMeasurements as useHeroTabsMeasurements,
	useTabsTrigger as useHeroTabsTrigger,
} from "heroui-native";
import { type ComponentRef, forwardRef } from "react";

export type AppTabsProps = TabsProps;
export type AppTabsListProps = TabsListProps;
export type AppTabsScrollViewProps = TabsScrollViewProps;
export type AppTabsTriggerProps = TabsTriggerProps;
export type AppTabsTriggerRenderProps = TabsTriggerRenderProps;
export type AppTabsLabelProps = TabsLabelProps;
export type AppTabsIndicatorProps = TabsIndicatorProps;
export type AppTabsIndicatorAnimation = TabsIndicatorAnimation;
export type AppTabsSeparatorProps = TabsSeparatorProps;
export type AppTabsSeparatorAnimation = TabsSeparatorAnimation;
export type AppTabsContentProps = TabsContentProps;
export type AppTabsItemMeasurements = ItemMeasurements;
export type AppTabsMeasurementsContextValue = MeasurementsContextValue;
export type AppTabsContextValue = ReturnType<typeof useHeroTabs>;
export type AppTabsTriggerContextValue = ReturnType<typeof useHeroTabsTrigger>;
export type AppTabsRef = ComponentRef<typeof HeroTabs>;
export type AppTabsListRef = ComponentRef<typeof HeroTabs.List>;
export type AppTabsScrollViewRef = ComponentRef<typeof HeroTabs.ScrollView>;
export type AppTabsTriggerRef = ComponentRef<typeof HeroTabs.Trigger>;
export type AppTabsLabelRef = ComponentRef<typeof HeroTabs.Label>;
export type AppTabsIndicatorRef = ComponentRef<typeof HeroTabs.Indicator>;
export type AppTabsSeparatorRef = ComponentRef<typeof HeroTabs.Separator>;
export type AppTabsContentRef = ComponentRef<typeof HeroTabs.Content>;

const AppTabsRoot = forwardRef<AppTabsRef, AppTabsProps>((props, ref) => (
	<HeroTabs ref={ref} {...props} />
));

AppTabsRoot.displayName = "AppTabs";

const AppTabsSegmentedList = forwardRef<AppTabsListRef, AppTabsListProps>(
	({ className, ...props }, ref) => (
		<HeroTabs.List
			ref={ref}
			className={cn(
				"flex-row rounded-[14px] bg-surface-tertiary p-[5px]",
				className,
			)}
			{...props}
		/>
	),
);

AppTabsSegmentedList.displayName = "AppTabs.SegmentedList";

const AppTabsSegmentedIndicator = forwardRef<
	AppTabsIndicatorRef,
	AppTabsIndicatorProps
>(({ className, ...props }, ref) => (
	<HeroTabs.Indicator
		ref={ref}
		className={cn("rounded-[10px] bg-foreground", className)}
		{...props}
	/>
));

AppTabsSegmentedIndicator.displayName = "AppTabs.SegmentedIndicator";

const AppTabsSegmentedTrigger = forwardRef<
	AppTabsTriggerRef,
	AppTabsTriggerProps
>(({ className, ...props }, ref) => (
	<HeroTabs.Trigger
		ref={ref}
		className={cn(
			"z-10 flex-1 items-center justify-center rounded-[10px] px-3 py-[11px]",
			className,
		)}
		{...props}
	/>
));

AppTabsSegmentedTrigger.displayName = "AppTabs.SegmentedTrigger";

const AppTabsSegmentedLabel = forwardRef<AppTabsLabelRef, AppTabsLabelProps>(
	({ className, ...props }, ref) => {
		const { isSelected } = useHeroTabsTrigger();

		return (
			<HeroTabs.Label
				ref={ref}
				allowFontScaling={false}
				className={cn(
					"font-extrabold text-[15px] leading-[20px] tracking-normal",
					isSelected ? "text-background" : "text-muted",
					className,
				)}
				{...props}
			/>
		);
	},
);

AppTabsSegmentedLabel.displayName = "AppTabs.SegmentedLabel";

export const AppTabs = Object.assign(AppTabsRoot, {
	List: HeroTabs.List,
	ScrollView: HeroTabs.ScrollView,
	Trigger: HeroTabs.Trigger,
	Label: HeroTabs.Label,
	Indicator: HeroTabs.Indicator,
	Separator: HeroTabs.Separator,
	Content: HeroTabs.Content,
	SegmentedList: AppTabsSegmentedList,
	SegmentedIndicator: AppTabsSegmentedIndicator,
	SegmentedTrigger: AppTabsSegmentedTrigger,
	SegmentedLabel: AppTabsSegmentedLabel,
});

export const useAppTabs = useHeroTabs;
export const useAppTabsMeasurements = useHeroTabsMeasurements;
export const useAppTabsTrigger = useHeroTabsTrigger;
