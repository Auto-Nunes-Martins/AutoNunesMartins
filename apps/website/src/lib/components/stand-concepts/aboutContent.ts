import { facade1, facade2 } from '$lib/localPhotos';

export type TeamMember = {
  name: string;
  text: string;
  phone: { display: string; international: string } | null;
  email: string | null;
  exampleContact?: boolean;
};

/** Editorial prototype. Verify the history, people and claims before publication. */
export const aboutContent = {
  introduction:
    'Somos um stand independente, em Castelo Branco. Ajudamos a escolher o próximo carro com informação clara, tempo para decidir e uma equipa por perto.',
  heroImage: {
    id: facade1.src,
    srcset: facade1.srcset,
    avif: facade1.avif,
    avifSrcset: facade1.avifSrcset,
    alt: 'Fachada da Auto Nunes Martins com toldos vermelhos e viaturas em exposição no exterior',
  },
  origins: {
    title: 'Começámos com carros. Crescemos com pessoas.',
    paragraphs: [
      'A Auto Nunes Martins nasceu de um projeto familiar e de uma vontade simples: fazer da compra de um automóvel uma experiência próxima, sem complicações. No início, havia um pequeno espaço e uma seleção curta, escolhida com tempo.',
      'A seleção cresceu. Chegaram novas marcas e novas pessoas. O que procuramos manter é a forma de receber: conhecer quem nos visita, perceber o que precisa e ajudar a encontrar um carro que faça sentido na sua vida.',
    ],
  },
  history: [
    {
      year: '2011',
      title: 'O primeiro espaço.',
      text: 'Um projeto familiar abre portas em Castelo Branco.',
    },
    {
      year: '2017',
      title: 'Mais escolha. A mesma atenção.',
      text: 'Novas marcas e mais cuidado na preparação de cada viatura.',
    },
    {
      year: 'Hoje',
      title: 'Perto, aqui e no stand.',
      text: 'A conversa pode começar online. A relação continua ao vivo.',
    },
  ],
  approach: {
    title: 'Escolher bem começa por conhecer melhor.',
    paragraphs: [
      'O nosso trabalho começa antes da visita: conhecer cada automóvel, cuidar da apresentação e reunir a informação que ajuda a comparar.',
      'Depois, ouvimos. Falamos sobre o que procura, esclarecemos dúvidas e acompanhamos os próximos passos. Queremos que decida com confiança — e ao seu ritmo.',
    ],
    image: facade2.src,
    srcset: facade2.srcset,
    avif: facade2.avif,
    avifSrcset: facade2.avifSrcset,
    alt: 'Segundo stand da Auto Nunes Martins numa esquina, com fachada envidraçada e viaturas no interior',
  },
  teamIntroduction:
    'Por trás de cada resposta há uma pessoa. Conheça quem o acompanha, da primeira conversa à entrega.',
  essence: {
    eyebrow: 'A NOSSA ESSÊNCIA',
    lead: 'A confiança começa',
    middle: 'nas pessoas',
    highlight: 'que o acompanham.',
  },
  team: [
    {
      name: 'João Nunes',
      text: '',
      phone: { display: '964 243 323', international: '+351964243323' },
      email: 'geral@autonunesmartins.pt',
    },
    {
      name: 'Diogo Nunes',
      text: '',
      phone: { display: '968 392 633', international: '+351968392633' },
      email: 'diogomn99@gmail.com',
    },
    {
      name: 'Alexandre Nunes',
      text: '',
      phone: { display: '966 955 140', international: '+351966955140' },
      email: 'alex_nunes95@hotmail.com',
    },
  ] satisfies TeamMember[],
};
