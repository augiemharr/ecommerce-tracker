import { NextResponse } from 'next/server';
import { getShopData, saveShopData, ShopData, SoldItem } from '@/lib/db';

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

async function runScrape() {
  const scraped = await scrapeAll();
  const prevData = await getShopData();
  const now = new Date().toISOString();

  const scrapedIds = new Set(scraped.map((p) => p.id));
  const prevIds = new Set((prevData?.products || []).map((p) => p.id));

  const prevSold = prevData?.sold_items || [];
  const confirmedSold: SoldItem[] = [...prevSold];
  let soldThisScrape = 0;
  let soldRevenueThisScrape = 0;

  const pendingToMigrate = prevData?.pending_sold || [];
  for (const pending of pendingToMigrate) {
    const alreadySold = confirmedSold.some((s) => s.id === pending.id);
    if (!alreadySold) {
      confirmedSold.push({
        id: pending.id,
        name: pending.name,
        price: pending.price,
        currency: pending.currency || 'NZD',
        image_url: pending.image_url,
        product_url: pending.product_url,
        detected_at: pending.first_seen_missing,
      });
    }
  }

  if (prevData && prevData.products.length > 0) {
    for (const prevProduct of prevData.products) {
      if (!scrapedIds.has(prevProduct.id)) {
        const alreadySold = confirmedSold.some((s) => s.id === prevProduct.id);
        if (!alreadySold) {
          confirmedSold.push({
            id: prevProduct.id,
            name: prevProduct.name,
            price: prevProduct.price,
            currency: prevProduct.currency || 'NZD',
            image_url: prevProduct.image_url,
            product_url: prevProduct.product_url,
            detected_at: now,
          });
          soldThisScrape++;
          soldRevenueThisScrape += prevProduct.price;
        }
      }
    }
  }

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
    new_items: [...(prevData?.new_items || []), ...newItems].slice(-100),
  };

  await saveShopData(shopData);

  return {
    products_found: scraped.length,
    sold_this_scrape: soldThisScrape,
    new_this_scrape: newItems.length,
    total_sold: confirmedSold.length,
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
