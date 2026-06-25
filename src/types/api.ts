export type UserRole = "super_admin" | "admin" | "employee";

export type Permission =
  | "equipment:read"
  | "equipment:create"
  | "equipment:update"
  | "equipment:delete"
  | "ticket:read"
  | "ticket:create"
  | "ticket:update"
  | "ticket:delete"
  | "ticket:assign"
  | "document:read"
  | "document:upload"
  | "document:update"
  | "document:delete"
  | "user:read"
  | "user:invite"
  | "user:update"
  | "user:delete"
  | "company:read"
  | "company:update"
  | "company:settings"
  | "report:view"
  | "calibration:read"
  | "calibration:manage"
  | "calibration:register";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company_id: string | null;
  avatar_url: string | null;
  permissions: Permission[];
  impersonating?: string | null;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

export interface LoginResponse {
  ok: boolean;
  data: {
    user: AuthUser;
    session: AuthSession;
  };
}

export interface RefreshResponse {
  ok: boolean;
  data: {
    user: AuthUser;
    session: AuthSession;
  };
}

export interface MeResponse {
  data: {
    user: AuthUser;
  };
}

export type EquipmentStatus =
  | "active"
  | "inactive"
  | "under_maintenance"
  | "calibration"
  | "retired";

export interface EquipmentCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export type CalibrationPeriodicity =
  | "semestral"
  | "anual"
  | "bi_anual"
  | "tri_anual"
  | "outro";

export interface Equipment {
  id: string;
  company_id: string;
  category_id: string | null;
  internal_code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: EquipmentStatus;
  location: string | null;
  acquisition_date: string | null;
  last_calibration: string | null;
  next_calibration: string | null;
  notes: string | null;
  qr_code_token: string;
  image_url: string | null;
  requires_calibration: boolean;
  calibration_periodicity: CalibrationPeriodicity | null;
  created_at: string;
  updated_at: string;
  category?: EquipmentCategory;
}

export interface EquipmentHistory {
  id: string;
  equipment_id: string;
  user_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: { name: string };
}

export interface CreateEquipmentDTO {
  category_id?: string | null;
  internal_code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status?: EquipmentStatus;
  location?: string | null;
  acquisition_date?: string | null;
  last_calibration?: string | null;
  next_calibration?: string | null;
  notes?: string | null;
  image_url?: string | null;
  requires_calibration?: boolean;
  calibration_periodicity?: CalibrationPeriodicity | null;
  company_id?: string;
  category_name?: string | null;
}

export interface UpdateEquipmentDTO extends Partial<CreateEquipmentDTO> {}

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "medium" | "high" | "critical";

export interface Ticket {
  id: string;
  company_id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  equipment_id: string | null;
  photo_url: string | null;
  is_support_request: boolean;
  created_by: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  equipment?: { id: string; name: string; internal_code: string };
  creator?: { name: string };
  assignee?: { name: string; avatar_url: string | null };
  _count?: { comments: number };
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  user?: { name: string; avatar_url: string | null };
}

export interface CreateTicketDTO {
  title: string;
  description: string;
  priority?: TicketPriority;
  type?: "maintenance" | "calibration" | "repair" | "inspection" | "other";
  equipment_id?: string | null;
  assigned_to?: string | null;
  photo_url?: string | null;
  is_support_request?: boolean;
  company_id?: string;
}

export interface UpdateTicketDTO {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  equipment_id?: string | null;
  assigned_to?: string | null;
  photo_url?: string | null;
}

export interface CreateCommentDTO {
  body: string;
}

export interface DocumentCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  storage_path: string;
  mime_type: string;
  file_size: number;
  version: number;
  equipment_id: string | null;
  uploaded_by: string;
  visible_to_employees: boolean;
  created_at: string;
  updated_at: string;
  category?: DocumentCategory;
  uploader?: { name: string };
  equipment?: { name: string; internal_code: string };
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  storage_path: string;
  file_size: number;
  uploaded_by: string;
  notes: string | null;
  created_at: string;
  uploader?: { name: string };
}

export interface UploadDocumentDTO {
  name: string;
  description?: string | null;
  category_id?: string | null;
  equipment_id?: string | null;
}

export interface UpdateDocumentDTO {
  name?: string;
  description?: string | null;
  category_id?: string | null;
  equipment_id?: string | null;
  visible_to_employees?: boolean;
}

export type NotificationType =
  | "ticket_created"
  | "ticket_status_changed"
  | "ticket_assigned"
  | "ticket_support_request"
  | "equipment_created"
  | "calibration_due";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationDTO {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface CalibrationDocument {
  id: string;
  name: string;
  description: string | null;
  storage_path: string;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: { name: string };
  versions?: CalibrationDocumentVersion[];
}

export interface CalibrationDocumentVersion {
  id: string;
  document_id: string;
  version: number;
  storage_path: string;
  file_size: number;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
  uploader?: { name: string };
}

export interface CalibrationPoint {
  id: string;
  equipment_id: string;
  point_value: string;
  criterion: string;
  error_tolerance: number | null;
  sort_order: number;
  created_at: string;
}

export interface CalibrationRecord {
  id: string;
  equipment_id: string;
  company_id: string;
  performed_by: string;
  template_doc_id: string | null;
  child_storage_path: string | null;
  certificate_storage_path: string | null;
  performed_at: string;
  notes: string | null;
  created_at: string;
  performer?: { name: string };
  template_doc?: { name: string } | null;
}

export interface CreateCalibrationDocumentDTO {
  name: string;
  description?: string | null;
}

export interface CreateCalibrationPointDTO {
  point_value: string;
  criterion: string;
  error_tolerance?: number | null;
  sort_order?: number;
}

export interface CreateCalibrationRecordDTO {
  template_doc_id?: string | null;
  performed_at?: string;
  notes?: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedList<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiErrorPayload {
  error: string;
  code?: string;
  details?: unknown;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}
