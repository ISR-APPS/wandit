import {
  Card as HeroCard,
  type CardBodyProps,
  type CardDescriptionProps,
  type CardFooterProps,
  type CardHeaderProps,
  type CardRootProps,
  type CardTitleProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppCardProps = CardRootProps;
export type AppCardHeaderProps = CardHeaderProps;
export type AppCardBodyProps = CardBodyProps;
export type AppCardFooterProps = CardFooterProps;
export type AppCardTitleProps = CardTitleProps;
export type AppCardDescriptionProps = CardDescriptionProps;

const AppCardRoot = forwardRef<View, AppCardProps>((props, ref) => (
  <HeroCard ref={ref} {...props} />
));

AppCardRoot.displayName = "AppCard";

export const AppCard = Object.assign(AppCardRoot, {
  Header: HeroCard.Header,
  Body: HeroCard.Body,
  Footer: HeroCard.Footer,
  Title: HeroCard.Title,
  Description: HeroCard.Description,
});
