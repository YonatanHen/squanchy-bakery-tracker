import { ApiError } from "./api";

export interface SaveErrors {
  fields: Partial<Record<string, string>>;
  message: string;
}

/** Split a failed save into 422 messages per field, or one message for the whole form. */
export function saveErrors(err: unknown): SaveErrors {
  if (!(err instanceof ApiError)) return { fields: {}, message: "Could not save. Try again." };
  const fields = Object.fromEntries(err.fieldErrors.map((e) => [e.field, e.message]));
  return { fields, message: err.fieldErrors.length > 0 ? "" : err.message };
}
