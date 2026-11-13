import { type ReactNode, useEffect, useEffectEvent } from "react";
import { Pressable, Text, View } from "react-native";

/** Screen-owned TF07 bubble and its explicit close affordance. */
export const NativePopupBubble = ({
  children,
  onOpen,
  onClose,
}: {
  readonly children: ReactNode;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) => {
  const opened = useEffectEvent(onOpen);
  useEffect(() => {
    opened();
  }, []);

  return (
    <View
      style={{
        padding: 12,
        backgroundColor: "white",
        borderRadius: 6,
        maxWidth: 240,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close popup"
        onPress={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <Text style={{ alignSelf: "flex-end", fontSize: 20 }}>×</Text>
      </Pressable>
      {children}
    </View>
  );
};
