import audi from './assets/images/brands/audi.svg?url&no-inline';
import bmw from './assets/images/brands/bmw.svg?url&no-inline';
import dacia from './assets/images/brands/dacia.svg?url&no-inline';
import peugeot from './assets/images/brands/peugeot.svg?url&no-inline';
import renault from './assets/images/brands/renault.svg?url&no-inline';
import tesla from './assets/images/brands/tesla.svg?url&no-inline';
import volkswagen from './assets/images/brands/volkswagen.svg?url&no-inline';
import porsche from './assets/images/brands/porsche.svg?url&no-inline';
import mercedes from './assets/images/brands/mercedes.svg?url&no-inline';
import citroen from './assets/images/brands/citroen.svg?url&no-inline';
import fiat from './assets/images/brands/fiat.svg?url&no-inline';
import kia from './assets/images/brands/kia.svg?url&no-inline';
import opel from './assets/images/brands/opel.svg?url&no-inline';
import toyota from './assets/images/brands/toyota.svg?url&no-inline';

/** Verified local assets only. Unknown labels must never be guessed or corrected. */
const logos: Record<string, string> = {
  audi,
  bmw,
  dacia,
  peugeot,
  renault,
  tesla,
  volkswagen,
  porsche,
  citroen,
  citroën: citroen,
  fiat,
  kia,
  opel,
  toyota,
  mercedes,
  'mercedes-benz': mercedes,
  'mercedes benz': mercedes,
  vw: volkswagen,
};

export function brandLogo(name: string): string | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.hasOwn(logos, key) ? logos[key] : undefined;
}
