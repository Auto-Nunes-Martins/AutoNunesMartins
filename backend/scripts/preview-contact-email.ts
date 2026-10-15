import { mkdir, writeFile } from 'node:fs/promises';
import { contactEmailHtml } from '../src/lib/server/contactEmail.js';
const html = contactEmailHtml({
  name: 'Ana Ferreira · Exemplo fictício',
  email: 'ana.ferreira@example.org',
  subject: 'Visita ao BMW Série 3',
  message:
    'Olá, equipa Auto Nunes Martins!\n\nGostaria de saber se esta viatura continua disponível e se seria possível visitá-la no sábado de manhã.\n\nTambém gostava de confirmar o histórico de manutenção e quais os documentos necessários para a compra.\n\nObrigada,\nAna Ferreira',
  page: '/viaturas/bmw-serie-3-012345abcdef',
});
const directory = new URL('../../docs/previews/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('contact-email.html', directory), html);
console.info(
  'Preview fictícia guardada em docs/previews/contact-email.html; nenhum email enviado.',
);
