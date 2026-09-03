import { CompetitorItem, convertToNZD, calculateMatchScore, SOURCE_TYPES } from './projections';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 1000));
}

function extractPrice(text: string): number | null {
  const match = text.replace(/,/g, '').match(/\$?([\d]+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

async function fetchWithRetry(url: string, retries = 1): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      if (i < retries) await delay(2000 * (i + 1));
    }
  }
  return null;
}

export async function scrapeDepop(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.depop.com/search/?q=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const cardRegex = /<li[^>]*>[\s\S]*?<a[^>]*href="\/([^"]*\/)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/li>/g;
  const priceRegex = /[NZD$\u00a3]*\s*([\d,]+\.?\d*)/;
  const nameRegex = /alt="([^"]+)"/;

  let match;
  while ((match = cardRegex.exec(html)) !== null && items.length < 5) {
    const block = match[0];
    const nameMatch = block.match(nameRegex);
    const priceMatch = block.match(priceRegex);
    if (nameMatch && priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      items.push({
        source: 'depop',
        source_type: SOURCE_TYPES.depop,
        item_name: nameMatch[1],
        price,
        currency: 'NZD',
        url: `https://www.depop.com/${match[1]}`,
        condition: 'unknown',
        match_score: calculateMatchScore(query, nameMatch[1]),
        seller_location: '',
        shipping_cost: 0,
        total_cost: price,
        listed_date: '',
        sold_count: 0,
      });
    }
  }
  return items;
}

export async function scrapeEbay(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=12&LH_BIN=1`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const itemRegex = /<div class="s-item__info[^"]*">[\s\S]*?<span class="s-item__price"[^>]*>([^<]+)<\/span>[\s\S]*?<\/div>/g;
  const titleRegex = /<span role="heading"[^>]*>([^<]+)<\/span>/;

  let match;
  while ((match = itemRegex.exec(html)) !== null && items.length < 5) {
    const block = match[0];
    const titleMatch = block.match(titleRegex);
    const priceText = match[1];
    const price = extractPrice(priceText);

    if (titleMatch && price) {
      const name = titleMatch[1].trim();
      items.push({
        source: 'ebay',
        source_type: SOURCE_TYPES.ebay,
        item_name: name,
        price,
        currency: 'NZD',
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
        condition: 'unknown',
        match_score: calculateMatchScore(query, name),
        seller_location: '',
        shipping_cost: 0,
        total_cost: price,
        listed_date: '',
        sold_count: 0,
      });
    }
  }
  return items;
}

export async function scrapePoshmark(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://poshmark.com/search?query=${encodeURIComponent(query)}&type=listings`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const cardRegex = /<div[^>]*data-testid="listing-card"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g;
  const priceRegex = /\$([\d,]+\.?\d*)/;
  const nameRegex = /data-testid="listing-card-title"[^>]*>([^<]+)</;

  let match;
  while ((match = cardRegex.exec(html)) !== null && items.length < 5) {
    const block = match[0];
    const nameMatch = block.match(nameRegex);
    const priceMatch = block.match(priceRegex);
    if (nameMatch && priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      items.push({
        source: 'poshmark',
        source_type: SOURCE_TYPES.poshmark,
        item_name: nameMatch[1].trim(),
        price: convertToNZD(price, 'USD'),
        currency: 'NZD',
        url: `https://poshmark.com/search?query=${encodeURIComponent(query)}`,
        condition: 'unknown',
        match_score: calculateMatchScore(query, nameMatch[1]),
        seller_location: '',
        shipping_cost: 0,
        total_cost: convertToNZD(price, 'USD'),
        listed_date: '',
        sold_count: 0,
      });
    }
  }
  return items;
}

export async function scrapeMercari(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.mercari.com/search/?keyword=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const priceRegex = /\$([\d,]+\.?\d*)/g;
  const nameRegex = /"name":"([^"]+)"/g;

  const prices: number[] = [];
  const names: string[] = [];
  let pm;
  while ((pm = priceRegex.exec(html)) !== null && prices.length < 5) {
    prices.push(parseFloat(pm[1].replace(/,/g, '')));
  }
  let nm;
  while ((nm = nameRegex.exec(html)) !== null && names.length < 5) {
    names.push(nm[1]);
  }

  for (let i = 0; i < Math.min(prices.length, names.length, 5); i++) {
    items.push({
      source: 'mercari',
      source_type: SOURCE_TYPES.mercari,
      item_name: names[i],
      price: convertToNZD(prices[i], 'USD'),
      currency: 'NZD',
      url: `https://www.mercari.com/search/?keyword=${encodeURIComponent(query)}`,
      condition: 'unknown',
      match_score: calculateMatchScore(query, names[i]),
      seller_location: '',
      shipping_cost: 0,
      total_cost: convertToNZD(prices[i], 'USD'),
      listed_date: '',
      sold_count: 0,
    });
  }
  return items;
}

export async function scrapeVinted(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.vinted.com/catalog?search_text=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const priceRegex = /(?:EUR|€)\s*([\d,]+\.?\d*)/g;
  const nameRegex = /data-testid="grid-item-title"[^>]*>([^<]+)</g;

  const prices: number[] = [];
  const names: string[] = [];
  let pm;
  while ((pm = priceRegex.exec(html)) !== null && prices.length < 5) {
    prices.push(parseFloat(pm[1].replace(/,/g, '')));
  }
  let nm;
  while ((nm = nameRegex.exec(html)) !== null && names.length < 5) {
    names.push(nm[1].trim());
  }

  for (let i = 0; i < Math.min(prices.length, names.length, 5); i++) {
    items.push({
      source: 'vinted',
      source_type: SOURCE_TYPES.vinted,
      item_name: names[i],
      price: convertToNZD(prices[i], 'EUR'),
      currency: 'NZD',
      url: `https://www.vinted.com/catalog?search_text=${encodeURIComponent(query)}`,
      condition: 'unknown',
      match_score: calculateMatchScore(query, names[i]),
      seller_location: '',
      shipping_cost: 0,
      total_cost: convertToNZD(prices[i], 'EUR'),
      listed_date: '',
      sold_count: 0,
    });
  }
  return items;
}

export async function scrapeThredUp(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.thredup.com/search?q=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const priceRegex = /\$([\d,]+\.?\d*)/g;
  const nameRegex = /"title":"([^"]+)"/g;

  const prices: number[] = [];
  const names: string[] = [];
  let pm;
  while ((pm = priceRegex.exec(html)) !== null && prices.length < 5) {
    prices.push(parseFloat(pm[1].replace(/,/g, '')));
  }
  let nm;
  while ((nm = nameRegex.exec(html)) !== null && names.length < 5) {
    names.push(nm[1]);
  }

  for (let i = 0; i < Math.min(prices.length, names.length, 5); i++) {
    items.push({
      source: 'thredup',
      source_type: SOURCE_TYPES.thredup,
      item_name: names[i],
      price: convertToNZD(prices[i], 'USD'),
      currency: 'NZD',
      url: `https://www.thredup.com/search?q=${encodeURIComponent(query)}`,
      condition: 'unknown',
      match_score: calculateMatchScore(query, names[i]),
      seller_location: '',
      shipping_cost: 0,
      total_cost: convertToNZD(prices[i], 'USD'),
      listed_date: '',
      sold_count: 0,
    });
  }
  return items;
}

export async function scrapeEtsy(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.etsy.com/search?q=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const priceRegex = /(?:US|\$|NZD)\$?([\d,]+\.?\d*)/g;
  const nameRegex = /"title":"([^"]{5,80})"/g;

  const prices: number[] = [];
  const names: string[] = [];
  let pm;
  while ((pm = priceRegex.exec(html)) !== null && prices.length < 5) {
    prices.push(parseFloat(pm[1].replace(/,/g, '')));
  }
  let nm;
  while ((nm = nameRegex.exec(html)) !== null && names.length < 5) {
    names.push(nm[1]);
  }

  for (let i = 0; i < Math.min(prices.length, names.length, 5); i++) {
    items.push({
      source: 'etsy',
      source_type: SOURCE_TYPES.etsy,
      item_name: names[i],
      price: prices[i],
      currency: 'NZD',
      url: `https://www.etsy.com/search?q=${encodeURIComponent(query)}`,
      condition: 'new',
      match_score: calculateMatchScore(query, names[i]),
      seller_location: '',
      shipping_cost: 0,
      total_cost: prices[i],
      listed_date: '',
      sold_count: 0,
    });
  }
  return items;
}

export async function scrapeAmazon(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const priceRegex = /\$([\d,]+\.?\d*)/g;
  const nameRegex =/<span class="a-size-base-plus[^"]*"[^>]*>([^<]+)<\/span>/g;

  const prices: number[] = [];
  const names: string[] = [];
  let pm;
  while ((pm = priceRegex.exec(html)) !== null && prices.length < 5) {
    prices.push(parseFloat(pm[1].replace(/,/g, '')));
  }
  let nm;
  while ((nm = nameRegex.exec(html)) !== null && names.length < 5) {
    names.push(nm[1].trim());
  }

  for (let i = 0; i < Math.min(prices.length, names.length, 5); i++) {
    items.push({
      source: 'amazon',
      source_type: SOURCE_TYPES.amazon,
      item_name: names[i],
      price: convertToNZD(prices[i], 'USD'),
      currency: 'NZD',
      url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
      condition: 'new',
      match_score: calculateMatchScore(query, names[i]),
      seller_location: '',
      shipping_cost: 0,
      total_cost: convertToNZD(prices[i], 'USD'),
      listed_date: '',
      sold_count: 0,
    });
  }
  return items;
}

export async function scrapeTradeMe(query: string): Promise<CompetitorItem[]> {
  const html = await fetchWithRetry(`https://www.trademe.co.nz/a/search?search_string=${encodeURIComponent(query)}`);
  if (!html) return [];

  const items: CompetitorItem[] = [];
  const priceRegex = /\$([\d,]+\.?\d*)/g;
  const nameRegex = /<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/g;

  const prices: number[] = [];
  const names: string[] = [];
  let pm;
  while ((pm = priceRegex.exec(html)) !== null && prices.length < 5) {
    prices.push(parseFloat(pm[1].replace(/,/g, '')));
  }
  let nm;
  while ((nm = nameRegex.exec(html)) !== null && names.length < 5) {
    names.push(nm[1].trim());
  }

  for (let i = 0; i < Math.min(prices.length, names.length, 5); i++) {
    items.push({
      source: 'trademe',
      source_type: SOURCE_TYPES.trademe,
      item_name: names[i],
      price: prices[i],
      currency: 'NZD',
      url: `https://www.trademe.co.nz/a/search?search_string=${encodeURIComponent(query)}`,
      condition: 'unknown',
      match_score: calculateMatchScore(query, names[i]),
      seller_location: 'NZ',
      shipping_cost: 0,
      total_cost: prices[i],
      listed_date: '',
      sold_count: 0,
    });
  }
  return items;
}

export const SCRAPERS: Record<string, (query: string) => Promise<CompetitorItem[]>> = {
  depop: scrapeDepop,
  ebay: scrapeEbay,
  poshmark: scrapePoshmark,
  mercari: scrapeMercari,
  vinted: scrapeVinted,
  thredup: scrapeThredUp,
  etsy: scrapeEtsy,
  amazon: scrapeAmazon,
  trademe: scrapeTradeMe,
};

export const ALL_SOURCES = Object.keys(SCRAPERS);
