/** Straight monthly segments share the same integer scale as the labelled axis. */
export function salesChartGeometry(values: readonly number[]) {
  const maximum = Math.max(0, ...values);
  const step = Math.max(1, Math.ceil(maximum / 4));
  const ceiling = step * 4;
  const points = values.map((value, index) => ({
    value,
    // Month columns are centred, including when the series has a single month.
    x: ((index + 0.5) / values.length) * 1000,
    y: (1 - value / ceiling) * 176,
    percent: (value / ceiling) * 100,
  }));
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return {
    ceiling,
    ticks: [ceiling, step * 3, step * 2, step, 0],
    points,
    line,
    area:
      first && last && points.length > 1
        ? `${line} L${last.x.toFixed(2)},176 L${first.x.toFixed(2)},176 Z`
        : '',
  };
}
