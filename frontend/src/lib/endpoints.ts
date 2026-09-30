import { apiRequest } from "./api";
import type { Metric } from "./units";

export type AlertLevel = "URGENT" | "NON_URGENT";

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface Reading {
  id: number;
  time: string;
  temp: number | null;
  metric: Metric;
  status: "OK" | "ERR";
  logger_id: string;
  fridge: string;
  branch: string;
  city: string | null;
  archived_at?: string | null;
}

export interface Alert {
  id: number;
  level: AlertLevel;
  description: string;
  reading_id: number;
  time: string;
  temp: number | null;
  metric: Metric;
  logger_id: string;
  fridge: string;
  branch: string;
  city: string | null;
  archived_at?: string | null;
}

export interface Fridge {
  id: number;
  name: string;
  metric: Metric;
  logger_id: string | null;
  threshold_settings_id: number;
  avg_temp: number | null;
  last_measured: string | null;
}

export interface Branch {
  id: number;
  name: string;
  city: string | null;
  street: string | null;
  building_number: string | null;
  fridges: Fridge[];
}

export type BranchChanges = Partial<Pick<Branch, "name" | "city" | "street" | "building_number">>;

export type FridgeChanges = Partial<{ name: string; metric: Metric; logger_id: string; threshold_settings_id: number }>;

export const THRESHOLD_KEYS = [
  "growth_non_urgent",
  "growth_urgent",
  "deviation_non_urgent",
  "deviation_urgent",
  "gap_non_urgent_minutes",
  "gap_urgent_minutes",
] as const;
export type ThresholdKey = (typeof THRESHOLD_KEYS)[number];

/** Named threshold settings shared by fridges; °C for growth/deviation, minutes for gaps. */
export type ThresholdSettings = { id: number; name: string; fridges: number } & Record<ThresholdKey, number>;

/** Threshold settings as typed in the form; the backend parses and validates them. */
export type ThresholdSettingsValues = { name: string } & Record<ThresholdKey, string>;

/** Reading filters as typed in the form; dates are "YYYY-MM-DD", temperatures are text. */
export interface ReadingFilters {
  branch?: string | undefined;
  fridge?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  tempMin?: string | undefined;
  tempMax?: string | undefined;
}

export interface AlertQuery {
  archived: boolean;
  level?: AlertLevel | "" | undefined;
  offset?: number | undefined;
  branch?: string | undefined;
  fridge?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  limit?: number | undefined;
}

export interface RowError {
  row?: number | null;
  field: string;
  value?: unknown;
  message: string;
}

export interface UnknownEntries {
  branches: { name: string; suggestion?: string | null }[];
  loggers: { logger: string; branch: string; fridge: string }[];
}

/** Entries the user confirmed adding, sent back as the "register" block. */
export interface Registration {
  branches: { name: string; city: string; street?: string; building_number?: string }[];
  fridges: { logger_id: string; branch: string; fridge: string; metric: Metric }[];
}

export interface SaveResult {
  inserted: number;
  duplicates: number;
  err_rows: number;
  rejected: number;
  renamed_fridges: string[];
  alerts: number;
  errors: RowError[];
  fridge_name_mismatches: { row: number; logger: string; name_in_file: string; fridge: string }[];
  unknown?: UnknownEntries;
}

/** Build a query string from the params that have a value. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Get one page of readings, or deleted ones with archived; the temperature range is in `unit`, dates cover whole days. */
export function listReadings(
  filters: ReadingFilters,
  unit: Metric,
  offset: number,
  archived = false,
): Promise<Page<Reading>> {
  const q = query({
    archived: archived ? "true" : undefined,
    branch: filters.branch,
    fridge: filters.fridge,
    date_from: filters.dateFrom && `${filters.dateFrom}T00:00:00`,
    date_to: filters.dateTo && `${filters.dateTo}T23:59:59`,
    temp_min: filters.tempMin,
    temp_max: filters.tempMax,
    unit,
    offset,
  });
  return apiRequest<Page<Reading>>(`/readings${q}`);
}

/** Get one page of active alerts, or archived ones (deleted readings) with archived=true. */
export function listAlerts(params: AlertQuery): Promise<Page<Alert>> {
  const q = query({
    branch: params.branch,
    fridge: params.fridge,
    date_from: params.dateFrom,
    date_to: params.dateTo,
    level: params.level,
    archived: params.archived ? "true" : undefined,
    offset: params.offset,
    limit: params.limit,
  });
  return apiRequest<Page<Alert>>(`/alerts${q}`);
}

/** Get the branches with their fridges, for the filter options. */
export function listBranches(): Promise<Branch[]> {
  return apiRequest<Branch[]>("/branches");
}

/** Reading corrections: time is "YYYY-MM-DDTHH:MM", temp is in the fridge's unit (or "ERR"), logger_id moves the reading. */
export type ReadingChanges = Partial<{ time: string; temp: string; logger_id: string }>;

/** Correct a reading; send only the changed fields. */
export function updateReading(id: number, changes: ReadingChanges): Promise<Reading> {
  return apiRequest<Reading>(`/readings/${id}`, { method: "PATCH", body: changes });
}

/** A reading typed in the app; time is "YYYY-MM-DDTHH:MM", temp is text (a number or "ERR"). */
export interface NewReading {
  logger: string;
  branch: string;
  fridge: string;
  time: string;
  temp: string;
}

/** Add one reading; a rejected one throws an ApiError whose body is the SaveResult. */
export function addReading(record: NewReading, register?: Registration): Promise<SaveResult> {
  return apiRequest<SaveResult>("/readings", { method: "POST", body: register ? { ...record, register } : record });
}

/** Upload an .xlsx file;`register` adds the confirmed unknown branches and loggers first. */
export function uploadReadings(file: File, register?: Registration): Promise<SaveResult> {
  const form = new FormData();
  form.append("file", file);
  if (register) form.append("register", JSON.stringify(register));
  return apiRequest<SaveResult>("/readings/upload", { method: "POST", body: form });
}

/** Delete a reading; the backend archives it with its alerts. */
export function deleteReading(id: number): Promise<void> {
  return apiRequest<void>(`/readings/${id}`, { method: "DELETE" });
}

/** Move an archived reading back to its logger; the backend re-runs the alert rules on it. */
export function restoreReading(id: number): Promise<Reading> {
  return apiRequest<Reading>(`/readings/archive/${id}/restore`, { method: "POST" });
}

/** Edit a branch; send only the changed fields. */
export function updateBranch(id: number, changes: BranchChanges): Promise<Branch> {
  return apiRequest<Branch>(`/branches/${id}`, { method: "PATCH", body: changes });
}

/** Edit a fridge; send only the changed fields. A new logger id keeps the fridge's readings. */
export function updateFridge(id: number, changes: FridgeChanges): Promise<Fridge> {
  return apiRequest<Fridge>(`/fridges/${id}`, { method: "PATCH", body: changes });
}

/** Counts a delete would remove (fridges, loggers) or archive (readings, alerts). */
export interface DeleteImpact {
  fridges: number;
  loggers: number;
  readings: number;
  alerts: number;
}

/** Get what deleting a branch or a fridge would remove and archive; deletes nothing. */
export function deleteImpact(kind: "branches" | "fridges", id: number): Promise<DeleteImpact> {
  return apiRequest<DeleteImpact>(`/${kind}/${id}/delete-impact`);
}

/** Delete a branch with its fridges and loggers; the backend archives their readings and alerts. */
export function deleteBranch(id: number): Promise<void> {
  return apiRequest<void>(`/branches/${id}`, { method: "DELETE" });
}

/** Delete a fridge with its logger; the backend archives its readings and alerts. */
export function deleteFridge(id: number): Promise<void> {
  return apiRequest<void>(`/fridges/${id}`, { method: "DELETE" });
}

/** Get all threshold settings, ordered by name, with their fridge counts. */
export function listThresholdSettings(): Promise<ThresholdSettings[]> {
  return apiRequest<ThresholdSettings[]>("/threshold-settings");
}

/** Create named threshold settings. */
export function createThresholdSettings(values: ThresholdSettingsValues): Promise<ThresholdSettings> {
  return apiRequest<ThresholdSettings>("/threshold-settings", { method: "POST", body: values });
}

/** Replace the name and values; it changes alerts for every fridge using these settings. */
export function updateThresholdSettings(id: number, values: ThresholdSettingsValues): Promise<ThresholdSettings> {
  return apiRequest<ThresholdSettings>(`/threshold-settings/${id}`, { method: "PUT", body: values });
}

/** Delete threshold settings; the backend refuses (409) while fridges use them. */
export function deleteThresholdSettings(id: number): Promise<void> {
  return apiRequest<void>(`/threshold-settings/${id}`, { method: "DELETE" });
}
