import type { WhatsAppContact } from '$lib/whatsappContact';

export type StandContact = {
  isDemo: boolean;
  name: string;
  description: string;
  address: string | null;
  additionalAddress?: string;
  phone: { display: string; international: string } | null;
  additionalPhone?: { display: string; international: string };
  whatsapp: WhatsAppContact | null;
  email: string | null;
  directionsUrl: string | null;
  mapEmbedUrl?: string;
  hours: { days: string; time: string }[];
  socialLinks: { label: string; href: string }[];
};

// Contact data explicitly confirmed by the owner on 25 October 2026.
// First street and door number corrected by the owner on 1 November 2026.
// The owner also confirmed the principal number for WhatsApp.
export const standContact: StandContact = {
  isDemo: false,
  name: 'Auto Nunes Martins',
  description: 'Comércio de automóveis',
  address: 'Rua Dr. Hermano 1\n6000-215 Castelo Branco',
  additionalAddress: 'Estrada de Montalvão\n6000-050 Castelo Branco',
  phone: { display: '+351 964 243 323', international: '+351964243323' },
  additionalPhone: { display: '+351 968 392 633', international: '+351968392633' },
  whatsapp: { international: '+351964243323', confirmed: true, demo: false },
  email: 'geral@autonunesmartins.pt',
  directionsUrl:
    'https://www.google.com/maps/place/Auto+Nunes+Martins/@39.8223185,-7.488708,17z/data=!3m1!4b1!4m6!3m5!1s0xd3d5d8be8ad6dbf:0xf6a7979487716ed3!8m2!3d39.8223144!4d-7.4861331!16s%2Fg%2F11ff1zhxc9?entry=ttu&g_ep=EgoyMDI2MTAyOC4wIKXMDSoASAFQAw%3D%3D',
  mapEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d766.0791874391547!2d-7.486776830312595!3d39.82231542823567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd3d5d8be8ad6dbf%3A0xf6a7979487716ed3!2sAuto%20Nunes%20Martins!5e0!3m2!1spt-PT!2spt!4v1793500797571!5m2!1spt-PT!2spt',
  hours: [
    { days: 'Segunda a sexta', time: '09:00–13:00 e 14:00–19:00' },
    { days: 'Sábado', time: '09:00–16:00' },
    { days: 'Domingo e feriados', time: 'Fechado ou por marcação' },
  ],
  socialLinks: [
    { label: 'Facebook', href: 'https://www.facebook.com/autonunesmartins/' },
    { label: 'Instagram', href: 'https://www.instagram.com/autonunesmartins/' },
  ],
};
