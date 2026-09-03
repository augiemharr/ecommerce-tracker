import { Redis } from '@upstash/redis';

const PROJECTIONS_KEY = 'missanneshop:projections';
const NOTES_KEY = 'missanneshop:projection_notes';

export interface CompetitorItem {
  source: string;
  source_type: 'resale' | 'new_marketplace' | 'aggregator' | 'local';
  item_name: string;
  price: number;
  currency: string;
  url: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'used' | 'unknown';
  match_score: number;
  seller_location: string;
  shipping_cost: number;
  total_cost: number;
  listed_date: string;
  sold_count: number;
}

export interface ProductProjection {
  product_id: string;
  product_name: string;
  category: string;
  missanne_price: number;
  competitors: CompetitorItem[];
  resale_competitors: CompetitorItem[];
  new_item_competitors: CompetitorItem[];
  avg_market_price: number;
  avg_resale_price: number;
  avg_new_price: number;
  price_position: 'below' | 'at' | 'above';
  resale_price_position: 'below' | 'at' | 'above';
  potential_margin_pct: number;
  market_range: { min: number; max: number; median: number };
  sources_found: number;
  resale_sources_found: number;
}

export interface ProjectionSummary {
  avg_missanne_price: number;
  avg_market_price: number;
  avg_resale_price: number;
  items_below_market: number;
  items_above_market: number;
  items_competitive_in_resale: number;
  top_competitive_items: string[];
  top_overpriced_items: string[];
}

export interface ProjectionData {
  generated_at: string;
  total_sources_searched: number;
  products: ProductProjection[];
  summary: ProjectionSummary;
}

export interface ProjectionNotes {
  generated_analysis: string;
  user_notes: string;
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || url === '/pipeline') return null;
  return new Redis({ url, token });
}

export async function getProjections(): Promise<ProjectionData | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<ProjectionData>(PROJECTIONS_KEY);
  } catch {
    return null;
  }
}

export async function saveProjections(data: ProjectionData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error('Database not configured');
  await redis.set(PROJECTIONS_KEY, data);
}

export async function getProjectionNotes(): Promise<ProjectionNotes | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<ProjectionNotes>(NOTES_KEY);
  } catch {
    return null;
  }
}

export async function saveProjectionNotes(notes: ProjectionNotes): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error('Database not configured');
  await redis.set(NOTES_KEY, notes);
}

const RATES_TO_NZD: Record<string, number> = {
  NZD: 1,
  USD: 1.69,
  GBP: 2.15,
  EUR: 1.85,
  AUD: 1.08,
  PHP: 0.03,
};

export function convertToNZD(amount: number, fromCurrency: string): number {
  const rate = RATES_TO_NZD[fromCurrency.toUpperCase()] || 1;
  return amount * rate;
}

export function calculateMatchScore(query: string, target: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const t = target.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (q.length === 0 || t.length === 0) return 0;
  let matches = 0;
  for (const word of q) {
    if (t.some((tw) => tw.includes(word) || word.includes(tw))) matches++;
  }
  return matches / q.length;
}

export const SOURCE_TYPES: Record<string, 'resale' | 'new_marketplace' | 'aggregator' | 'local'> = {
  depop: 'resale',
  ebay: 'resale',
  poshmark: 'resale',
  mercari: 'resale',
  vinted: 'resale',
  thredup: 'resale',
  etsy: 'new_marketplace',
  amazon: 'new_marketplace',
  google_shopping: 'aggregator',
  trademe: 'local',
};

export const RATES_DELAY: Record<string, number> = {
  depop: 2000,
  ebay: 2000,
  poshmark: 2000,
  mercari: 2000,
  vinted: 2000,
  thredup: 2000,
  etsy: 1500,
  amazon: 1500,
  google_shopping: 3000,
  trademe: 2000,
};
