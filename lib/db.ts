import { Redis } from '@upstash/redis';

const SHOP_KEY = 'missanneshop';

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  product_url: string;
}

export interface SoldItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  product_url: string;
  detected_at: string;
}

export interface HistoryEntry {
  date: string;
  revenue: number;
  product_count: number;
  sold_this_scrape: number;
  sold_revenue_this_scrape: number;
  cumulative_sold: number;
  new_this_scrape: number;
}

export interface ShopData {
  products: Product[];
  total_products: number;
  estimated_revenue: number;
  avg_price: number;
  last_scraped: string;
  revenue_history: HistoryEntry[];
  sold_items: SoldItem[];
  new_items: { name: string; price: number; added_at: string }[];
}

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token || url === '/pipeline') return null;
  return new Redis({ url, token });
}

export async function getShopData(): Promise<ShopData | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<ShopData>(SHOP_KEY);
  } catch {
    return null;
  }
}

export async function saveShopData(data: ShopData): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error('Database not configured');
  await redis.set(SHOP_KEY, data);
}
