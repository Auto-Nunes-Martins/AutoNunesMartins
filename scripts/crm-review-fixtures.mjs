// Fictional data only. Shared by the isolated CRM browser checks.
const stamp = '2026-10-20T10:00:00.000Z';
const id = 'c' + '1'.repeat(24);
const photoPaths = [
  `${id}/00000000-0000-4000-8000-000000000001.jpg`,
  `${id}/00000000-0000-4000-8000-000000000002.jpg`,
];
export const user = {
  id: 'fixture-user',
  name: 'Equipa de teste',
  email: 'teste@example.invalid',
  imageUrl: null,
};
export const customer = {
  id: 'fixture-customer',
  name: 'Cliente de demonstração',
  phone: '910000000',
  email: 'cliente@example.invalid',
  nif: '000000000',
  address: 'Morada de demonstração',
  notes: 'Apenas dados fictícios para verificar a interface.',
  createdAt: stamp,
  updatedAt: stamp,
  lastContactDate: stamp,
  sales: [],
  _count: { sales: 0 },
};
export const vehicle = {
  id,
  brand: 'Renault',
  model: 'Clio 1.5 Blue dCi Intens',
  year: 2022,
  fuel: 'DIESEL',
  mileage: 42300,
  vin: 'VF1RFB00712345678',
  licensePlate: 'AA-00-AA',
  purchasePrice: '11900.00',
  salePrice: '15900.00',
  acquisitionDate: '2026-08-01T00:00:00.000Z',
  soldDate: null,
  createdAt: stamp,
  updatedAt: stamp,
  description: 'Viatura de demonstração. Revisão e documentação verificadas pela equipa.',
  status: 'AVAILABLE',
  sale: null,
  sourceTradeIn: null,
  webPublished: true,
  publicSlug: 'renault-clio-fixture',
  publicPrice: '15900.00',
  publicDescription: 'Viatura de demonstração para validação visual.',
  publicTransmission: 'MANUAL',
  publicSpecifications: {},
  photos: photoPaths,
  publicPhotoPaths: [photoPaths[0]],
  pendingDocFlags: { financing: false, imt: false, registration: true, docs: false },
  thumbnailUrl: null,
  expenses: [
    {
      id: 'fixture-expense',
      vehicleId: id,
      category: 'REPAIR',
      description: 'Revisão completa',
      amount: '350.00',
      date: stamp,
      createdAt: stamp,
    },
  ],
  expensesTotal: '350.00',
  figures: { margin: '4000.00', vatAmount: '747.97', commission: '0.00', realProfit: '2902.03' },
};
export const sale = {
  id: 'fixture-sale',
  vehicleId: id,
  customerId: customer.id,
  vehicle: { ...vehicle, status: 'SOLD' },
  customer,
  tradeIn: null,
  buyerType: 'PARTICULAR',
  saleDate: stamp,
  deliveryDate: null,
  deliveryStatus: 'PENDING',
  createdAt: stamp,
  updatedAt: stamp,
  cancelledAt: null,
  cancellationReason: null,
  cancellationDecision: null,
  cancelledBy: null,
  salePrice: '15900.00',
  purchasePrice: '11900.00',
  expensesTotal: '350.00',
  vatAmount: '747.97',
  commission: '0.00',
  realProfit: '2902.03',
  marginPct: 18.25,
  hasTradeIn: false,
};
export const initialTasks = [
  {
    id: 'task-urgent',
    title: 'Confirmar documentação para a entrega',
    description: 'Verificar os documentos e confirmar a hora com o cliente.',
    priority: 'URGENT',
    status: 'TODO',
    dueDate: '2026-10-19T00:00:00.000Z',
    assignee: user,
  },
  {
    id: 'task-high',
    title: 'Preparar fotografias da nova viatura',
    description: 'Conferir a seleção e a fotografia principal antes de publicar.',
    priority: 'HIGH',
    status: 'TODO',
    dueDate: '2026-10-22T00:00:00.000Z',
    assignee: null,
  },
  {
    id: 'task-medium',
    title: 'Contactar oficina para revisão',
    description: null,
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    dueDate: null,
    assignee: user,
  },
  {
    id: 'task-low',
    title: 'Organizar arquivo de fornecedores',
    description: null,
    priority: 'LOW',
    status: 'DONE',
    dueDate: null,
    assignee: user,
  },
].map((t) => ({
  ...t,
  assigneeId: t.assignee?.id ?? null,
  startDate: null,
  reminderDate: null,
  recurrence: 'NONE',
  recurrenceParentId: null,
  boardVersion: 0,
  createdAt: stamp,
  updatedAt: stamp,
}));
export const activity = [
  {
    id: 'event-1',
    type: 'VEHICLE_ADDED',
    entityType: 'vehicle',
    entityId: id,
    message: 'Renault Clio adicionado ao inventário.',
    createdAt: stamp,
    actor: user,
  },
  {
    id: 'event-2',
    type: 'TASK_COMPLETED',
    entityType: 'task',
    entityId: 'task-low',
    message: 'Organização do arquivo concluída.',
    createdAt: stamp,
    actor: user,
  },
  {
    id: 'event-3',
    type: 'SALE_CREATED',
    entityType: 'sale',
    entityId: sale.id,
    message: 'Venda de demonstração registada.',
    createdAt: stamp,
    actor: user,
  },
];
export const list = (items) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  totalPages: 1,
});
const common = {
  currentUser: user,
  clerkUserId: 'fixture-clerk',
  vehicleStats: { active: 3 },
  taskStats: { mineActive: 3 },
  users: [user],
};
export const routes = {
  '/dashboard': 'dashboard',
  '/viaturas': 'viaturas',
  [`/viaturas/${id}`]: 'viaturas/[id]',
  [`/viaturas/${id}/editar`]: 'viaturas/[id]/editar',
  [`/viaturas/${id}/vender`]: 'viaturas/[id]/vender',
  [`/viaturas/${id}/publicar`]: 'viaturas/[id]/publicar',
  '/viaturas/nova': 'viaturas/nova',
  '/clientes': 'clientes',
  [`/clientes/${customer.id}`]: 'clientes/[id]',
  [`/clientes/${customer.id}/editar`]: 'clientes/[id]/editar',
  '/clientes/novo': 'clientes/novo',
  '/vendas': 'vendas',
  '/vendas/anuladas': 'vendas/anuladas',
  [`/vendas/${sale.id}`]: 'vendas/[id]',
  '/financeiro': 'financeiro',
  '/tarefas': 'tarefas',
  '/tarefas/nova': 'tarefas/nova',
  '/tarefas/task-urgent/editar': 'tarefas/[id]/editar',
  '/atividade': 'atividade',
  '/site/destaques': 'site/destaques',
  '/definicoes': 'definicoes',
  '/guia': 'guia',
};
export function dataFor(url, tasks = initialTasks) {
  const route = routes[url.pathname];
  const empty = url.searchParams.get('__state') === 'empty';
  const error = url.searchParams.get('__state') === 'error';
  const err = 'Não foi possível carregar os dados. Tente novamente.';
  const filters = Object.fromEntries(
    [...url.searchParams].filter(([key]) => !key.startsWith('__')),
  );
  const activityRows = empty ? [] : activity;
  const totals = {
    count: 1,
    revenue: '15900',
    vat: '747.97',
    expenses: '350',
    commission: '0',
    profit: '2902.03',
    avgMarginPct: 18.25,
  };
  const salesList = { ...list(empty ? [] : [sale]), totals, ...(error ? { _error: err } : {}) };
  let data = {};
  switch (route) {
    case 'dashboard': {
      const metric = { current: '15900', previous: '12500', deltaPct: 27.2 };
      const months = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
      ];
      data = {
        highlights: [],
        dashboard: error
          ? { kind: 'error', message: err }
          : {
              kind: 'success',
              payload: {
                kpis: {
                  vendasMes: { count: 3, previousCount: 2, deltaPct: 50 },
                  faturacaoMes: metric,
                  lucroMes: { ...metric, current: '8300' },
                  comissoesMes: { ...metric, current: '0', previous: '0' },
                  margemMedia: { current: 18.25, previous: 16.8, deltaPct: 8.6 },
                  sparklines: {
                    vendas: [1, 2, 1, 3, 2, 3],
                    faturacao: [12, 14, 13, 19, 15, 20],
                    lucro: [2, 3, 2, 4, 3, 5],
                    comissoes: [0, 0],
                    margem: [15, 17, 15, 19, 17, 18],
                  },
                },
                salesChart: {
                  months,
                  sold: [1, 2, 3, 2, 4, 3, 5, 3, 2, 3, 0, 0],
                  revenue: [
                    14000, 27000, 45000, 30000, 54000, 41000, 65000, 42000, 32000, 48000, 0, 0,
                  ],
                  ytdSold: 28,
                  ytdRevenue: '398000',
                  ytdAvgMarginPct: 18.25,
                },
                bestSellers: empty
                  ? []
                  : [
                      { rank: 1, brand: 'Renault', model: 'Clio', count: 5 },
                      { rank: 2, brand: 'Peugeot', model: '208', count: 4 },
                    ],
                stockAged: empty ? [] : [{ ...vehicle, daysInStock: 80 }],
                todayTasks: empty
                  ? []
                  : tasks
                      .filter((t) => t.status !== 'DONE')
                      .map((t) => ({ ...t, isOverdue: t.id === 'task-urgent' })),
                recentActivity: activityRows,
                alerts: {
                  stockAged: empty ? 0 : 1,
                  tasksDueOrOverdue: empty ? 0 : 1,
                  remindersToday: 0,
                  draftVehicles: 0,
                },
              },
            },
      };
      break;
    }
    case 'viaturas':
      data = {
        filters,
        list: {
          ...list(
            empty
              ? []
              : [
                  vehicle,
                  {
                    ...vehicle,
                    id: 'second-car',
                    brand: 'Peugeot',
                    model: '208 1.2 PureTech',
                    licensePlate: 'BB-00-BB',
                    status: 'RESERVED',
                  },
                ],
          ),
          ...(error ? { _error: err } : {}),
        },
        drafts: list([]),
      };
      break;
    case 'clientes':
      data = {
        filters,
        list: {
          ...list(
            empty
              ? []
              : [
                  customer,
                  { ...customer, id: 'another-customer', name: 'Empresa de demonstração' },
                ],
          ),
          ...(error ? { _error: err } : {}),
        },
      };
      break;
    case 'vendas':
    case 'vendas/anuladas':
      data = { filters, list: salesList };
      break;
    case 'vendas/[id]':
      data = { sale, timeline: { items: activityRows, total: activityRows.length } };
      break;
    case 'viaturas/[id]/publicar':
      data = {
        vehicle: { ...vehicle, status: 'DRAFT', webPublished: false, publicPhotoPaths: [] },
      };
      break;
    case 'financeiro':
      data = {
        expensesFilters: filters,
        expenses: {
          ...list(
            empty
              ? []
              : [
                  {
                    id: 'op-expense',
                    category: 'OTHER',
                    description: 'Material de escritório e consumíveis',
                    amount: '48.50',
                    date: stamp,
                    createdAt: stamp,
                  },
                ],
          ),
          totalSum: '48.50',
          ...(error ? { _error: err } : {}),
        },
      };
      break;
    case 'tarefas':
      data = {
        filters,
        tasks: empty
          ? []
          : tasks.filter(
              (t) =>
                (!filters.priority || t.priority === filters.priority) &&
                (filters.scope !== 'mine' || t.assigneeId === user.id) &&
                (filters.scope !== 'general' || t.assigneeId === null) &&
                (!filters.q || t.title.toLowerCase().includes(filters.q.toLowerCase())),
            ),
        taskActivity: activityRows.filter((entry) => entry.type.startsWith('TASK_')),
        error: error ? err : null,
      };
      break;
    case 'tarefas/[id]/editar':
      data = { task: tasks[0] };
      break;
    case 'atividade':
      data = { params: filters, result: { ...list(activityRows), pageCount: 1 } };
      break;
    case 'site/destaques':
      data = {
        editor: {
          items: [],
          candidates: empty
            ? []
            : [{ ...vehicle, photos: [{ path: vehicle.photos[0], url: '/__fixture/photo' }] }],
        },
      };
      break;
    case 'definicoes':
      data = {
        settings: empty
          ? []
          : [
              {
                key: 'stockAgingDays',
                label: 'Alerta de antiguidade em stock',
                description: 'Número de dias a partir do qual uma viatura aparece nos alertas.',
                value: 60,
              },
            ],
        error: error ? err : null,
      };
      break;
    default:
      data = {
        vehicle,
        customer,
        customers: [customer],
        signedPhotos: empty
          ? []
          : vehicle.photos.map((path) => ({ path, url: '/__fixture/photo' })),
        isFeatured: false,
      };
  }
  if (data.vehicle && url.searchParams.has('__sold'))
    data.vehicle = { ...data.vehicle, status: 'SOLD', sale };
  return { ...common, ...data };
}
