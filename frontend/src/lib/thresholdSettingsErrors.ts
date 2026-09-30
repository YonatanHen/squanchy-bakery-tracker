import type { FieldError } from "./api";
import type { ThresholdSettingsValues } from "./endpoints";

export type ThresholdSettingsErrors = Partial<Record<keyof ThresholdSettingsValues, string>>;

/** Map the backend's field errors (422, or 409 for a duplicate name) to the form fields. */
export function thresholdSettingsErrors(errors: FieldError[]): ThresholdSettingsErrors {
  const result: ThresholdSettingsErrors = {};
  for (const { field, message } of errors) result[field as keyof ThresholdSettingsValues] = message;
  return result;
}
