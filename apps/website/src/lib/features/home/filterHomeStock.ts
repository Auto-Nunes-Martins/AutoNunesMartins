import { promotionSaving, type PublicCard } from '$lib/publicVehicles';

export function filterHomeStock(
  homeCars: PublicCard[],
  homeBrand: string,
  homeYear: string,
  homeOrder: string,
) {
  const matches = homeCars.filter(
    (car) => (!homeBrand || car.brand === homeBrand) && (!homeYear || car.year >= Number(homeYear)),
  );
  matches.sort((a, b) =>
    homeOrder === 'desconto_desc'
      ? (b.promotion ? promotionSaving(b.promotion.referencePrice, b.price) : 0) -
        (a.promotion ? promotionSaving(a.promotion.referencePrice, a.price) : 0)
      : homeOrder === 'preco_asc'
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : homeOrder === 'preco_desc'
          ? (b.price ?? -Infinity) - (a.price ?? -Infinity)
          : homeOrder === 'ano'
            ? b.year - a.year
            : homeOrder === 'km'
              ? a.km === b.km
                ? 0
                : a.km === null
                  ? 1
                  : b.km === null
                    ? -1
                    : a.km - b.km
              : 0,
  );
  return matches.slice(0, 5);
}
