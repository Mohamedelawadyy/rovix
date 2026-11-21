/** Route param → positive integer id, or null (render 404 without calling the API). */
export function parseVehicleId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
