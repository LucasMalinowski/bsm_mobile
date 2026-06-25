import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const isButtonDisabled = disabled || loading;

  const getButtonStyles = () => {
    switch (variant) {
      case "secondary":
        return styles.secondary;
      case "danger":
        return styles.danger;
      case "outline":
        return styles.outline;
      case "primary":
      default:
        return styles.primary;
    }
  };

  const getTextStyles = () => {
    switch (variant) {
      case "outline":
        return styles.textOutline;
      case "secondary":
        return styles.textSecondary;
      case "primary":
      case "danger":
      default:
        return styles.textPrimary;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isButtonDisabled}
      style={[styles.base, getButtonStyles(), isButtonDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "secondary" ? "#6366F1" : "#FFFFFF"}
        />
      ) : (
        <Text style={[styles.textBase, getTextStyles(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  primary: {
    backgroundColor: "#6366F1", // Indigo Accent
  },
  secondary: {
    backgroundColor: "#1F2022",
    borderWidth: 1,
    borderColor: "#2E3033",
  },
  danger: {
    backgroundColor: "#EF4444", // Crimson Red
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontSize: 15,
    fontWeight: "600",
  },
  textPrimary: {
    color: "#FFFFFF",
  },
  textSecondary: {
    color: "#E2E8F0",
  },
  textOutline: {
    color: "#6366F1",
  },
});
