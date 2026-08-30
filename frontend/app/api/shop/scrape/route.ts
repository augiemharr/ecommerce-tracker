import { NextResponse } from 'next/server';
import { getShopData, saveShopData, ShopData, SoldItem, PendingSoldItem } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ScrapedProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  product_url: string;
}

async function scrapeAll(): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  };
  const baseUrl = 'https://missanneshop.com';

  for (let page = 1; page <= 20; page++) {
    try {
      const url = `${baseUrl}/products.json?limit=250&page=${page}`;
      const resp = await fetch(url, { headers, cache: 'no-store' });
      if (!resp.ok) break;

      const data = await resp.json();
      const items = data.products || [];
      if (items.length === 0) break;

      for (const item of items) {
        const variants = item.variants || [];
        const price = variants.length > 0 ? parseFloat(variants[0].price) : 0;
        const images = item.images || [];
        const imageUrl = images.length > 0 ? images[0].src : null;
        const productUrl = `${baseUrl}/products/${item.handle || item.id}`;

        products.push({
          id: String(item.id),
          name: item.title || '',
          price,
          currency: 'NZD',
          image_url: imageUrl,
          product_url: productUrl,
        });
      }

      if (items.length < 250) break;
    } catch (e) {
      console.error(`Error scraping page ${page}:`, e);
      break;
    }
  }
  return products;
}

interface VerificationResult {
  confirmed: boolean;
  method: '404' | 'content_check' | 'combined' | 'failed';
  confidence: number;
}

const SOLD_OUT_INDICATORS = [
  'sold out',
  'out of stock',
  'unavailable',
  'no longer available',
  'this product is no longer',
  'has been removed',
  'does not exist',
  'page not found',
];

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 2;
const REQUIRED_MISSING_SCRAPES = 3;

async function verifyUrl(url: string, retries = MAX_RETRIES): Promise<VerificationResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });

      if (resp.status === 404) {
        return { confirmed: true, method: '404', confidence: 0.95 };
      }

      if (resp.ok) {
        const html = await resp.text();
        const lowerHtml = html.toLowerCase();
        const hasSoldOutIndicator = SOLD_OUT_INDICATORS.some(indicator => lowerHtml.includes(indicator));
        
        if (hasSoldOutIndicator) {
          return { confirmed: true, method: 'content_check', confidence: 0.85 };
        }

        const isHomepage = lowerHtml.includes('<title>miss anne') || lowerHtml.includes('class="homepage"');
        if (isHomepage) {
          return { confirmed: true, method: 'content_check', confidence: 0.7 };
        }
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }

      return { confirmed: false, method: 'failed', confidence: 0 };
    } catch {
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return { confirmed: false, method: 'failed', confidence: 0 };
    }
  }

  return { confirmed: false, method: 'failed', confidence: 0 };
}

async function runScrape() {
  const scraped = await scrapeAll();
  const prevData = await getShopData();
  const now = new Date().toISOString();

  const scrapedIds = new Set(scraped.map((p) => p.id));
  const prevIds = new Set((prevData?.products || []).map((p) => p.id));

  const prevPending = prevData?.pending_sold || [];
  const prevSold = prevData?.sold_items || [];

  const confirmedSold: SoldItem[] = [...prevSold];
  let soldThisScrape = 0;
  let soldRevenueThisScrape = 0;

  const stillPending: PendingSoldItem[] = [];

  for (const pending of prevPending) {
    if (scrapedIds.has(pending.id)) {
      continue;
    }

    const newMissingCount = (pending.missing_count || 1) + 1;
    const now = new Date().toISOString();

    if (newMissingCount >= REQUIRED_MISSING_SCRAPES) {
      const verification = await verifyUrl(pending.product_url);
      
      if (verification.confirmed) {
        confirmedSold.push({
          id: pending.id,
          name: pending.name,
          price: pending.price,
          currency: pending.currency,
          image_url: pending.image_url,
          product_url: pending.product_url,
          first_seen_missing: pending.first_seen_missing,
          confirmed_at: now,
          missing_count: newMissingCount,
          confirmation_method: verification.method as '404' | 'content_check' | 'combined',
        });
        soldThisScrape++;
        soldRevenueThisScrape += pending.price;
        continue;
      } else {
        stillPending.push({
          ...pending,
          missing_count: newMissingCount,
          last_checked: now,
          verification_status: newMissingCount >= REQUIRED_MISSING_SCRAPES + 2 ? 'failed' : 'retry',
        });
      }
    } else {
      stillPending.push({
        ...pending,
        missing_count: newMissingCount,
        last_checked: now,
        verification_status: 'pending',
      });
    }
  }

  const newlyMissing: PendingSoldItem[] = [];
  if (prevData && prevData.products.length > 0) {
    for (const prevProduct of prevData.products) {
      if (!scrapedIds.has(prevProduct.id)) {
        const alreadySold = confirmedSold.some((s) => s.id === prevProduct.id);
        const alreadyPending = prevPending.some((p) => p.id === prevProduct.id) || stillPending.some((p) => p.id === prevProduct.id);
        if (!alreadySold && !alreadyPending) {
          newlyMissing.push({
            id: prevProduct.id,
            name: prevProduct.name,
            price: prevProduct.price,
            currency: prevProduct.currency || 'NZD',
            image_url: prevProduct.image_url,
            product_url: prevProduct.product_url,
            first_seen_missing: now,
            missing_count: 1,
            last_checked: null,
            verification_status: 'pending',
          });
        }
      }
    }
  }

  const allPending = [...stillPending, ...newlyMissing];

  const newItems = scraped
    .filter((p) => !prevIds.has(p.id))
    .map((p) => ({
      name: p.name,
      price: p.price,
      added_at: now,
    }));

  const totalSoldRevenue = confirmedSold.reduce((sum, item) => sum + item.price, 0);
  const prices = scraped.filter((p) => p.price > 0).map((p) => p.price);
  const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const history = prevData?.revenue_history || [];
  history.push({
    date: now,
    revenue: totalSoldRevenue,
    product_count: scraped.length,
    sold_this_scrape: soldThisScrape,
    sold_revenue_this_scrape: soldRevenueThisScrape,
    cumulative_sold: confirmedSold.length,
    new_this_scrape: newItems.length,
  });

  const shopData: ShopData = {
    products: scraped,
    total_products: scraped.length,
    estimated_revenue: totalSoldRevenue,
    avg_price: avg,
    last_scraped: now,
    revenue_history: history.slice(-90),
    sold_items: confirmedSold.slice(-200),
    pending_sold: allPending.slice(-50),
    new_items: [...(prevData?.new_items || []), ...newItems].slice(-100),
  };

  await saveShopData(shopData);

  return {
    products_found: scraped.length,
    sold_this_scrape: soldThisScrape,
    new_this_scrape: newItems.length,
    total_sold: confirmedSold.length,
    pending_sold: allPending.length,
    revenue: totalSoldRevenue,
  };
}

export async function GET() {
  try {
    const result = await runScrape();
    return NextResponse.json({ status: 'cron', ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runScrape();
    return NextResponse.json({ status: 'manual', ...result });
  } catch (e: any) {
    if (e.message === 'Database not configured') {
      return NextResponse.json({ error: 'Upstash Redis not connected.' }, { status: 500 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
