import React from "react";
import { View, TextInput, Text, StyleSheet, ViewStyle, TextInputProps } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...props
}) => {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: c.textSub }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: c.surface,
            borderColor: error ? c.error : c.border,
            color: c.text,
          },
          style,
        ]}
        {...props}
      />
      {error && <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: "100%",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});
