import type { HighlightsEditor } from './homepageHighlights';

export function principalHighlightItems(editor: HighlightsEditor) {
  return editor.items.map(item => {
    const path = editor.candidates.find(vehicle => vehicle.id === item.vehicleId)?.photoPaths[0];
    return path && path !== item.photoPath ? { vehicleId: item.vehicleId, photoPath: path } : { ...item };
  });
}

export function prepareVehicleHighlight(editor: HighlightsEditor, vehicleId: string) {
  const items = principalHighlightItems(editor);
  const vehicle = editor.candidates.find((candidate) => candidate.id === vehicleId);
  if (!vehicle?.photoPaths.length)
    return {
      items,
      choosing: null,
      message:
        'Esta viatura não está disponível para destaque. Publique uma viatura elegível com fotografias.',
    };
  if (items.some((item) => item.vehicleId === vehicleId))
    return {
      items,
      choosing: vehicleId,
      message: 'A viatura já está no carrossel. Ajuste o enquadramento da fotografia principal e guarde para atualizar.',
    };
  if (items.length >= 5)
    return {
      items,
      choosing: null,
      message:
        'Esta viatura está selecionada para adicionar. O carrossel já tem cinco destaques; retire um antes de a adicionar.',
    };
  items.push({ vehicleId, photoPath: vehicle.photoPaths[0]! });
  return {
    items,
    choosing: vehicleId,
    message:
      'Viatura preparada para destaque. Ajuste o enquadramento da fotografia principal e guarde para a apresentar no carrossel.',
  };
}
