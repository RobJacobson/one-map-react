import type { ReactElement, ReactNode } from "react";
import {
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";

import type { MapProps } from "../../contracts/map-types.js";
import { useNativeMapPresentation } from "./native-map-presentation.js";

/** Props for the shared native map container and overlay portal host. */
export interface NativeMapHostProps {
  readonly style?: MapProps["style"];
  readonly hostProps?: ViewProps;
  readonly children: ReactNode;
}

/**
 * Renders the shared native viewport container and trailing overlay portal host.
 *
 * Consumes presentation context here so adapter map subtrees passed as
 * `children` can bail out across viewport layout updates.
 */
export const NativeMapHost = ({
  style,
  hostProps,
  children,
}: NativeMapHostProps): ReactElement => {
  const { overlayHostName, setNativeLayout } = useNativeMapPresentation();

  return (
    <PortalProvider>
      <View
        {...hostProps}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setNativeLayout(width, height);
          hostProps?.onLayout?.(event);
        }}
        // Common width strings cross the native host dimension boundary here.
        style={[style as StyleProp<ViewStyle>, hostProps?.style]}
      >
        {children}
        <PortalHost
          name={overlayHostName}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          }}
        />
      </View>
    </PortalProvider>
  );
};
