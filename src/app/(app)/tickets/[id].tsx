import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, Image, RefreshControl, Modal, FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { can } from "../../../auth/permissions";
import { usersApi } from "../../../api/users";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { ticketsApi } from "../../../api/tickets";
import { TicketStatus } from "../../../types/api";

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting", "closed"],
  in_progress: ["waiting", "resolved", "closed"],
  waiting: ["in_progress", "resolved", "closed"],
  resolved: ["closed"],
  closed: [],
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  waiting: "Aguardando",
  resolved: "Resolvido",
  closed: "Fechado",
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ["users-assignable"],
    queryFn: () => usersApi.list(),
    enabled: assignModalVisible,
  });

  const reassignMutation = useMutation({
    mutationFn: (userId: string | null) => ticketsApi.update(id, { assigned_to: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      setAssignModalVisible(false);
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível reatribuir o chamado."),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => ticketsApi.get(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { title: string; description: string; priority: "low" | "medium" | "high" | "critical" }) =>
      ticketsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setEditModalVisible(false);
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível atualizar o chamado."),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: TicketStatus) => ticketsApi.update(id, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível alterar o status."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => ticketsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      router.replace("/(app)/(tabs)/tickets");
    },
    onError: (err: any) => Alert.alert("Erro", err.message || "Não foi possível excluir o chamado."),
  });

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try {
      await ticketsApi.addComment(id, comment.trim());
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível adicionar o comentário.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Excluir Chamado",
      "Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>;
  }

  if (isError || !data?.data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={s.errorText}>Erro ao carregar chamado.</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.backBtn}>
          <Text style={s.backBtnText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ticket = data.data;
  const comments = ticket.comments ?? [];
  const nextStatuses = NEXT_STATUSES[ticket.status] ?? [];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backAction}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Detalhes do Chamado</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366F1" />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title + Status */}
        <Card style={s.mainCard}>
          <View style={s.cardTop}>
            <Badge type={ticket.status} />
            <Badge type={ticket.priority} />
          </View>
          <Text style={s.ticketTitle}>{ticket.title}</Text>
          <Text style={s.ticketDesc}>{ticket.description}</Text>

          {ticket.photo_url && (
            <Image source={{ uri: ticket.photo_url }} style={s.photo} resizeMode="cover" />
          )}

          {/* Meta info */}
          <View style={s.metaGrid}>
            {ticket.equipment && (
              <View style={s.metaItem}>
                <Ionicons name="cube-outline" size={14} color="#64748B" />
                <TouchableOpacity onPress={() => router.push(`/(app)/equipment/${ticket.equipment!.id}`)}>
                  <Text style={[s.metaValue, { color: "#818CF8" }]}>{ticket.equipment.name}</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={s.metaItem}>
              <Ionicons name="person-outline" size={14} color="#64748B" />
              <Text style={s.metaValue}>{ticket.creator?.name ?? "Desconhecido"}</Text>
            </View>
            {ticket.assignee && (
              <View style={s.metaItem}>
                <Ionicons name="person-add-outline" size={14} color="#64748B" />
                <Text style={s.metaValue}>{ticket.assignee.name}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Status Transitions */}
        {can(user, "ticket:update") && nextStatuses.length > 0 && (
          <Card style={s.actionsCard}>
            <Text style={s.sectionLabel}>Alterar Status</Text>
            <View style={s.statusBtns}>
              {nextStatuses.map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => statusMutation.mutate(st)}
                  disabled={statusMutation.isPending}
                  style={[s.statusBtn, statusMutation.isPending && { opacity: 0.5 }]}
                >
                  <Text style={s.statusBtnText}>→ {STATUS_LABELS[st]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Edit / Reassign / Delete */}
        {can(user, "ticket:update") && (
          <View style={s.mgmtRow}>
            <Button
              title="Editar"
              variant="outline"
              onPress={() => {
                setEditTitle(ticket.title);
                setEditDescription(ticket.description);
                setEditPriority(ticket.priority);
                setEditModalVisible(true);
              }}
              style={s.halfBtn}
            />
            {can(user, "ticket:assign") && (
              <Button title="Atribuir" variant="outline" onPress={() => setAssignModalVisible(true)} style={s.halfBtn} />
            )}
            {can(user, "ticket:delete") && (
              <Button title="Excluir" variant="danger" onPress={handleDelete} style={s.halfBtn} />
            )}
          </View>
        )}

        {/* Comments */}
        <Text style={s.commentsTitle}>Comentários ({comments.length})</Text>
        {comments.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyText}>Sem comentários ainda.</Text>
          </Card>
        ) : (
          comments.map((c) => (
            <Card key={c.id} style={s.commentCard}>
              <View style={s.commentHeader}>
                <Text style={s.commentAuthor}>{c.user?.name ?? "Usuário"}</Text>
                <Text style={s.commentDate}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</Text>
              </View>
              <Text style={s.commentBody}>{c.body}</Text>
            </Card>
          ))
        )}

        {/* Add Comment */}
        {can(user, "ticket:update") && (
          <Card style={s.addCommentCard}>
            <Text style={s.sectionLabel}>Adicionar Comentário</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Escreva um comentário..."
              placeholderTextColor="#5E636E"
              style={s.commentInput}
              multiline
              numberOfLines={3}
            />
            <Button
              title="Publicar Comentário"
              onPress={handleAddComment}
              loading={submittingComment}
              disabled={!comment.trim()}
              style={{ marginTop: 8, marginVertical: 0 }}
            />
          </Card>
        )}
      </ScrollView>

      {/* Reassign Modal */}
      <Modal visible={assignModalVisible} animationType="slide" transparent onRequestClose={() => setAssignModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Atribuir Chamado</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: null, name: "Sem atribuição" }, ...(usersData ?? [])]}
              keyExtractor={(u: any) => u.id ?? "__none"}
              style={{ maxHeight: 400 }}
              renderItem={({ item }: any) => (
                <TouchableOpacity
                  style={s.assignItem}
                  onPress={() => reassignMutation.mutate(item.id)}
                  disabled={reassignMutation.isPending}
                >
                  <View style={s.assignAvatar}>
                    <Text style={s.assignAvatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.assignName}>{item.name}</Text>
                    {item.email && <Text style={s.assignEmail}>{item.email}</Text>}
                  </View>
                  {ticket.assigned_to === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Editar Chamado</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={s.modalScroll}>
              <Text style={s.editLabel}>Título *</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Título do chamado"
                placeholderTextColor="#5E636E"
                style={s.editInput}
              />

              <Text style={s.editLabel}>Descrição *</Text>
              <TextInput
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Descrição detalhada"
                placeholderTextColor="#5E636E"
                style={[s.editInput, s.editTextArea]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={s.editLabel}>Prioridade</Text>
              <View style={s.editChips}>
                {(["low", "medium", "high", "critical"] as const).map((p) => {
                  const labels = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setEditPriority(p)}
                      style={[s.editChip, editPriority === p && s.editChipActive]}
                    >
                      <Text style={[s.editChipText, editPriority === p && s.editChipTextActive]}>{labels[p]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title="Salvar Alterações"
                onPress={() => {
                  if (!editTitle.trim() || !editDescription.trim()) {
                    Alert.alert("Atenção", "Título e descrição são obrigatórios.");
                    return;
                  }
                  updateMutation.mutate({ title: editTitle.trim(), description: editDescription.trim(), priority: editPriority });
                }}
                loading={updateMutation.isPending}
                style={s.modalSaveBtn}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0F10" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F0F10", padding: 24 },
  errorText: { color: "#EF4444", fontSize: 15, marginTop: 12, textAlign: "center", marginBottom: 16 },
  backBtn: { backgroundColor: "#6366F1", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  backBtnText: { color: "#FFFFFF", fontWeight: "600" },
  header: { height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111214", borderBottomWidth: 1, borderBottomColor: "#2E3033", paddingHorizontal: 16, paddingTop: 12 },
  backAction: { padding: 4 },
  headerTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", maxWidth: "80%" },
  scroll: { padding: 16, paddingBottom: 48 },
  mainCard: { backgroundColor: "#151618", marginBottom: 16 },
  cardTop: { flexDirection: "row", gap: 8, marginBottom: 12 },
  ticketTitle: { fontSize: 18, fontWeight: "700", color: "#F8FAFC", marginBottom: 10 },
  ticketDesc: { fontSize: 14, color: "#94A3B8", lineHeight: 20, marginBottom: 12 },
  photo: { width: "100%", height: 200, borderRadius: 8, marginBottom: 12 },
  metaGrid: { gap: 8, borderTopWidth: 1, borderTopColor: "#212225", paddingTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaValue: { fontSize: 13, color: "#E2E8F0", fontWeight: "500" },
  actionsCard: { backgroundColor: "#151618", marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#94A3B8", marginBottom: 10 },
  statusBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#1C1D20", borderRadius: 8, borderWidth: 1, borderColor: "#2E3033" },
  statusBtnText: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
  mgmtRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  halfBtn: { flex: 1, marginVertical: 0 },
  commentsTitle: { fontSize: 16, fontWeight: "700", color: "#F8FAFC", marginBottom: 12 },
  emptyCard: { alignItems: "center", paddingVertical: 20 },
  emptyText: { color: "#475569", fontSize: 13 },
  commentCard: { backgroundColor: "#151618", marginBottom: 10 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  commentAuthor: { fontSize: 13, fontWeight: "700", color: "#E2E8F0" },
  commentDate: { fontSize: 11, color: "#475569" },
  commentBody: { fontSize: 13, color: "#94A3B8", lineHeight: 18 },
  addCommentCard: { backgroundColor: "#151618", marginTop: 8 },
  commentInput: { backgroundColor: "#0F0F10", borderWidth: 1, borderColor: "#2E3033", borderRadius: 8, padding: 12, color: "#F8FAFC", fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#111214", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: "#2E3033" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#F8FAFC" },
  modalScroll: { padding: 18 },
  editLabel: { fontSize: 13, color: "#94A3B8", fontWeight: "500", marginBottom: 6, marginTop: 4 },
  editInput: { backgroundColor: "#0F0F10", borderWidth: 1, borderColor: "#2E3033", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: "#F8FAFC", fontSize: 14, marginBottom: 14 },
  editTextArea: { minHeight: 100 },
  editChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  editChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "#2E3033" },
  editChipActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  editChipText: { color: "#94A3B8", fontSize: 13, fontWeight: "500" },
  editChipTextActive: { color: "#FFFFFF", fontWeight: "600" },
  modalSaveBtn: { marginVertical: 4 },
  assignItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#212225" },
  assignAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center", marginRight: 12 },
  assignAvatarText: { color: "#818CF8", fontSize: 12, fontWeight: "700" },
  assignName: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  assignEmail: { color: "#64748B", fontSize: 12, marginTop: 1 },
});
