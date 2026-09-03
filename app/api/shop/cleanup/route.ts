import { NextResponse } from 'next/server';
import { getShopData, saveShopData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  const data = await getShopData();
  if (!data) return NextResponse.json({ error: 'No data found' });

  const targetDate = '8/26/2026';
  const targetUTC = '2026-08-25';
  const before = data.revenue_history.length;
  data.revenue_history = data.revenue_history.filter((h) => {
    const localDate = new Date(h.date).toLocaleDateString();
    const utcDate = h.date.slice(0, 10);
    return localDate !== targetDate && utcDate !== targetUTC;
  });
  const removed = before - data.revenue_history.length;

  await saveShopData(data);
  return NextResponse.json({ removed, remaining: data.revenue_history.length, keys: data.revenue_history.map(h => h.date) });
}
