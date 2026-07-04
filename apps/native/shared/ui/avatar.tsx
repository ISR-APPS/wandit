import {
  Avatar as HeroAvatar,
  useAvatar as useHeroAvatar,
  type AvatarColor,
  type AvatarContextValue,
  type AvatarFallbackProps,
  type AvatarFallbackRef,
  type AvatarImageProps,
  type AvatarImageRef,
  type AvatarRootProps,
  type AvatarRootRef,
  type AvatarSize,
} from "heroui-native";
import { forwardRef } from "react";

export type AppAvatarProps = AvatarRootProps;
export type AppAvatarContextValue = AvatarContextValue;
export type AppAvatarFallbackProps = AvatarFallbackProps;
export type AppAvatarFallbackRef = AvatarFallbackRef;
export type AppAvatarImageProps = AvatarImageProps;
export type AppAvatarImageRef = AvatarImageRef;
export type AppAvatarColor = AvatarColor;
export type AppAvatarSize = AvatarSize;
export type AppAvatarRef = AvatarRootRef;

const AppAvatarRoot = forwardRef<AppAvatarRef, AppAvatarProps>((props, ref) => (
  <HeroAvatar ref={ref} {...props} />
));

AppAvatarRoot.displayName = "AppAvatar";

export const AppAvatar = Object.assign(AppAvatarRoot, {
  Image: HeroAvatar.Image,
  Fallback: HeroAvatar.Fallback,
});

export const useAppAvatar = useHeroAvatar;
