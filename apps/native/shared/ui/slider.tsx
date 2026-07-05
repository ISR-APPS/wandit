import {
	Slider as HeroSlider,
	type SliderContextValue,
	type SliderFillProps,
	type SliderOrientation,
	type SliderOutputProps,
	type SliderProps,
	type SliderRenderProps,
	type SliderState,
	type SliderThumbProps,
	type SliderTrackProps,
	type SliderValue,
	useSlider as useHeroSlider,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppSliderProps = SliderProps;
export type AppSliderOutputProps = SliderOutputProps;
export type AppSliderTrackProps = SliderTrackProps;
export type AppSliderFillProps = SliderFillProps;
export type AppSliderThumbProps = SliderThumbProps;
export type AppSliderContextValue = SliderContextValue;
export type AppSliderOrientation = SliderOrientation;
export type AppSliderRenderProps = SliderRenderProps;
export type AppSliderState = SliderState;
export type AppSliderValue = SliderValue;
export type AppSliderRef = View;
export type AppSliderOutputRef = View;
export type AppSliderTrackRef = View;
export type AppSliderFillRef = View;
export type AppSliderThumbRef = View;

const AppSliderRoot = forwardRef<AppSliderRef, AppSliderProps>((props, ref) => (
	<HeroSlider ref={ref} {...props} />
));

AppSliderRoot.displayName = "AppSlider";

export const AppSlider = Object.assign(AppSliderRoot, {
	Output: HeroSlider.Output,
	Track: HeroSlider.Track,
	Fill: HeroSlider.Fill,
	Thumb: HeroSlider.Thumb,
});

export const useAppSlider = useHeroSlider;
