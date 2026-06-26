import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

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
  const { colors: c } = useTheme();
  const isButtonDisabled = disabled || loading;

  const getBgColor = () => {
    switch (variant) {
      case "secondary": return c.surface2;
      case "danger": return "#EF4444";
      case "outline": return "transparent";
      default: return c.primary;
    }
  };

  const getBorderColor = () => {
    if (variant === "outline") return c.primary;
    if (variant === "secondary") return c.border;
    return "transparent";
  };

  const getTextColor = () => {
    switch (variant) {
      case "outline": return c.primary;
      case "secondary": return c.text;
      default: return "#ffffff";
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isButtonDisabled}
      style={[
        styles.base,
        {
          backgroundColor: getBgColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "outline" || variant === "secondary" ? 1 : 0,
          opacity: isButtonDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "outline" || variant === "secondary" ? c.primary : "#ffffff"} />
      ) : (
        <Text style={[styles.textBase, { color: getTextColor() }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  textBase: {
    fontSize: 15,
    fontWeight: "600",
  },
});
