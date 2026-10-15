import { describe, expect, it } from 'vitest';
import { salesChartGeometry } from './salesChartGeometry';

describe('salesChartGeometry', () => {
  it('uses the labelled axis ceiling for values between tick multiples', () => {
    const chart = salesChartGeometry([0, 3, 5]);
    expect(chart.ticks).toEqual([8, 6, 4, 2, 0]);
    expect(chart.points.map((point) => point.percent)).toEqual([0, 37.5, 62.5]);
    for (const point of chart.points) {
      expect((1 - point.y / 176) * chart.ceiling).toBeCloseTo(point.value);
    }
  });
  it('keeps a useful integer axis for empty and zero series', () => {
    expect(salesChartGeometry([])).toEqual({
      ceiling: 4,
      ticks: [4, 3, 2, 1, 0],
      points: [],
      line: '',
      area: '',
    });
    expect(salesChartGeometry([0, 0]).points.map((point) => point.y)).toEqual([176, 176]);
  });
  it('shows a single month with the same baseline as a flat series', () => {
    const single = salesChartGeometry([3]);
    expect(single.points[0]).toEqual({ value: 3, x: 500, y: 44, percent: 75 });
    expect(single.area).toBe('');
    expect(salesChartGeometry([3, 3, 3]).points.map((point) => point.y)).toEqual([44, 44, 44]);
  });
  it('places the exact axis maximum at the top without clipping', () => {
    const chart = salesChartGeometry([12, 0, 24]);
    expect(chart.ceiling).toBe(24);
    expect(chart.points.map((point) => point.y)).toEqual([88, 176, 0]);
  });
  it('connects the actual monthly values with straight segments and closes the area at zero', () => {
    const chart = salesChartGeometry([4, 0, 2]);
    expect(chart.line).toBe('M166.67,0.00 L500.00,176.00 L833.33,88.00');
    expect(chart.area).toBe(`${chart.line} L833.33,176 L166.67,176 Z`);
    expect(chart.line).not.toMatch(/[CQ]/);
  });
});
