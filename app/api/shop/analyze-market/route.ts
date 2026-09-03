import { NextResponse } from 'next/server';
import { getProjections, saveProjectionNotes, getProjectionNotes, ProjectionData } from '@/lib/projections';

export const dynamic = 'force-dynamic';

function generateAnalysis(data: ProjectionData): string {
  const s = data.summary;
  const lines: string[] = [];

  lines.push('# Market Projection Analysis — MissAnneShop');
  lines.push(`Generated: ${new Date(data.generated_at).toLocaleString()}`);
  lines.push(`Sources searched: ${data.total_sources_searched}`);
  lines.push('');

  lines.push('## 1. Executive Summary');
  lines.push(`MissAnneShop's average product price is NZ$${s.avg_missanne_price.toFixed(2)}.`);
  lines.push(`The overall market average is NZ$${s.avg_market_price.toFixed(2)}, and the resale market average is NZ$${s.avg_resale_price.toFixed(2)}.`);
  lines.push(`${s.items_below_market} items are priced below market, ${s.items_above_market} are above market.`);
  lines.push(`${s.items_competitive_in_resale} items are competitively priced in the resale market.`);
  lines.push('');

  lines.push('## 2. Resale Market Analysis');
  const resaleByCategory = new Map<string, { count: number; total: number }>();
  for (const p of data.products) {
    if (p.avg_resale_price > 0) {
      const cat = p.category;
      const entry = resaleByCategory.get(cat) || { count: 0, total: 0 };
      entry.count++;
      entry.total += p.avg_resale_price;
      resaleByCategory.set(cat, entry);
    }
  }
  for (const [cat, info] of resaleByCategory) {
    const avg = info.total / info.count;
    lines.push(`- ${cat}: avg resale price NZ$${avg.toFixed(2)} (${info.count} items)`);
  }
  lines.push('');

  const aboveResale = data.products.filter((p) => p.resale_price_position === 'above');
  const belowResale = data.products.filter((p) => p.resale_price_position === 'below');
  if (aboveResale.length > 0) {
    lines.push('Items priced above resale market:');
    for (const p of aboveResale.slice(0, 5)) {
      lines.push(`- ${p.product_name}: NZ$${p.missanne_price.toFixed(2)} vs resale avg NZ$${p.avg_resale_price.toFixed(2)} (+${p.potential_margin_pct.toFixed(0)}%)`);
    }
  }
  lines.push('');

  lines.push('## 3. New Item Market Analysis');
  const newByCategory = new Map<string, { count: number; total: number }>();
  for (const p of data.products) {
    if (p.avg_new_price > 0) {
      const cat = p.category;
      const entry = newByCategory.get(cat) || { count: 0, total: 0 };
      entry.count++;
      entry.total += p.avg_new_price;
      newByCategory.set(cat, entry);
    }
  }
  for (const [cat, info] of newByCategory) {
    const avg = info.total / info.count;
    lines.push(`- ${cat}: avg new price NZ$${avg.toFixed(2)} (${info.count} items)`);
  }
  const premiumItems = data.products.filter((p) => p.avg_new_price > 0 && p.missanne_price > p.avg_new_price);
  if (premiumItems.length > 0) {
    lines.push(`\n${premiumItems.length} items priced above new market average (possible brand premium).`);
  }
  lines.push('');

  lines.push('## 4. Top Opportunities');
  if (s.top_competitive_items.length > 0) {
    lines.push('Most competitively priced items:');
    for (const name of s.top_competitive_items) {
      const p = data.products.find((pp) => pp.product_name === name);
      if (p) lines.push(`- ${name}: NZ$${p.missanne_price.toFixed(2)} (market avg NZ$${p.avg_market_price.toFixed(2)})`);
    }
  }
  lines.push('');
  if (s.top_overpriced_items.length > 0) {
    lines.push('Items potentially overpriced:');
    for (const name of s.top_overpriced_items) {
      const p = data.products.find((pp) => pp.product_name === name);
      if (p) lines.push(`- ${name}: NZ$${p.missanne_price.toFixed(2)} vs market avg NZ$${p.avg_market_price.toFixed(2)}`);
    }
  }
  lines.push('');

  lines.push('## 5. Recommendations');
  const significantAbove = data.products.filter((p) => p.potential_margin_pct > 15);
  if (significantAbove.length > 0) {
    lines.push(`Consider adjusting prices on ${significantAbove.length} items that are >15% above resale market.`);
    for (const p of significantAbove.slice(0, 5)) {
      const suggested = (p.avg_resale_price * 1.05).toFixed(2);
      lines.push(`- ${p.product_name}: suggest NZ$${suggested} (currently NZ$${p.missanne_price.toFixed(2)})`);
    }
  } else {
    lines.push('Pricing appears competitive across most items.');
  }
  lines.push('');
  lines.push('Category-level positioning is shown in the charts above.');
  lines.push('');
  lines.push('---');
  lines.push('*This analysis is auto-generated from market data. Edit notes below to add your own insights.*');

  return lines.join('\n');
}

export async function POST() {
  try {
    const data = await getProjections();
    if (!data) {
      return NextResponse.json({ error: 'No projection data found. Run market analysis first.' }, { status: 400 });
    }

    const analysis = generateAnalysis(data);
    const existing = await getProjectionNotes();
    const notes = {
      generated_analysis: analysis,
      user_notes: existing?.user_notes || '',
    };

    await saveProjectionNotes(notes);
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const notes = await getProjectionNotes();
    return NextResponse.json(notes || { generated_analysis: '', user_notes: '' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
