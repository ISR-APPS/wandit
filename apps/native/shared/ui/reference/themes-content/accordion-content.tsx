import { Accordion } from "heroui-native";
import { View } from "react-native";
import { AppText } from "../app-text";

const faqData = [
  {
    id: "1",
    title: "What payment methods do you accept?",
    content:
      "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, Apple Pay, and Google Pay.",
  },
  {
    id: "2",
    title: "How long does delivery take?",
    content:
      "Standard delivery takes 3-5 business days. Express delivery is available for 1-2 business days at an additional cost.",
  },
  {
    id: "3",
    title: "What is your return policy?",
    content:
      "You can return any item within 30 days of purchase for a full refund. Items must be in original condition with tags attached.",
  },
];

export const AccordionContent = () => {
  return (
    <View>
      <Accordion variant="surface" defaultValue="1" className="w-full">
        {faqData.map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Trigger>
              <AppText className="text-foreground text-base flex-1">{item.title}</AppText>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <AppText className="text-muted text-base/relaxed">{item.content}</AppText>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </View>
  );
};
