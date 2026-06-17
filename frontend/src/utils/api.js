/** Parses a failed API response into a field-error map.
 * Returns { fieldName: message } for validation errors, { _general: message } otherwise. */
export async function parseApiError(res) {
  const data = await res.json().catch(() => ({}))
  if (data.errors) return data.errors
  return { _general: data.message ?? data.error ?? `Error ${res.status}` }
}
