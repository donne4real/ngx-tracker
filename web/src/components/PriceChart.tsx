import { createChart, LineSeries } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import type { Bar } from '../../../pipeline/src/types';

export function PriceChart({ bars }: { bars: Bar[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: dark ? '#e3e7ee' : '#1c2430' },
      grid: { vertLines: { visible: false }, horzLines: { color: dark ? '#2c3440' : '#eef0f3' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const series = chart.addSeries(LineSeries, { color: dark ? '#5b9bff' : '#1668e6', lineWidth: 2 });
    series.setData(bars.map((b) => ({ time: b.date, value: b.close })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  return <div ref={ref} className="chart" role="img" aria-label="Closing price chart" />;
}
