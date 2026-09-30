import type { FieldError } from "./api";
import type { ProfileValues } from "./endpoints";

export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;

// Model-level 422 from the backend: "<non-urgent key> must be lower than <urgent key>"
const PAIR_ERROR = /^(\w+) must be lower than \w+$/;

/** Map the backend's 422 field errors to the profile form fields. */
export function profileErrors(errors: FieldError[]): ProfileErrors {
  const result: ProfileErrors = {};
  for (const { field, message } of errors) {
    const pair = field === "body" ? PAIR_ERROR.exec(message) : null;
    if (pair) result[pair[1] as keyof ProfileValues] = "Must be lower than urgent";
    else result[field as keyof ProfileValues] = message;
  }
  return result;
}
