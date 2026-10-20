/** Explicit demo-only matches. Never infer a car model from a photo filename. */
export function demoPhotoKey(vehicle) {
  const key = `${vehicle.brand}|${vehicle.model}`;
  const models = {
    'Audi|Q5': 'q5', 'Audi|A3 Sportback': 'a3', 'Audi|Q3': 'q3',
    'BMW|Série 3 Touring': 'bmw', 'Peugeot|508 SW': 'peugeot',
    'Volkswagen|Golf': 'golf', 'Tesla|Model 3': 'tesla',
  };
  if (key === 'Renault|Clio') return vehicle.year === 2000 ? 'clio2' : vehicle.year === 2024 ? 'clio5' : null;
  return Object.hasOwn(models, key) ? models[key] : null;
}

/** Three explicitly reviewed replacement targets; never selects an arbitrary duplicate. */
export function distinctDemoPhotoKey(vehicle) {
  const reviewed = {
    cmpfgsa2b00f4rm90ok1pl518: ['Audi', 'Q5', 2023, 'q5_alt'],
    cmpfgrz5900c9rm90hf5pvpcp: ['BMW', 'Série 3 Touring', 2022, 'bmw_alt'],
    cmpfgrvip00bbrm9005n40q3t: ['Volkswagen', 'Golf', 2024, 'golf_alt'],
  };
  const match = reviewed[vehicle.id];
  return match && match[0] === vehicle.brand && match[1] === vehicle.model && match[2] === vehicle.year ? match[3] : null;
}

/** Old demo uploads were visually audited; preserve originals privately. */
export function correctedDemoPhotoKeys(vehicle) {
  const reviewed = {
    c4830d68165bbfd977cf81688: ['Porsche', '911', ['porsche911']],
    c4d13946284a98d75596069ae: ['Tesla', 'Model S', ['teslas']],
    c9a9894bb11334eb9079dd96f: ['BMW', 'Série 3', ['bmw320']],
    cbe031db36dee007837ed4133: ['Mercedes-Benz', 'Classe C', ['mercedes']],
    cbe325ab8a7b00694980cfbfa: ['Audi', 'A6 Avant', ['a6']],
    cmpfgs5mq00dyrm90fxofh72o: ['Dacia', 'Jogger', ['dacia', 'dacia_rear', 'dacia_side']],
  };
  const match = reviewed[vehicle.id];
  return match && match[0] === vehicle.brand && match[1] === vehicle.model ? match[2] : null;
}

export function expandedJoggerPhotoKeys(vehicle) {
  if (vehicle.id !== 'cmpfgs5mq00dyrm90fxofh72o' || vehicle.brand !== 'Dacia' || vehicle.model !== 'Jogger') return null;
  return ['dacia', 'dacia_rear', 'dacia_side', ...Array.from({ length: 9 }, (_, i) => `dacia_gallery_${String(i + 4).padStart(2, '0')}`)];
}

export function demoPhotoDescription(description, source) {
  if (!description?.startsWith('[DADOS FICTÍCIOS DE TESTE]')) throw new Error('Not explicitly marked as fictitious demo stock.');
  if (!source.illustrativeOnly || !source.author || !/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(source.sourcePage)) throw new Error('Missing verified photo attribution.');
  const licenseUrl = new URL(source.licenseUrl);
  if (licenseUrl.hostname !== 'creativecommons.org') throw new Error('Unsupported image licence.');
  return `${description}\n\nFotografia ilustrativa de demonstração: representa o modelo, não este exemplar. A cor, motorização e equipamento da imagem podem diferir dos dados fictícios.\n\nCréditos da fotografia: ${source.author} / Wikimedia Commons. ${source.license}. Fonte: ${source.sourcePage}\nLicença: ${source.licenseUrl}\nAlterações: redimensionamento e compressão. A fotografia e as suas variantes mantêm a licença indicada; não implica o apoio do autor.`;
}

export function demoPhotoGalleryDescription(description, sources) {
  const first = demoPhotoDescription(description, sources[0]);
  const extra = sources.slice(1).map((source, index) => {
    // Reuse the same provenance validation for every gallery item.
    demoPhotoDescription(description, source);
    return `Fotografia ilustrativa ${index + 2}: ${source.author} / Wikimedia Commons. ${source.license}.\nFonte: ${source.sourcePage}\nLicença: ${source.licenseUrl}`;
  });
  const result = [first, ...extra, ...(extra.length ? ['Todas as fotografias foram redimensionadas/comprimidas. Cada fotografia e os seus derivados mantêm a respetiva licença.'] : [])].join('\n\n');
  if (result.length > 6000) throw Error('Public attribution exceeds description limit.');
  return result;
}
