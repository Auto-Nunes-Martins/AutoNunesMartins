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
  hours: { days: string; time: string }[];
  socialLinks: { label: string; href: string }[];
};

// Contact data explicitly confirmed by the owner on 25 October 2026.
// The owner also confirmed the principal number for WhatsApp.
export const standContact: StandContact = {
  isDemo: false,
  name: 'Auto Nunes Martins',
  description: 'Comércio de automóveis',
  address: 'Rua Dr. Jorge Costa\n6000-215 Castelo Branco',
  additionalAddress: 'Estrada de Montalvão\n6000-050 Castelo Branco',
  phone: { display: '+351 964 243 323', international: '+351964243323' },
  additionalPhone: { display: '+351 968 392 633', international: '+351968392633' },
  whatsapp: { international: '+351964243323', confirmed: true, demo: false },
  email: 'geral@autonunesmartins.pt',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=Rua%20Dr.%20Jorge%20Costa%2C%206000-215%20Castelo%20Branco',
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
