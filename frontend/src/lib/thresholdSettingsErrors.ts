import type { FieldError } from "./api";
import type { ThresholdSettingsValues } from "./endpoints";

export type ThresholdSettingsErrors = Partial<Record<keyof ThresholdSettingsValues, string>>;

// Model-level 422 from the backend: "<non-urgent key> must be lower than <urgent key>"
const PAIR_ERROR = /^(\w+) must be lower than \w+$/;

/** Map the backend's 422 field errors to the threshold settings form fields. */
export function thresholdSettingsErrors(errors: FieldError[]): ThresholdSettingsErrors {
  const result: ThresholdSettingsErrors = {};
  for (const { field, message } of errors) {
    const pair = field === "body" ? PAIR_ERROR.exec(message) : null;
    if (pair) result[pair[1] as keyof ThresholdSettingsValues] = "Must be lower than urgent";
    else result[field as keyof ThresholdSettingsValues] = message;
  }
  return result;
}
