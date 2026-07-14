import {
	type AccordionContentProps,
	type AccordionContextValue,
	type AccordionIndicatorProps,
	type AccordionItemProps,
	type AccordionRootProps,
	type AccordionTriggerProps,
	type AccordionVariant,
	Accordion as HeroAccordion,
	AccordionLayoutTransition as HeroAccordionLayoutTransition,
	useAccordion as useHeroAccordion,
	useAccordionItem as useHeroAccordionItem,
} from "heroui-native";

export type AppAccordionProps = AccordionRootProps;
export type AppAccordionItemProps = AccordionItemProps;
export type AppAccordionTriggerProps = AccordionTriggerProps;
export type AppAccordionIndicatorProps = AccordionIndicatorProps;
export type AppAccordionContentProps = AccordionContentProps;
export type AppAccordionContextValue = AccordionContextValue;
export type AppAccordionVariant = AccordionVariant;

export const AppAccordion = HeroAccordion;
export const AppAccordionLayoutTransition = HeroAccordionLayoutTransition;
export const useAppAccordion = useHeroAccordion;
export const useAppAccordionItem = useHeroAccordionItem;
