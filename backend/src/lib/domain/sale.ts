import Decimal from 'decimal.js';
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export type BuyerType = 'PARTICULAR' | 'COMERCIANTE';
export interface SaleFiguresInput {
  salePrice: Decimal.Value;
  purchasePrice: Decimal.Value;
  expensesTotal: Decimal.Value;
  expensesVat?: Decimal.Value;
  /** Legacy net amount, retained when no gross document is supplied. */
  commission?: Decimal.Value;
  commissionGross?: Decimal.Value | null;
  buyerType?: BuyerType;
}
export function computeSaleFigures(input: SaleFiguresInput) {
  const money = (v: Decimal.Value) => new Decimal(v).toDecimalPlaces(2);
  const vehicleMargin = money(input.salePrice).minus(money(input.purchasePrice));
  const expensesVat = money(input.expensesVat ?? 0);
  const expensesCost = money(input.expensesTotal).minus(expensesVat);
  const gross = input.commissionGross == null ? null : money(input.commissionGross);
  // Management configuration chosen by the owner; not a universal tax rule.
  const commissionVat = gross === null ? new Decimal(0) : gross.mul(23).div(123).toDecimalPlaces(2);
  const commission = gross === null ? money(input.commission ?? 0) : gross.minus(commissionVat);
  const vatAmount =
    input.buyerType === 'COMERCIANTE' || vehicleMargin.lte(0)
      ? new Decimal(0)
      : vehicleMargin.mul(23).div(123).toDecimalPlaces(2);
  const margin = vehicleMargin.minus(expensesCost);
  // Trade-ins are independent acquisitions; never subtract their allowance here.
  return {
    margin,
    vatAmount,
    commission,
    commissionVat,
    expensesVat,
    expensesCost,
    vatBalance: vatAmount.plus(commissionVat).minus(expensesVat),
    realProfit: margin.minus(vatAmount).plus(commission).toDecimalPlaces(2),
  };
}
export type SaleFigures = ReturnType<typeof computeSaleFigures>;
