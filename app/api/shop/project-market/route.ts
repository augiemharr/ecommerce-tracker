import { NextResponse } from 'next/server';
import { getShopData } from '@/lib/db';
import { getProjections, saveProjections, ProjectionData, ProductProjection } from '@/lib/projections';
import { SCRAPERS, ALL_SOURCES } from '@/lib/scrapers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function projectProduct(product: { id: string; name: string; price: number }): Promise<ProductProjection> {
  const allCompetitors: Awaited<ReturnType<typeof SCRAPERS[string]>>[number][] = [];
  const sourcesSearched: string[] = [];
  const sourcesFailed: string[] = [];

  for (const source of ALL_SOURCES) {
    try {
      const scraper = SCRAPERS[source];
      const results = await scraper(product.name);
      if (results.length > 0) {
        allCompetitors.push(...results);
        sourcesSearched.push(source);
      } else {
        sourcesFailed.push(source);
      }
      await delay(1500 + Math.random() * 1500);
    } catch {
      sourcesFailed.push(source);
    }
  }

  const resaleCompetitors = allCompetitors.filter((c) => c.source_type === 'resale');
  const newItemCompetitors = allCompetitors.filter((c) => c.source_type === 'new_marketplace');

  const avgMarketPrice = allCompetitors.length > 0
    ? allCompetitors.reduce((s, c) => s + c.total_cost, 0) / allCompetitors.length
    : 0;
  const avgResalePrice = resaleCompetitors.length > 0
    ? resaleCompetitors.reduce((s, c) => s + c.total_cost, 0) / resaleCompetitors.length
    : 0;
  const avgNewPrice = newItemCompetitors.length > 0
    ? newItemCompetitors.reduce((s, c) => s + c.total_cost, 0) / newItemCompetitors.length
    : 0;

  const prices = allCompetitors.map((c) => c.total_cost);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const medianPrice = median(prices);

  const pricePosition: 'below' | 'at' | 'above' =
    avgMarketPrice === 0 ? 'at' :
    product.price < avgMarketPrice * 0.9 ? 'below' :
    product.price > avgMarketPrice * 1.1 ? 'above' : 'at';

  const resalePricePosition: 'below' | 'at' | 'above' =
    avgResalePrice === 0 ? 'at' :
    product.price < avgResalePrice * 0.9 ? 'below' :
    product.price > avgResalePrice * 1.1 ? 'above' : 'at';

  const potentialMarginPct = avgMarketPrice > 0
    ? ((product.price - avgMarketPrice) / avgMarketPrice) * 100
    : 0;

  return {
    product_id: product.id,
    product_name: product.name,
    category: categorizeProjection(product.name),
    missanne_price: product.price,
    competitors: allCompetitors,
    resale_competitors: resaleCompetitors,
    new_item_competitors: newItemCompetitors,
    avg_market_price: avgMarketPrice,
    avg_resale_price: avgResalePrice,
    avg_new_price: avgNewPrice,
    price_position: pricePosition,
    resale_price_position: resalePricePosition,
    potential_margin_pct: potentialMarginPct,
    market_range: { min: minPrice, max: maxPrice, median: medianPrice },
    sources_found: sourcesSearched.length,
    resale_sources_found: resaleCompetitors.length,
  };
}

function categorizeProjection(name: string): string {
  const lower = name.toLowerCase();
  if (/jacket|coat|outer|hoodie|blazer/.test(lower)) return 'Jackets';
  if (/jeans|pants|trousers|legging|shorts|skirt|bootcut|lowrise/.test(lower)) return 'Bottoms';
  if (/top|tee|shirt|tank|blouse|crop|bodysuit|sweater|cardigan|polo/.test(lower)) return 'Tops';
  return 'Other';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const productIds: string[] | undefined = body.product_ids;

    const existing = await getProjections();
    if (existing) {
      const age = Date.now() - new Date(existing.generated_at).getTime();
      if (age < 24 * 60 * 60 * 1000 && !productIds) {
        return NextResponse.json({ ...existing, cached: true });
      }
    }

    const shopData = await getShopData();
    if (!shopData || shopData.products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 400 });
    }

    const products = productIds
      ? shopData.products.filter((p) => productIds.includes(p.id))
      : shopData.products;

    const projections: ProductProjection[] = [];
    const batchSize = 3;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(projectProduct));
      projections.push(...results);
    }

    const allPrices = projections.map((p) => p.missanne_price);
    const allMarketPrices = projections.filter((p) => p.avg_market_price > 0).map((p) => p.avg_market_price);
    const allResalePrices = projections.filter((p) => p.avg_resale_price > 0).map((p) => p.avg_resale_price);

    const itemsBelowMarket = projections.filter((p) => p.price_position === 'below').length;
    const itemsAboveMarket = projections.filter((p) => p.price_position === 'above').length;
    const itemsCompetitiveResale = projections.filter((p) => p.resale_price_position === 'below').length;

    const sortedByMargin = [...projections].sort((a, b) => a.potential_margin_pct - b.potential_margin_pct);

    const summary = {
      avg_missanne_price: allPrices.reduce((s, p) => s + p, 0) / allPrices.length || 0,
      avg_market_price: allMarketPrices.reduce((s, p) => s + p, 0) / allMarketPrices.length || 0,
      avg_resale_price: allResalePrices.reduce((s, p) => s + p, 0) / allResalePrices.length || 0,
      items_below_market: itemsBelowMarket,
      items_above_market: itemsAboveMarket,
      items_competitive_in_resale: itemsCompetitiveResale,
      top_competitive_items: sortedByMargin.slice(0, 5).map((p) => p.product_name),
      top_overpriced_items: sortedByMargin.slice(-5).reverse().map((p) => p.product_name),
    };

    const projectionData: ProjectionData = {
      generated_at: new Date().toISOString(),
      total_sources_searched: ALL_SOURCES.length,
      products: projections,
      summary,
    };

    await saveProjections(projectionData);

    return NextResponse.json(projectionData);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
