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

export interface Branch {
  id: number;
  name: string;
  fridges: { id: number; name: string }[];
}

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

/** Build a query string from the params that have a value. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** Get one page of readings; the temperature range is in `unit`, dates cover whole days. */
export function listReadings(filters: ReadingFilters, unit: Metric, offset: number): Promise<Page<Reading>> {
  const q = query({
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

/** Correct a reading's time ("YYYY-MM-DDTHH:MM") or temperature (its own unit, or "ERR"). */
export function updateReading(id: number, changes: { time?: string; temp?: string }): Promise<Reading> {
  return apiRequest<Reading>(`/readings/${id}`, { method: "PATCH", body: changes });
}

/** Delete a reading; the backend archives it with its alerts. */
export function deleteReading(id: number): Promise<void> {
  return apiRequest<void>(`/readings/${id}`, { method: "DELETE" });
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
