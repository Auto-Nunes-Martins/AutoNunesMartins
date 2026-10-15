import { whatsappUrl } from '$lib/whatsappContact';
import type { StandContact } from './standContact';
function configuredUrl(contact: StandContact, name: string, domain: string): string | null {
  const configured = contact.socialLinks.find(link => link.label.toLowerCase() === name.toLowerCase());
  if (!configured) return null;
  try {
    const url = new URL(configured.href);
    return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ? url.href : null;
  } catch { return null; }
}
export function footerSocialLinks(contact: StandContact) {
  return [
    { name: 'Facebook', href: configuredUrl(contact, 'Facebook', 'facebook.com') },
    { name: 'Instagram', href: configuredUrl(contact, 'Instagram', 'instagram.com') },
    { name: 'WhatsApp', href: contact.whatsapp?.confirmed && !contact.whatsapp.demo ? whatsappUrl(contact.whatsapp) : null }
  ];
}
