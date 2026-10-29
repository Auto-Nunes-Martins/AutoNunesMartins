import { mkdir, writeFile } from 'node:fs/promises';
import { contactEmailHtml, type ContactEmailData } from '../src/lib/server/contactEmail.js';
const base = { name: 'Ana Ferreira', email: 'ana.ferreira@example.org', page: '/' };
const cases: [string, ContactEmailData][] = [
  [
    'contact-email',
    {
      ...base,
      subject: 'Informações gerais',
      message:
        'Olá, equipa!\n\nGostaria de conhecer as opções de financiamento e saber qual o melhor horário para visitar o stand.\n\nObrigada,\nAna Ferreira',
    },
  ],
  [
    'contact-email-vehicle',
    {
      ...base,
      subject: 'Marcar uma visita',
      page: '/viaturas/viatura-exemplo-012345abcdef',
      message:
        'Boa tarde,\n\nTenho interesse nesta viatura. É possível visitá-la no sábado de manhã?\n\nGostaria também de confirmar o histórico de manutenção.\n\nObrigada!',
    },
  ],
  [
    'contact-email-long',
    {
      ...base,
      name: 'Nome fictício comprido para verificar a apresentação em dispositivos móveis',
      email: 'contacto.ficticio.comprido.para.validacao@example.org',
      subject:
        'Pedido de informações com um assunto mais extenso para verificar a leitura no telemóvel',
      message:
        'Mensagem fictícia para verificar texto longo, quebras de linha e caracteres especiais: < > & " \'\n\n' +
        'Tenho interesse em conhecer esta viatura e as condições disponíveis. '.repeat(22) +
        '\n\n' +
        'PalavraSemEspaços'.repeat(120) +
        '\n\nObrigada pela atenção.',
    },
  ],
];
const directory = new URL('../../docs/previews/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, data] of cases) {
  // Preview only: resolve the real repository PNG locally; no invented public domain is sent.
  const html = contactEmailHtml(data).replace(
    'cid:auto-nunes-martins-logo',
    '../../backend/src/lib/server/contactEmailLogo.png',
  );
  await writeFile(new URL(`${name}.html`, directory), html);
}
await writeFile(
  new URL('contact-email-wordmark.html', directory),
  contactEmailHtml(cases[0]![1], { logo: false }),
);
console.info('Quatro previews fictícias em docs/previews; logo local. Nenhum email enviado.');
