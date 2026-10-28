export type HighlightStatus = 'live' | 'hidden' | 'none' | 'unknown';
export function homepageHighlightStatus(selection: { configuredVehicleIds?: string[]; items: { id: string }[] }, vehicleId: string): HighlightStatus {
  if (selection.items.some(item => item.id === vehicleId)) return 'live';
  return selection.configuredVehicleIds?.includes(vehicleId) ? 'hidden' : 'none';
}
