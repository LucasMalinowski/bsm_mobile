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
        return { bg: "#062F29", border: "#0D9488", text: "#14B8A6", label: "Ativo" };
      case "inactive":
        return { bg: "#27272A", border: "#52525B", text: "#A1A1AA", label: "Inativo" };
      case "under_maintenance":
        return { bg: "#3C1F03", border: "#D97706", text: "#F59E0B", label: "Em Manutenção" };
      case "calibration":
        return { bg: "#0A2540", border: "#007BFF", text: "#3B82F6", label: "Calibração" };
      case "retired":
        return { bg: "#1C1917", border: "#44403C", text: "#78716C", label: "Aposentado" };

      // Ticket statuses
      case "open":
        return { bg: "#3B0712", border: "#9F1239", text: "#FDA4AF", label: "Aberto" };
      case "in_progress":
        return { bg: "#0F172A", border: "#2563EB", text: "#60A5FA", label: "Em Progresso" };
      case "waiting":
        return { bg: "#2D1A05", border: "#B45309", text: "#FBBF24", label: "Pendente" };
      case "resolved":
        return { bg: "#022C22", border: "#047857", text: "#34D399", label: "Resolvido" };
      case "closed":
        return { bg: "#18181B", border: "#27272A", text: "#9FA6B2", label: "Fechado" };

      // Ticket priorities
      case "low":
        return { bg: "#0F172A", border: "#334155", text: "#94A3B8", label: "Baixa" };
      case "medium":
        return { bg: "#3B2A0A", border: "#D97706", text: "#FBBF24", label: "Média" };
      case "high":
        return { bg: "#4C1D1D", border: "#B91C1C", text: "#FCA5A5", label: "Alta" };
      case "critical":
        return { bg: "#4A0404", border: "#DC2626", text: "#FCA5A5", label: "Crítica" };

      // Roles
      case "employee":
        return { bg: "#0F172A", border: "#6366F1", text: "#818CF8", label: "Funcionário" };
      case "admin":
        return { bg: "#3C150A", border: "#EA580C", text: "#FB923C", label: "Admin" };
      case "super_admin":
        return { bg: "#311042", border: "#9333EA", text: "#D8B4FE", label: "Super Admin" };

      default:
        return { bg: "#1F2022", border: "#2E3033", text: "#F8FAFC", label: String(type).toUpperCase() };
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
