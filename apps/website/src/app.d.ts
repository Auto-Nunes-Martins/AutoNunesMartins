declare global {
  namespace App { interface Error { message: string; archive?: import('$lib/publicArchive').PublicArchive } }
}
export {};
