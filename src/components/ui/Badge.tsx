import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { EquipmentStatus, TicketStatus, TicketPriority } from "../../types/api";

type BadgeType = EquipmentStatus | TicketStatus | TicketPriority | "employee" | "admin" | "super_admin";

interface BadgeProps {
  type: BadgeType;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ type, style }) => {
  const getBadgeColorsAndLabel = () => {
    switch (type) {
      // Equipment statuses
      case "active":
        return { bg: "#dcfce7", border: "#86efac", text: "#166534", label: "Ativo" };
      case "inactive":
        return { bg: "#f3f4f6", border: "#d1d5db", text: "#374151", label: "Inativo" };
      case "under_maintenance":
        return { bg: "#fef9c3", border: "#fde047", text: "#854d0e", label: "Em Manutenção" };
      case "calibration":
        return { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af", label: "Calibração" };
      case "retired":
        return { bg: "#fee2e2", border: "#fca5a5", text: "#b91c1c", label: "Aposentado" };

      // Ticket statuses
      case "open":
        return { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af", label: "Aberto" };
      case "in_progress":
        return { bg: "#fef9c3", border: "#fde047", text: "#854d0e", label: "Em Progresso" };
      case "waiting":
        return { bg: "#f3f4f6", border: "#d1d5db", text: "#374151", label: "Pendente" };
      case "resolved":
        return { bg: "#dcfce7", border: "#86efac", text: "#166534", label: "Resolvido" };
      case "closed":
        return { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", label: "Fechado" };

      // Ticket priorities
      case "low":
        return { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", label: "Baixa" };
      case "medium":
        return { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af", label: "Média" };
      case "high":
        return { bg: "#fef9c3", border: "#fde047", text: "#854d0e", label: "Alta" };
      case "critical":
        return { bg: "#fee2e2", border: "#fca5a5", text: "#b91c1c", label: "Crítica" };

      // Roles
      case "employee":
        return { bg: "#e0f0fb", border: "#7dd3fc", text: "#0363a9", label: "Funcionário" };
      case "admin":
        return { bg: "#fff7ed", border: "#fdba74", text: "#c2410c", label: "Admin" };
      case "super_admin":
        return { bg: "#f5f3ff", border: "#c4b5fd", text: "#7c3aed", label: "Super Admin" };

      default:
        return { bg: "#f3f4f6", border: "#d1d5db", text: "#374151", label: String(type).toUpperCase() };
    }
  };

  const config = getBadgeColorsAndLabel();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
