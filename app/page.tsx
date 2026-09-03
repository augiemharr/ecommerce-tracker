'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Package, DollarSign, ExternalLink, TrendingUp, ShoppingCart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  product_url: string;
}

interface SoldItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  product_url: string;
  detected_at: string;
}

interface HistoryEntry {
  date: string;
  revenue: number;
  product_count: number;
  sold_this_scrape: number;
  sold_revenue_this_scrape: number;
  cumulative_sold: number;
  new_this_scrape: number;
}

interface ShopData {
  products: Product[];
  total_products: number;
  estimated_revenue: number;
  avg_price: number;
  last_scraped: string;
  revenue_history: HistoryEntry[];
  sold_items: SoldItem[];
  new_items: { name: string; price: number; added_at: string }[];
}

export default function Dashboard() {
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'name'>('price_desc');
  const [currency, setCurrency] = useState<'NZD' | 'USD' | 'PHP'>('NZD');
  const [tab, setTab] = useState<'products' | 'sold' | 'new'>('products');

  const rates = { NZD: 1, USD: 0.59, PHP: 33.2 };
  const symbols = { NZD: 'NZ$', USD: '$', PHP: '₱' };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!scraping) handleScrape();
    }, 300000);
    return () => clearInterval(interval);
  }, [scraping]);

  async function loadData() {
    try {
      const res = await fetch('/api/shop');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleScrape() {
    setScraping(true);
    try {
      const res = await fetch('/api/shop/scrape', { method: 'POST' });
      const result = await res.json();
      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        await loadData();
        if (result.total_sold > 0) {
          alert(`Scraped ${result.products_found} products.\n${result.sold_this_scrape} sold since last scrape.\n${result.new_this_scrape} new items listed.\nTotal sold: ${result.total_sold}`);
        }
      }
    } catch (err) {
      alert('Scraping failed');
    } finally {
      setScraping(false);
    }
  }

  function fmt(nzd: number) {
    const converted = nzd * rates[currency];
    return `${symbols[currency]}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtShort(nzd: number) {
    const converted = nzd * rates[currency];
    if (converted >= 1000) return `${symbols[currency]}${(converted / 1000).toFixed(1)}k`;
    return `${symbols[currency]}${converted.toFixed(0)}`;
  }

  const totalSoldRevenue = (data?.sold_items || []).reduce((sum, item) => sum + item.price, 0);

  const chartData = (() => {
    const byDay = new Map<string, HistoryEntry[]>();
    for (const h of data?.revenue_history || []) {
      const day = new Date(h.date).toLocaleDateString();
      const arr = byDay.get(day) || [];
      arr.push(h);
      byDay.set(day, arr);
    }
    return Array.from(byDay.entries()).map(([day, entries]) => {
      const revenues = entries.map((e) => e.sold_revenue_this_scrape || 0);
      const open = entries[0].revenue;
      const close = entries[entries.length - 1].revenue;
      const high = Math.max(...revenues);
      const low = Math.min(...revenues);
      return {
        date: day,
        open,
        high,
        low,
        close,
        body: Math.abs(close - open),
        revenue: entries[entries.length - 1].revenue,
        cumulative_sold: entries[entries.length - 1].cumulative_sold,
        product_count: entries[entries.length - 1].product_count,
        sold_this_scrape: entries.reduce((s, e) => s + (e.sold_this_scrape || 0), 0),
        new_this_scrape: entries.reduce((s, e) => s + (e.new_this_scrape || 0), 0),
        sold_revenue_this_scrape: entries.reduce((s, e) => s + (e.sold_revenue_this_scrape || 0), 0),
      };
    });
  })();

  const filteredProducts = (data?.products || [])
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'price_asc') return a.price - b.price;
      return a.name.localeCompare(b.name);
    });

  const filteredSold = (data?.sold_items || [])
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());

  const filteredNew = (data?.new_items || [])
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Miss Anne Shop Tracker</h1>
            <a href="https://missanneshop.com" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 text-sm flex items-center gap-1 hover:underline mt-1">
              missanneshop.com <ExternalLink size={12} />
            </a>
          </div>
          <button onClick={handleScrape} disabled={scraping}
            className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-medium">
            <RefreshCw size={18} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'Scraping...' : 'Scrape Now'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Package size={20} />} label="Products" value={data?.total_products?.toLocaleString() || '0'} />
          <StatCard icon={<ShoppingCart size={20} />} label="Sold" value={String(data?.sold_items?.length || 0)} color="red" />
          <StatCard icon={<TrendingUp size={20} />} label="Revenue" value={fmt(totalSoldRevenue)} color="green" />
          <StatCard icon={<DollarSign size={20} />} label="Avg Price" value={fmt(data?.avg_price || 0)} />
        </div>

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 mb-4">Revenue Per Day</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                      formatter={(val: number) => [fmt(val), 'Revenue']}
                    />
                    <Bar dataKey="sold_revenue_this_scrape" name="Revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 mb-4">Items Sold per Day</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sold_this_scrape" name="Sold" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="new_this_scrape" name="New" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <CategoryAnalysis products={data?.products || []} soldItems={data?.sold_items || []} fmt={fmt} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PriceRangeAnalysis soldItems={data?.sold_items || []} products={data?.products || []} fmt={fmt} />
          <TimeToSellAnalysis soldItems={data?.sold_items || []} fmt={fmt} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NewVsOldPerformance soldItems={data?.sold_items || []} newItems={data?.new_items || []} products={data?.products || []} fmt={fmt} />
          <RevenueTrend revenueHistory={data?.revenue_history || []} fmt={fmt} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              {([
                { key: 'products', label: 'Products', count: filteredProducts.length },
                { key: 'sold', label: 'Sold', count: filteredSold.length },
                { key: 'new', label: 'New', count: filteredNew.length },
              ] as const).map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                {(['NZD', 'USD', 'PHP'] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      currency === c ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}>{c}</button>
                ))}
              </div>
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-blue-500" />
              {tab === 'products' && (
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm">
                  <option value="price_desc">Price: High to Low</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="name">Name A-Z</option>
                </select>
              )}
            </div>
          </div>

          {tab === 'products' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <a key={product.id} href={product.product_url} target="_blank" rel="noopener noreferrer"
                  className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 transition-colors group">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover rounded mb-2" />
                  )}
                  <h3 className="font-medium text-sm truncate group-hover:text-blue-400 transition-colors">{product.name}</h3>
                  <div className="text-green-400 font-semibold mt-1">{fmt(product.price)}</div>
                </a>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-500">
                  {data?.products.length === 0 ? 'No products yet. Click "Scrape Now".' : 'No products match your search.'}
                </div>
              )}
            </div>
          )}

          {tab === 'sold' && (
            <div className="space-y-2">
              {filteredSold.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No sold items detected yet. Items that disappear from the shop will appear here.
                </div>
              )}
              {filteredSold.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center gap-4 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <span className="text-xs text-gray-500">Detected {new Date(item.detected_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-red-400 font-semibold">{fmt(item.price)}</div>
                  <a href={item.product_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                    <ExternalLink size={14} className="text-gray-400" />
                  </a>
                </div>
              ))}
            </div>
          )}

          {tab === 'new' && (
            <div className="space-y-2">
              {filteredNew.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No new items detected yet. Scrape again later to compare.
                </div>
              )}
              {filteredNew.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-green-900/10 border border-green-900/20 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <span className="text-xs text-gray-500">Added {new Date(item.added_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-green-400 font-semibold">{fmt(item.price)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color = 'default' }: {
  icon: React.ReactNode; label: string; value: string; color?: 'default' | 'red' | 'green';
}) {
  return (
    <div className={`border rounded-xl p-4 ${
      color === 'green' ? 'bg-green-900/20 border-green-900/30' :
      color === 'red' ? 'bg-red-900/20 border-red-900/30' :
      'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">{icon}{label}</div>
      <div className={`text-xl font-bold ${
        color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : ''
      }`}>{value}</div>
    </div>
  );
}

function categorize(name: string): string {
  const lower = name.toLowerCase();
  if (/jacket|coat|outer|hoodie|blazer/.test(lower)) return 'Jackets';
  if (/jeans|pants|trousers|legging|shorts|skirt|bootcut|lowrise/.test(lower)) return 'Bottoms';
  if (/dress|gown|romper|jumpsuit/.test(lower)) return 'Dresses';
  if (/bag|purse|tote|clutch|backpack/.test(lower)) return 'Bags';
  if (/necklace|earring|bracelet|ring|jewelry|chain/.test(lower)) return 'Jewelry';
  if (/hat|cap|beanie|headband/.test(lower)) return 'Accessories';
  if (/top|tee|shirt|tank|blouse|crop|bodysuit|sweater|cardigan|polo/.test(lower)) return 'Tops';
  return 'Other';
}

function CategoryAnalysis({ products, soldItems, fmt }: { products: any[]; soldItems: any[]; fmt: (n: number) => string }) {
  const stats = new Map<string, { count: number; revenue: number; sold: number; soldRevenue: number }>();

  for (const p of products) {
    const cat = categorize(p.name);
    const s = stats.get(cat) || { count: 0, revenue: 0, sold: 0, soldRevenue: 0 };
    s.count++;
    s.revenue += p.price;
    stats.set(cat, s);
  }

  for (const item of soldItems) {
    const cat = categorize(item.name);
    const s = stats.get(cat) || { count: 0, revenue: 0, sold: 0, soldRevenue: 0 };
    s.sold++;
    s.soldRevenue += item.price;
    stats.set(cat, s);
  }

  const categories = Array.from(stats.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.sold - a.sold);

  const maxSold = Math.max(...categories.map((c) => c.sold), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Best Selling Categories</h2>
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.name} className="flex items-center gap-4">
            <div className="w-24 text-sm font-medium text-gray-300 truncate">{cat.name}</div>
            <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded"
                style={{ width: `${(cat.sold / maxSold) * 100}%` }}
              />
            </div>
            <div className="w-16 text-right text-sm text-gray-400">{cat.sold} sold</div>
            <div className="w-28 text-right text-sm text-green-400 font-medium">{fmt(cat.soldRevenue)}</div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="text-center py-6 text-gray-500">No data yet</div>
        )}
      </div>
    </div>
  );
}

function PriceRangeAnalysis({ soldItems, products, fmt }: { soldItems: any[]; products: any[]; fmt: (n: number) => string }) {
  const ranges = [
    { label: '$0-20', min: 0, max: 20 },
    { label: '$20-40', min: 20, max: 40 },
    { label: '$40-60', min: 40, max: 60 },
    { label: '$60-80', min: 60, max: 80 },
    { label: '$80-100', min: 80, max: 100 },
    { label: '$100+', min: 100, max: Infinity },
  ];

  const stats = ranges.map((r) => {
    const inStock = products.filter((p) => p.price >= r.min && p.price < r.max).length;
    const sold = soldItems.filter((p) => p.price >= r.min && p.price < r.max);
    const soldRevenue = sold.reduce((s, p) => s + p.price, 0);
    return { ...r, inStock, soldCount: sold.length, soldRevenue };
  });

  const maxCount = Math.max(...stats.map((s) => Math.max(s.inStock, s.soldCount)), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Price Range Performance</h2>
      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300">{s.label}</span>
              <span className="text-xs text-gray-500">{s.soldCount} sold / {s.inStock} in stock</span>
            </div>
            <div className="flex gap-1 h-4">
              <div className="bg-blue-600 rounded-l" style={{ width: `${(s.inStock / maxCount) * 100}%` }} />
              <div className="bg-red-500 rounded-r" style={{ width: `${(s.soldCount / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-600 rounded" />In Stock</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded" />Sold</span>
      </div>
    </div>
  );
}

function TimeToSellAnalysis({ soldItems, fmt }: { soldItems: any[]; fmt: (n: number) => string }) {
  if (soldItems.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">Time to Sell</h2>
        <div className="text-center py-6 text-gray-500">No sold items yet</div>
      </div>
    );
  }

  const now = new Date();
  const times = soldItems.map((item) => {
    const detected = new Date(item.detected_at);
    const hours = (now.getTime() - detected.getTime()) / (1000 * 60 * 60);
    return { name: item.name, hours, price: item.price };
  });

  const avgHours = times.reduce((s, t) => s + t.hours, 0) / times.length;
  const fastest = times.reduce((a, b) => (a.hours < b.hours ? a : b));
  const slowest = times.reduce((a, b) => (a.hours > b.hours ? a : b));

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Time to Sell</h2>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Avg</div>
          <div className="text-lg font-bold text-white">{formatTime(avgHours)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Fastest</div>
          <div className="text-lg font-bold text-green-400">{formatTime(fastest.hours)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Slowest</div>
          <div className="text-lg font-bold text-red-400">{formatTime(slowest.hours)}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500 text-center">{soldItems.length} items tracked</div>
    </div>
  );
}

function NewVsOldPerformance({ soldItems, newItems, products, fmt }: { soldItems: any[]; newItems: any[]; products: any[]; fmt: (n: number) => string }) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentNew = newItems.filter((n) => new Date(n.added_at) >= sevenDaysAgo);
  const olderNew = newItems.filter((n) => new Date(n.added_at) < sevenDaysAgo);

  const recentSold = soldItems.filter((s) => new Date(s.detected_at) >= sevenDaysAgo);
  const olderSold = soldItems.filter((s) => new Date(s.detected_at) < sevenDaysAgo);

  const recentRate = recentNew.length > 0 ? (recentSold.length / recentNew.length * 100) : 0;
  const olderRate = olderNew.length > 0 ? (olderSold.length / olderNew.length * 100) : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">New vs Old Performance</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-300">Last 7 Days</div>
            <div className="text-xs text-gray-500">{recentNew.length} new items</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-400">{recentSold.length} sold</div>
            <div className="text-xs text-gray-500">{recentRate.toFixed(0)}% sell-through</div>
          </div>
        </div>
        <div className="h-px bg-gray-800" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-300">Older Items</div>
            <div className="text-xs text-gray-500">{olderNew.length} items</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-400">{olderSold.length} sold</div>
            <div className="text-xs text-gray-500">{olderRate.toFixed(0)}% sell-through</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueTrend({ revenueHistory, fmt }: { revenueHistory: any[]; fmt: (n: number) => string }) {
  if (revenueHistory.length < 2) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">Revenue Trend</h2>
        <div className="text-center py-6 text-gray-500">Need more data</div>
      </div>
    );
  }

  const byDay = new Map<string, number>();
  for (const h of revenueHistory) {
    const day = new Date(h.date).toLocaleDateString();
    byDay.set(day, (byDay.get(day) || 0) + (h.sold_revenue_this_scrape || 0));
  }

  const days = Array.from(byDay.entries()).map(([date, revenue]) => ({ date, revenue }));
  const revenues = days.map((d) => d.revenue);
  const avg = revenues.reduce((s, r) => s + r, 0) / revenues.length;

  const recentAvg = revenues.slice(-3).reduce((s, r) => s + r, 0) / Math.min(revenues.length, 3);
  const olderAvg = revenues.slice(0, -3).reduce((s, r) => s + r, 0) / Math.max(revenues.length - 3, 1);
  const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'flat';

  const maxRev = Math.max(...revenues, 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Revenue Trend</h2>
      <div className="flex items-end gap-1 h-24 mb-2">
        {days.map((d, i) => (
          <div key={i} className="flex-1 bg-blue-600 rounded-t" style={{ height: `${(d.revenue / maxRev) * 100}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-3">
        <span>{days[0]?.date}</span>
        <span>{days[days.length - 1]?.date}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Daily Avg</div>
          <div className="text-sm font-bold text-white">{fmt(avg)}</div>
        </div>
        <div className={`text-sm font-bold ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
          {trend === 'up' ? '↑ Trending Up' : trend === 'down' ? '↓ Trending Down' : '→ Flat'}
        </div>
      </div>
    </div>
  );
}
