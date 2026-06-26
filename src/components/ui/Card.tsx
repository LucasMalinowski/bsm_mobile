import React from "react";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  const { colors: c, isDark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          marginVertical: 6,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: isDark ? 4 : 1 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: isDark ? 6 : 3,
          elevation: isDark ? 3 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
