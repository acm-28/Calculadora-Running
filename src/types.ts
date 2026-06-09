export type StrategyType = 'even' | 'negative' | 'positive';
export type SweatRateType = 'low' | 'normal' | 'high';
export type InputKey = 'ritmo' | 'distancia' | 'tiempo';

export interface GelPreset {
  id: string;
  name: string;
  carbs: number;
  description: string;
}

export interface SplitCheckpoint {
  mark: number;         // KM checkpoint
  segmentPace: number; // in seconds/km
  cumulativeSec: number;
}

export interface FuelEvent {
  sec: number;
  km: number;
  type: 'water' | 'gel' | 'start' | 'finish';
  title: string;
  desc: string;
}
