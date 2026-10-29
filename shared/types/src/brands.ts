import { z } from 'zod';
import catalog from './brands.json';
export const vehicleBrands = catalog;
export function brandSearchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
export function registeredBrand(value: string) {
  const key = brandSearchKey(value);
  return vehicleBrands.find((brand) =>
    [brand.name, ...brand.aliases].some((name) => brandSearchKey(name) === key),
  );
}
export const registeredBrandSchema = z
  .string()
  .trim()
  .max(60)
  .transform((value, ctx) => {
    const brand = registeredBrand(value);
    if (brand) return brand.name;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione uma marca registada na lista.',
    });
    return z.NEVER;
  });

/** Search may suggest similar labels; only an explicit selection supplies a saved value. */
export function searchVehicleBrands(query: string) {
  const key = brandSearchKey(query);
  const distance = (a: string, b: string) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(
          next[j - 1]! + 1,
          row[j]! + 1,
          row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      row = next;
    }
    return row[b.length]!;
  };
  return vehicleBrands.filter((brand) =>
    [brand.name, ...brand.aliases].some((label) => {
      const normalized = brandSearchKey(label);
      return (
        normalized.includes(key) ||
        (key.length >= 4 &&
          Math.abs(normalized.length - key.length) <= 1 &&
          distance(normalized, key) <= 1)
      );
    }),
  );
}
