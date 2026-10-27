import type {
  BuyerType,
  DeliveryStatus,
  Fuel,
  SaleCreate,
  SaleCancellation,
  SaleCancellationDecision,
  TradeInDisposition,
} from '@anm/types';
import type { RequestEvent } from '@sveltejs/kit';
import { apiJson } from './api.js';

export interface SaleListItem {
  id: string;
  saleDate: string;
  salePrice: string;
  purchasePrice: string;
  expensesTotal: string;
  vatAmount: string;
  commission: string;
  realProfit: string;
  marginPct: number;
  deliveryStatus: DeliveryStatus;
  deliveryDate: string | null;
  /** True when this sale captured a trade-in; drives the `↔` chip on /vendas. */
  hasTradeIn: boolean;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: number;
    vin: string | null;
    licensePlate: string | null;
  };
  customer: {
    id: string;
    name: string;
    nif: string;
  };
}

export interface SaleListTotals {
  count: number;
  revenue: string;
  vat: string;
  expenses: string;
  commission: string;
  profit: string;
  avgMarginPct: number;
}

export interface SaleListResponse {
  items: SaleListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totals: SaleListTotals;
}

export interface SaleListParams {
  state?: 'ACTIVE' | 'CANCELLED';
  q?: string;
  deliveryStatus?: DeliveryStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'saleDate' | 'salePrice' | 'realProfit' | 'marginPct';
  sortDir?: 'asc' | 'desc';
}

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export interface SaleDetailResponse {
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancellationDecision: {
    tradeInAction?: 'RETURN' | 'KEEP' | 'DELETE';
    independentPurchasePrice?: string;
    independentAcquisitionDate?: string;
  } | null;
  id: string;
  vehicleId: string | null;
  customerId: string;
  salePrice: string;
  vatAmount: string;
  commission: string;
  buyerType: BuyerType;
  realProfit: string;
  saleDate: string;
  deliveryDate: string | null;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: number;
    vin: string | null;
    licensePlate: string | null;
    mileage: number;
    fuel: string;
    purchasePrice: string;
    photos: string[];
    status: string;
    /**
     * Set when the sold vehicle ITSELF entered the dealer's stock as a
     * customer trade-in earlier. Carries the originating sale's realProfit
     * so the page can show "lucro consolidado" = this sale + the parent.
     */
    sourceTradeIn: {
      id: string;
      allowanceValue: string;
      sale: {
        cancelledAt: string | null;
        id: string;
        saleDate: string;
        realProfit: string;
        customer: { id: string; name: string };
        vehicle: { id: string; brand: string; model: string; year: number };
      };
    } | null;
  };
  customer: {
    id: string;
    name: string;
    nif: string;
    phone: string;
    email: string | null;
  };
  /**
   * Present when the customer handed over a car as partial payment. When
   * `disposition === 'STOCK'`, `resultingVehicleId` points at the newly-
   * created Vehicle row in inventory; SCRAP keeps it null.
   */
  tradeIn: {
    id: string;
    brand: string;
    model: string;
    year: number;
    fuel: Fuel;
    mileage: number;
    vin: string | null;
    licensePlate: string | null;
    allowanceValue: string;
    disposition: TradeInDisposition;
    resultingVehicleId: string | null;
    notes: string | null;
  } | null;
}

export interface CreateSaleResponse {
  id: string;
  figures: { margin: string; vatAmount: string; commission: string; realProfit: string };
}

type Ev = Pick<RequestEvent, 'locals' | 'fetch'>;

export interface ResolutionContext {
  followingVehicles: {
    id: string;
    label: string;
    licensePlate: string | null;
    purchasePrice: string;
    sold: boolean;
  }[];
  dependencies: {
    saleId: string;
    vehicleId: string;
    label: string;
    licensePlate: string | null;
    saleDate: string;
    salePrice: string;
    realProfit: string;
    vatAmount: string;
  }[];
  deletionBlockers: string[];
  canDeleteTradeIn: boolean;
  tradeIn: {
    id: string;
    label: string;
    licensePlate: string | null;
    status: string;
    purchasePrice: string;
    acquisitionDate: string;
    expensesCount: number;
    expensesTotal: string;
    hasLaterSale: boolean;
  } | null;
}
export interface CancellationReview extends Omit<ResolutionContext, 'tradeIn'> {
  saleId: string;
  vehicleId: string;
  decision: SaleCancellationDecision;
  reviewToken: string;
  vehicle: { id: string; label: string; licensePlate: string | null };
  customer: { id: string; name: string };
  recorded: {
    salePrice: string;
    commission: string;
    vatAmount: string;
    realProfit: string;
    deliveryStatus: string;
    deliveryDate: string | null;
  };
  tradeIn: {
    id: string;
    label: string;
    licensePlate: string | null;
    allowanceValue: string;
    purchasePrice: string;
    expensesTotal: string;
    nextStatus: string;
    nextPurchasePrice: string;
    nextAcquisitionDate: string;
  } | null;
  affectedSale: {
    id: string;
    beforeProfit: string;
    afterProfit: string;
    beforeVat: string;
    afterVat: string;
  } | null;
  eliminated: string[];
  preserved: string[];
  effects: string[];
}

export const salesApi = {
  resolutionContext(event: Ev, id: string): Promise<ResolutionContext> {
    return apiJson(event, `/api/sales/${id}/cancellation/context`);
  },
  previewCancellation(
    event: Ev,
    id: string,
    body: SaleCancellationDecision,
  ): Promise<CancellationReview> {
    return apiJson(event, `/api/sales/${id}/cancellation/preview`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  cancel(
    event: Ev,
    id: string,
    body: SaleCancellation,
  ): Promise<{ vehicleId: string; saleId: string; alreadyCancelled: boolean; deleted: boolean }> {
    return apiJson(event, `/api/sales/${id}/cancellation/confirm`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  list(event: Ev, params: SaleListParams = {}): Promise<SaleListResponse> {
    return apiJson<SaleListResponse>(
      event,
      `/api/sales${toQuery(params as Record<string, unknown>)}`,
    );
  },
  create(event: Ev, body: SaleCreate): Promise<CreateSaleResponse> {
    return apiJson(event, '/api/sales', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  get(event: Ev, id: string): Promise<SaleDetailResponse> {
    return apiJson(event, `/api/sales/${id}`);
  },
  updateDelivery(
    event: Ev,
    id: string,
    body: { deliveryStatus: DeliveryStatus; deliveryDate?: string | null },
  ): Promise<{ ok: true }> {
    return apiJson(event, `/api/sales/${id}/delivery`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
