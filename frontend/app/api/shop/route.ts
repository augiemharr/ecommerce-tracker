import { NextResponse } from 'next/server';
import { getShopData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getShopData();
  return NextResponse.json(data);
}
