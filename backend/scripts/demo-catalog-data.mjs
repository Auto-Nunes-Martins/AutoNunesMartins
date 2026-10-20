// Explicit fictional examples approved for this test dataset. No inference from model strings.
const definitions = [
  ['Porsche', '911 Carrera', 'Porsche', '911', 'Carrera 3.0 PDK', 'GASOLINE', 'AUTOMATIC', 385, 2981, 2, 4, 'Desportivo', 112900],
  ['Tesla', 'Model S', 'Tesla', 'Model S', 'Dual Motor', 'ELECTRIC', 'AUTOMATIC', 670, null, 5, 5, 'Berlina', 62900],
  ['BMW', 'Série 3', 'BMW', 'Série 3', '320d Touring Steptronic', 'DIESEL', 'AUTOMATIC', 190, 1995, 5, 5, 'Carrinha', 38900],
  ['Mercedes-Benz', 'Classe C', 'Mercedes-Benz', 'Classe C', '220 d 9G-TRONIC', 'DIESEL', 'AUTOMATIC', 200, 1993, 4, 5, 'Berlina', 42900],
  ['Audi', 'A6 Avant', 'Audi', 'A6 Avant', '40 TDI S tronic', 'DIESEL', 'AUTOMATIC', 204, 1968, 5, 5, 'Carrinha', 49900],
  ['Opel', 'Mokka-e', 'Opel', 'Mokka', 'e Edition 50 kWh', 'ELECTRIC', 'AUTOMATIC', 136, null, 5, 5, 'SUV', 24900],
  ['Peugeot', '208 GT', 'Peugeot', '208', '1.2 PureTech GT EAT8', 'GASOLINE', 'AUTOMATIC', 130, 1199, 5, 5, 'Utilitário', 18900],
  ['Peugeot', '3008 GT BlueHDi', 'Peugeot', '3008', '1.5 BlueHDi GT EAT8', 'DIESEL', 'AUTOMATIC', 130, 1499, 5, 5, 'SUV', 27900],
  ['Renault', 'Captur Hybrid', 'Renault', 'Captur', 'E-Tech full hybrid 145', 'HYBRID', 'AUTOMATIC', 145, 1598, 5, 5, 'SUV', 25900],
  ['Fiat', '500e', 'Fiat', '500', 'e Icon 42 kWh', 'ELECTRIC', 'AUTOMATIC', 118, null, 3, 4, 'Citadino', 19900],
  ['Citroën', 'C3 Aircross', 'Citroën', 'C3 Aircross', '1.2 PureTech Feel', 'GASOLINE', 'MANUAL', 110, 1199, 5, 5, 'SUV', 19900],
  ['Audi', 'Q5 50 TFSI e quattro', 'Audi', 'Q5', '50 TFSI e quattro', 'PLUGIN_HYBRID', 'AUTOMATIC', 299, 1984, 5, 5, 'SUV', 49900],
  ['Kia', 'Ceed SW', 'Kia', 'Ceed SW', '1.6 CRDi Drive', 'DIESEL', 'MANUAL', 136, 1598, 5, 5, 'Carrinha', 22900],
  ['Tesla', 'Model 3 Long Range', 'Tesla', 'Model 3', 'Long Range AWD', 'ELECTRIC', 'AUTOMATIC', 366, null, 4, 5, 'Berlina', 39900],
  ['BMW', 'M340i xDrive Touring', 'BMW', 'Série 3 Touring', 'M340i xDrive Steptronic', 'GASOLINE', 'AUTOMATIC', 374, 2998, 5, 5, 'Carrinha', 64900],
  ['Tesla', 'Model Y', 'Tesla', 'Model Y', 'Long Range AWD', 'ELECTRIC', 'AUTOMATIC', 351, null, 5, 5, 'SUV', 42900],
  ['Audi', 'A3 Sportback 30 TFSI', 'Audi', 'A3 Sportback', '30 TFSI', 'GASOLINE', 'MANUAL', 110, 999, 5, 5, 'Compacto', 28900],
  ['Audi', 'Q3 35 TDI quattro', 'Audi', 'Q3', '35 TDI quattro S tronic', 'DIESEL', 'AUTOMATIC', 150, 1968, 5, 5, 'SUV', 37900],
  ['Dacia', 'Duster', 'Dacia', 'Duster', '1.5 Blue dCi Prestige', 'DIESEL', 'MANUAL', 115, 1461, 5, 5, 'SUV', 19900],
  ['Opel', 'Corsa Edition', 'Opel', 'Corsa', '1.2 Edition', 'GASOLINE', 'MANUAL', 75, 1199, 5, 5, 'Utilitário', 14900],
  ['Peugeot', '508 SW', 'Peugeot', '508 SW', '1.5 BlueHDi Allure EAT8', 'DIESEL', 'AUTOMATIC', 130, 1499, 5, 5, 'Carrinha', 27900],
  ['Volkswagen', 'Golf 1.5 eTSI', 'Volkswagen', 'Golf', '1.5 eTSI Life DSG', 'HYBRID', 'AUTOMATIC', 150, 1498, 5, 5, 'Compacto', 24900],
  ['Dacia', 'Jogger Extreme', 'Dacia', 'Jogger', '1.0 TCe Extreme', 'GASOLINE', 'MANUAL', 110, 999, 5, 7, 'Familiar', 17900],
  ['Renault', 'Clio TCe', 'Renault', 'Clio', '1.0 TCe Evolution', 'GASOLINE', 'MANUAL', 90, 999, 5, 5, 'Utilitário', 15900],
  ['Mercedes-Benz', 'GLA 200', 'Mercedes-Benz', 'GLA', '200 7G-DCT', 'GASOLINE', 'AUTOMATIC', 163, 1332, 5, 5, 'SUV', 31900],
  ['Volkswagen', 'ID.3 Pro', 'Volkswagen', 'ID.3', 'Pro 58 kWh', 'ELECTRIC', 'AUTOMATIC', 204, null, 5, 5, 'Compacto', 24900],
  ['renot', 'clicli', 'Renault', 'Clio', '1.2 Alizé', 'GASOLINE', 'MANUAL', 58, 1149, 5, 5, 'Utilitário', 3900],
  ['Krara', '7g', 'Toyota', 'Yaris', '1.0 Sol', 'GASOLINE', 'MANUAL', 68, 998, 5, 5, 'Utilitário', 4900],
];
export const demoMarker = '[DADOS FICTÍCIOS DE TESTE]';
export const mutableFields = ['brand', 'model', 'publicPrice', 'publicDescription', 'publicTransmission', 'publicSpecifications'];
const key = value => String(value).trim().toLocaleLowerCase('pt-PT');
const colors = ['Cinza', 'Branco', 'Preto', 'Azul'];
export function catalogState(row) {
  return Object.fromEntries(mutableFields.map(field => [field,
    field === 'publicPrice' && row[field] != null ? Number(row[field]).toFixed(2) : row[field] ?? null,
  ]));
}
export const stable = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
export function planDemoVehicle(row) {
  const previous = row.publicSpecifications ?? {};
  const entry = definitions.find(d => (key(row.brand) === key(d[0]) && row.model === d[1])
    || (row.brand === d[2] && row.model === d[3] && previous.version === d[4]));
  if (!entry) throw new Error(`No explicit demo mapping for ${row.brand} ${row.model}; nothing should be applied.`);
  const [, , brand, model, version, fuel, transmission, powerHp, engineCc, doors, seats, category, fallbackPrice] = entry;
  if (row.fuel !== fuel || !Number.isInteger(row.year) || row.year < 1990 || row.year > 2026 || !Number.isInteger(row.mileage) || row.mileage < 0)
    throw new Error(`Unexpected base data for ${brand} ${model}; inspect manually.`);
  const isClassic = row.year < 2010;
  const idSeed = [...String(row.id)].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const specifications = {
    ...previous, version, powerHp, engineCc, doors, seats, category,
    color: previous.color?.trim() || colors[idSeed % colors.length],
    equipment: previous.equipment?.length ? previous.equipment : isClassic
      ? ['Vidros elétricos dianteiros', 'Fecho centralizado']
      : ['Ar condicionado', 'Bluetooth', 'Sensores de estacionamento'],
  };
  const price = row.publicPrice != null && Number(row.publicPrice) > 0 ? Number(row.publicPrice) : fallbackPrice;
  return {
    brand, model, publicPrice: price.toFixed(2), publicTransmission: transmission,
    publicSpecifications: specifications,
    publicDescription: `${demoMarker} ${brand} ${model} ${version}, de ${row.year}, com ${new Intl.NumberFormat('pt-PT').format(row.mileage)} km e caixa ${transmission === 'AUTOMATIC' ? 'automática' : 'manual'}. Exemplo fictício para testar o website e o CRM; características, equipamento e preço não representam uma oferta comercial.`,
  };
}
