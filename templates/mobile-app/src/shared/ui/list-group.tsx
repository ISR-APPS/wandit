/**
 * App list group: rows of settings or links in one surface, like the iOS
 * Settings app. Screens use AppListGroup, not the HeroUI ListGroup, because
 * this file adds the pressed state that the HeroUI row does not have.
 */
import {
	cn,
	ListGroup,
	type ListGroupItemProps,
	type ListGroupRootProps,
} from "heroui-native";

function AppListGroupRoot(props: ListGroupRootProps) {
	return <ListGroup {...props} />;
}

/** A pressable row. It darkens while the finger is down, on the phone and on the web. */
function AppListGroupItem({ className, ...props }: ListGroupItemProps) {
	return (
		<ListGroup.Item
			accessibilityRole="button"
			className={cn("active:bg-default", className)}
			{...props}
		/>
	);
}

/**
 * HeroUI Native ListGroup with its parts. `ItemSuffix` shows a chevron by
 * default; pass children to show another element there.
 */
export const AppListGroup = Object.assign(AppListGroupRoot, {
	Item: AppListGroupItem,
	ItemPrefix: ListGroup.ItemPrefix,
	ItemContent: ListGroup.ItemContent,
	ItemTitle: ListGroup.ItemTitle,
	ItemDescription: ListGroup.ItemDescription,
	ItemSuffix: ListGroup.ItemSuffix,
});
