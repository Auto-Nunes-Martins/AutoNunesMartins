// Test-only Prisma surface backed by real, isolated PostgreSQL (PGlite).
// Financial services and their SQL aggregators run unchanged; no external DB.
import Decimal from 'decimal.js';
export function prismaForPglite(db: any, ids = { next: 0 }): any {
  const decimalFields: Record<string, string[]> = {
    Vehicle: ['purchasePrice', 'salePrice', 'publicPrice'],
    Sale: ['salePrice', 'vatAmount', 'commission', 'realProfit'],
    TradeIn: ['allowanceValue'],
    VehicleExpense: ['amount'],
    OperationalExpense: ['amount'],
  };
  const normalize = (v: any): any =>
    v instanceof Date
      ? v.toISOString()
      : Decimal.isDecimal(v)
        ? v.toString()
        : v && typeof v === 'object' && !Array.isArray(v)
          ? 'set' in v
            ? normalize(v.set)
            : JSON.stringify(v)
          : v;
  const decode = (table: string, row: any) =>
    row
      ? Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            decimalFields[table]?.includes(k) && v !== null ? new Decimal(v as string) : v,
          ]),
        )
      : null;
  const where = (table: string, input: any, values: any[]): string => {
    if (!input) return 'TRUE';
    const parts: string[] = [];
    const param = (v: any) => {
      values.push(normalize(v));
      return '$' + values.length;
    };
    for (const [key, value] of Object.entries(input) as [string, any][]) {
      if (value === undefined) continue;
      if (key === 'AND' || key === 'OR') {
        const list = Array.isArray(value) ? value : [value];
        parts.push(
          '(' +
            list.map((w) => where(table, w, values)).join(key === 'AND' ? ' AND ' : ' OR ') +
            ')',
        );
        continue;
      }
      if (key === 'sale' && table === 'Vehicle') {
        parts.push(`NOT EXISTS (SELECT 1 FROM "Sale" WHERE "Sale"."vehicleId"="Vehicle"."id")`);
        continue;
      }
      if (key === 'metadata') {
        parts.push(`"metadata" #>> '{${value.path.join(',')}}' = ${param(value.equals)}`);
        continue;
      }
      if (value === null) {
        parts.push(`"${key}" IS NULL`);
        continue;
      }
      if (typeof value !== 'object' || value instanceof Date || Decimal.isDecimal(value)) {
        parts.push(`"${key}" = ${param(value)}`);
        continue;
      }
      for (const [operator, operand] of Object.entries(value) as [string, any][]) {
        if (operand === undefined || operator === 'mode') continue;
        if (operator === 'in' || operator === 'notIn') {
          parts.push(
            `"${key}" ${operator === 'in' ? 'IN' : 'NOT IN'} (${operand.map(param).join(',')})`,
          );
          continue;
        }
        if (operator === 'not' && operand === null) {
          parts.push(`"${key}" IS NOT NULL`);
          continue;
        }
        const op: Record<string, string> = {
          equals: '=',
          not: '<>',
          lt: '<',
          lte: '<=',
          gt: '>',
          gte: '>=',
        };
        if (!op[operator]) throw Error('Unsupported test where ' + key + '.' + operator);
        parts.push(`"${key}" ${op[operator]} ${param(operand)}`);
      }
    }
    return parts.length ? parts.join(' AND ') : 'TRUE';
  };
  const read = async (table: string, args: any = {}) => {
    const values: any[] = [];
    let sql = `SELECT * FROM "${table}" WHERE ${where(table, args.where, values)}`;
    const order = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
    if (order.length)
      sql +=
        ' ORDER BY ' +
        order
          .flatMap((o: any) =>
            Object.entries(o).map(([k, v]) => `"${k}" ${String(v).toUpperCase()}`),
          )
          .join(',');
    if (args.take !== undefined) sql += ' LIMIT ' + Number(args.take);
    if (args.skip) sql += ' OFFSET ' + Number(args.skip);
    return (await db.query(sql, values)).rows.map((row: any) => decode(table, row));
  };
  const api: any = {};
  const view = async (table: string, row: any, spec: any): Promise<any> => {
    if (!row) return null;
    const fields = spec?.include ?? spec?.select ?? {};
    const result = { ...row };
    for (const [key, nested] of Object.entries(fields)) {
      if (!nested) continue;
      if (table === 'Vehicle') {
        if (key === 'sale')
          result.sale = await api.sale.findUnique({
            where: { vehicleId: row.id },
            ...(nested === true ? {} : (nested as any)),
          });
        if (key === 'salesHistory')
          result.salesHistory = await api.sale.findMany({
            where: { originalVehicleId: row.id },
            ...(nested === true ? {} : (nested as any)),
          });
        if (key === 'expenses')
          result.expenses = await api.vehicleExpense.findMany({
            where: { vehicleId: row.id },
            ...(nested === true ? {} : (nested as any)),
          });
        if (key === 'sourceTradeIn')
          result.sourceTradeIn = await api.tradeIn.findUnique({
            where: { resultingVehicleId: row.id },
            ...(nested === true ? {} : (nested as any)),
          });
      }
      if (table === 'Sale') {
        if (key === 'vehicle')
          result.vehicle = await api.vehicle.findUnique({
            where: { id: row.originalVehicleId },
            ...(nested === true ? {} : (nested as any)),
          });
        if (key === 'customer')
          result.customer = await api.customer.findUnique({
            where: { id: row.customerId },
            ...(nested === true ? {} : (nested as any)),
          });
        if (key === 'tradeIn')
          result.tradeIn = await api.tradeIn.findUnique({
            where: { saleId: row.id },
            ...(nested === true ? {} : (nested as any)),
          });
      }
      if (table === 'TradeIn') {
        if (key === 'resultingVehicle')
          result.resultingVehicle = row.resultingVehicleId
            ? await api.vehicle.findUnique({
                where: { id: row.resultingVehicleId },
                ...(nested === true ? {} : (nested as any)),
              })
            : null;
        if (key === 'sale')
          result.sale = await api.sale.findUnique({
            where: { id: row.saleId },
            ...(nested === true ? {} : (nested as any)),
          });
      }
      if (table === 'VehicleExpense' && key === 'vehicle')
        result.vehicle = await api.vehicle.findUnique({
          where: { id: row.vehicleId },
          ...(nested === true ? {} : (nested as any)),
        });
      if (table === 'ActivityLog' && key === 'actor') result.actor = null;
    }
    return result;
  };
  for (const table of [
    'Vehicle',
    'Sale',
    'TradeIn',
    'Customer',
    'VehicleExpense',
    'OperationalExpense',
    'ActivityLog',
    'AppSetting',
  ]) {
    const delegate: any = {};
    api[table[0]!.toLowerCase() + table.slice(1)] = delegate;
    delegate.findMany = async (args: any = {}) =>
      Promise.all((await read(table, args)).map((r: any) => view(table, r, args)));
    delegate.findUnique = async (args: any) =>
      view(table, (await read(table, { ...args, take: 1 }))[0], args);
    delegate.findFirst = delegate.findUnique;
    delegate.count = async (args: any = {}) => (await read(table, args)).length;
    delegate.create = async ({ data }: any) => {
      const input = { id: 'generated-' + ++ids.next, ...data };
      if (['Vehicle', 'Sale', 'TradeIn', 'Customer'].includes(table)) input.updatedAt = new Date();
      const keys = Object.keys(input).filter((k) => input[k] !== undefined),
        values = keys.map((k) => normalize(input[k]));
      const rows = (
        await db.query(
          `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
          values,
        )
      ).rows;
      return decode(table, rows[0]);
    };
    delegate.updateMany = async ({ where: filter, data }: any) => {
      const keys = Object.keys(data).filter((k) => data[k] !== undefined),
        values = keys.map((k) => normalize(data[k]));
      const condition = where(table, filter, values);
      const rows = (
        await db.query(
          `UPDATE "${table}" SET ${keys.map((k, i) => `"${k}"=$${i + 1}`).join(',')} WHERE ${condition} RETURNING *`,
          values,
        )
      ).rows;
      return { count: rows.length, rows: rows.map((r: any) => decode(table, r)) };
    };
    delegate.update = async (args: any) => (await delegate.updateMany(args)).rows[0];
    delegate.delete = async ({ where: filter }: any) => {
      const values: any[] = [];
      return (
        await db.query(
          `DELETE FROM "${table}" WHERE ${where(table, filter, values)} RETURNING *`,
          values,
        )
      ).rows[0];
    };
    delegate.aggregate = async (args: any) => {
      const rows = await read(table, args);
      return {
        _sum: Object.fromEntries(
          Object.keys(args._sum).map((key) => [
            key,
            rows.reduce((n: any, r: any) => n.plus(r[key] ?? 0), new Decimal(0)),
          ]),
        ),
      };
    };
  }
  api.task = { findMany: async () => [], count: async () => 0 };
  api.$queryRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = strings.reduce((s, p, i) => s + p + (i < values.length ? '$' + (i + 1) : ''), '');
    return (await db.query(sql, values.map(normalize))).rows;
  };
  api.$transaction = async (work: any) =>
    db.transaction((tx: any) => work(prismaForPglite(tx, ids)));
  return api;
}
