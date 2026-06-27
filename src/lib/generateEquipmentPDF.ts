import { Alert } from "react-native";

const BRAND_BLUE = "#0363a9";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function fmtStatus(s: string): string {
  const map: Record<string, string> = {
    active: "Ativo", inactive: "Inativo", under_maintenance: "Em Manutenção",
    calibration: "Em Calibração", retired: "Aposentado",
  };
  return map[s] ?? s;
}

function fmtPeriodicity(p: string | null | undefined): string {
  if (!p) return "—";
  const map: Record<string, string> = {
    semestral: "Semestral", anual: "Anual", bi_anual: "Bi-Anual",
    tri_anual: "Tri-Anual", outro: "Outro",
  };
  return map[p] ?? p;
}

function escape(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type CalibrationPoint = { point_value: string; criterion: string; error_tolerance: number | null };
type CalibrationRecord = { performed_at: string; performer?: { name: string }; template_doc?: { name: string } | null; notes?: string | null };
type MaintenanceRecord = { performed_at: string; description: string; cost?: number | null; notes?: string | null };
type DocRecord = { name: string; created_at: string };
type Equipment = {
  id: string;
  internal_code: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  scale?: string | null;
  status: string;
  location?: string | null;
  acquisition_date?: string | null;
  notes?: string | null;
  requires_calibration: boolean;
  calibration_periodicity?: string | null;
  last_calibration?: string | null;
  next_calibration?: string | null;
  category?: { name: string } | null;
};

function section(title: string, content: string): string {
  return `
    <div class="section-header">${title.toUpperCase()}</div>
    ${content}
  `;
}

function grid2(pairs: [string, string][]): string {
  return `<div class="grid2">${pairs.map(([label, value]) =>
    `<div class="field"><span class="label">${escape(label)}</span><span class="value">${escape(value)}</span></div>`
  ).join("")}</div>`;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return `<p class="empty">Nenhum registro</p>`;
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((row, i) =>
          `<tr class="${i % 2 === 0 ? "even" : "odd"}">${row.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`
        ).join("")}
      </tbody>
    </table>
  `;
}

export async function generateEquipmentPDF(
  equipment: Equipment,
  calPoints: CalibrationPoint[],
  calRecords: CalibrationRecord[],
  maintRecords: MaintenanceRecord[],
  docs: DocRecord[],
  companyName: string
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  .header { background: ${BRAND_BLUE}; color: white; padding: 16px 20px; text-align: center; }
  .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .header p { font-size: 12px; opacity: 0.9; }
  .content { padding: 16px 20px; }
  .section-header {
    background: ${BRAND_BLUE}; color: white; font-weight: bold; font-size: 10px;
    letter-spacing: 0.5px; padding: 6px 10px; margin: 14px 0 8px;
    border-radius: 3px;
  }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  .field { display: flex; flex-direction: column; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
  .label { font-size: 9px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
  .value { font-size: 11px; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: ${BRAND_BLUE}; color: white; font-size: 9px; font-weight: bold; padding: 6px 8px; text-align: left; }
  td { padding: 5px 8px; font-size: 10px; border-bottom: 1px solid #eee; }
  tr.even td { background: #f9f9f9; }
  tr.odd td { background: #fff; }
  .notes { margin-top: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; font-size: 10px; color: #444; }
  .empty { color: #aaa; font-style: italic; font-size: 10px; padding: 8px 0; }
  .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>FICHA DO EQUIPAMENTO</h1>
    <p>${escape(companyName) || "BSM System"}</p>
  </div>
  <div class="content">
    ${section("Identificação", grid2([
      ["Código Interno", equipment.internal_code],
      ["Nome", equipment.name],
      ["Marca", equipment.brand ?? "—"],
      ["Modelo", equipment.model ?? "—"],
      ["Nº de Série", equipment.serial_number ?? "—"],
      ["Escala", equipment.scale ?? "—"],
      ["Categoria", equipment.category?.name ?? "—"],
      ["Localização", equipment.location ?? "—"],
      ["Data de Aquisição", fmtDate(equipment.acquisition_date)],
      ["Status", fmtStatus(equipment.status)],
    ]) + (equipment.notes ? `<div class="notes"><strong>Observações:</strong> ${escape(equipment.notes)}</div>` : ""))}

    ${section("Calibração", grid2([
      ["Requer Calibração", equipment.requires_calibration ? "Sim" : "Não"],
      ["Periodicidade", fmtPeriodicity(equipment.calibration_periodicity)],
      ["Última Calibração", fmtDate(equipment.last_calibration)],
      ["Próxima Calibração", fmtDate(equipment.next_calibration)],
    ]))}

    ${calPoints.length > 0 ? section("Pontos de Calibração", table(
      ["Ponto", "Critério", "Tolerância de Erro"],
      calPoints.map((p) => [p.point_value, p.criterion, p.error_tolerance != null ? String(p.error_tolerance) : "—"])
    )) : ""}

    ${calRecords.length > 0 ? section("Histórico de Calibrações", table(
      ["Data", "Realizado por", "Planilha", "Observações"],
      calRecords.map((r) => [fmtDate(r.performed_at), r.performer?.name ?? "—", r.template_doc?.name ?? "—", r.notes ?? "—"])
    )) : ""}

    ${maintRecords.length > 0 ? section("Histórico de Manutenção", table(
      ["Data", "Descrição", "Custo (R$)", "Observações"],
      maintRecords.map((r) => [fmtDate(r.performed_at), r.description, r.cost != null ? r.cost.toFixed(2) : "—", r.notes ?? "—"])
    )) : ""}

    ${docs.length > 0 ? section("Documentos Vinculados", table(
      ["Nome do Documento", "Data de Criação"],
      docs.map((d) => [d.name, fmtDate(d.created_at)])
    )) : ""}

    <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} · BSM System</div>
  </div>
</body>
</html>`;

  try {
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Exportar Ficha do Equipamento",
        UTI: "com.adobe.pdf",
      });
    }
  } catch {
    Alert.alert("PDF não disponível", "Esta versão do aplicativo não suporta exportação de PDF. Atualize o aplicativo para usar este recurso.");
  }
}
