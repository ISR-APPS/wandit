/**
 * App card. Screens use AppCard and its parts, not the HeroUI Card, so the
 * look of every card changes in this one file.
 */
import { Card, type CardRootProps } from "heroui-native";

/** Same as the HeroUI Native CardRootProps. The parts keep their HeroUI props. */
export type AppCardProps = CardRootProps;

function AppCardRoot(props: AppCardProps) {
	return <Card {...props} />;
}

/** HeroUI Native Card with its parts: Header, Body, Footer, Title, Description. */
export const AppCard = Object.assign(AppCardRoot, {
	Header: Card.Header,
	Body: Card.Body,
	Footer: Card.Footer,
	Title: Card.Title,
	Description: Card.Description,
});
