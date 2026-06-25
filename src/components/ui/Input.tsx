import React from "react";
import { View, TextInput, Text, StyleSheet, ViewStyle, TextInputProps } from "react-native";

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
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor="#5E636E"
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: "100%",
  },
  label: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: "#151618",
    borderColor: "#2E3033",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: "#F8FAFC",
    fontSize: 15,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },
});
