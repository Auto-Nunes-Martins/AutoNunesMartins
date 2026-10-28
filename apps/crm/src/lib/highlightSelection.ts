import type { HighlightsEditor } from './homepageHighlights';

export function prepareVehicleHighlight(editor: HighlightsEditor, vehicleId: string) {
  const items = editor.items.map(item => ({ ...item }));
  const vehicle = editor.candidates.find(candidate => candidate.id === vehicleId);
  if (!vehicle?.photos.length) return { items, choosing: null, message: 'Esta viatura não está disponível para destaque. Publique uma viatura elegível com fotografias.' };
  if (items.some(item => item.vehicleId === vehicleId)) return { items, choosing: vehicleId, message: 'A viatura já está no carrossel. Escolha a fotografia e guarde para atualizar.' };
  if (items.length >= 5) return { items, choosing: null, message: 'Esta viatura está selecionada para adicionar. O carrossel já tem cinco destaques; retire um antes de a adicionar.' };
  items.push({ vehicleId, photoPath: vehicle.photos[0]!.path });
  return { items, choosing: vehicleId, message: 'Viatura preparada para destaque. Escolha a fotografia e guarde para a apresentar no carrossel.' };
}
