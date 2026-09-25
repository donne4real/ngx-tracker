import type { Horizon } from '../../pipeline/src/types';

/** Display labels for every performance period, in display order. */
const LABELS: Record<Horizon, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  '3m': '3M',
  '6m': '6M',
  ytd: 'YTD',
  '1y': '1Y',
};

export const HORIZON_TABS: Array<{ key: Horizon; label: string }> = (Object.keys(LABELS) as Horizon[]).map((key) => ({
  key,
  label: LABELS[key],
}));

export const horizonLabel = (h: Horizon) => LABELS[h];
