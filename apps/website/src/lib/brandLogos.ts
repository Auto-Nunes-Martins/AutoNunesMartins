import audi from './assets/images/brands/audi.svg?url&no-inline';
import bmw from './assets/images/brands/bmw.svg?url&no-inline';
import dacia from './assets/images/brands/dacia.svg?url&no-inline';
import peugeot from './assets/images/brands/peugeot.svg?url&no-inline';
import renault from './assets/images/brands/renault.svg?url&no-inline';
import tesla from './assets/images/brands/tesla.svg?url&no-inline';
import volkswagen from './assets/images/brands/volkswagen.svg?url&no-inline';

/** Verified local assets only. Unknown labels must never be guessed or corrected. */
const logos: Record<string, string> = {
  audi, bmw, dacia, peugeot, renault, tesla, volkswagen,
};

export function brandLogo(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return Object.hasOwn(logos, key) ? logos[key] : undefined;
}
