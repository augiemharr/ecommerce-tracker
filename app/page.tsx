'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Package, DollarSign, ExternalLink, TrendingUp, ShoppingCart, TrendingDown, Minus, Copy, Download, Play, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, PieChart, Pie, Cell,
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

interface CompetitorItem {
  source: string;
  source_type: string;
  item_name: string;
  price: number;
  currency: string;
  url: string;
  condition: string;
  match_score: number;
  seller_location: string;
  shipping_cost: number;
  total_cost: number;
  listed_date: string;
  sold_count: number;
}

interface ProductProjection {
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

interface ProjectionData {
  generated_at: string;
  total_sources_searched: number;
  products: ProductProjection[];
  summary: {
    avg_missanne_price: number;
    avg_market_price: number;
    avg_resale_price: number;
    items_below_market: number;
    items_above_market: number;
    items_competitive_in_resale: number;
    top_competitive_items: string[];
    top_overpriced_items: string[];
  };
}

interface ProjectionNotes {
  generated_analysis: string;
  user_notes: string;
}

export default function Dashboard() {
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'name'>('price_desc');
  const [currency, setCurrency] = useState<'NZD' | 'USD' | 'PHP'>('NZD');
  const [tab, setTab] = useState<'products' | 'sold' | 'new' | 'projections'>('products');
  const [projections, setProjections] = useState<ProjectionData | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projProgress, setProjProgress] = useState('');
  const [projNotes, setProjNotes] = useState<ProjectionNotes | null>(null);
  const [projSearch, setProjSearch] = useState('');
  const [projCategory, setProjCategory] = useState<string>('all');
  const [projSort, setProjSort] = useState<'margin' | 'sources' | 'price_diff'>('margin');
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const rates = { NZD: 1, USD: 0.59, PHP: 33.2 };
  const symbols = { NZD: 'NZ$', USD: '$', PHP: '₱' };

  useEffect(() => { loadData(); loadProjections(); }, []);

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

  async function loadProjections() {
    try {
      const res = await fetch('/api/shop/project-market', { method: 'POST' });
      const json = await res.json();
      if (!json.error) setProjections(json);
    } catch {}
    try {
      const res = await fetch('/api/shop/analyze-market');
      const json = await res.json();
      if (json.generated_analysis) setProjNotes(json);
    } catch {}
  }

  async function runMarketAnalysis() {
    setProjLoading(true);
    setProjProgress('Starting market analysis...');
    try {
      const res = await fetch('/api/shop/project-market', { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        alert(`Error: ${json.error}`);
      } else {
        setProjections(json);
        setProjProgress('Generating analysis...');
        const analysisRes = await fetch('/api/shop/analyze-market', { method: 'POST' });
        const notes = await analysisRes.json();
        if (notes.generated_analysis) setProjNotes(notes);
      }
    } catch {
      alert('Market analysis failed');
    } finally {
      setProjLoading(false);
      setProjProgress('');
    }
  }

  async function saveUserNotes() {
    if (!projNotes || !notesRef.current) return;
    const updated = { ...projNotes, user_notes: notesRef.current.value };
    setProjNotes(updated);
    await fetch('/api/shop/analyze-market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  function copyAnalysis() {
    if (projNotes?.generated_analysis) {
      navigator.clipboard.writeText(projNotes.generated_analysis);
    }
  }

  function exportAnalysis() {
    if (!projNotes?.generated_analysis) return;
    const blob = new Blob([projNotes.generated_analysis], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missanne-market-analysis-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
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
      <header className="border-b border-gray-800 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Miss Anne Shop Tracker</h1>
            <a href="https://missanneshop.com" target="_blank" rel="noopener noreferrer"
              className="text-blue-400 text-sm flex items-center gap-1 hover:underline mt-1">
              missanneshop.com <ExternalLink size={12} />
            </a>
          </div>
          <button onClick={handleScrape} disabled={scraping}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-medium text-sm sm:text-base">
            <RefreshCw size={16} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'Scraping...' : 'Scrape Now'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
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

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'products', label: 'Products', count: filteredProducts.length },
                { key: 'sold', label: 'Sold', count: filteredSold.length },
                { key: 'new', label: 'New', count: filteredNew.length },
                { key: 'projections', label: 'Projections', count: projections?.products?.length || 0 },
              ] as const).map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
              <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                {(['NZD', 'USD', 'PHP'] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={`px-2 sm:px-3 py-1.5 text-sm font-medium transition-colors ${
                      currency === c ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}>{c}</button>
                ))}
              </div>
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1 sm:w-48 focus:outline-none focus:border-blue-500" />
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

          {tab === 'projections' && (
            <ProjectionsTab
              projections={projections}
              projLoading={projLoading}
              projProgress={projProgress}
              projNotes={projNotes}
              projSearch={projSearch}
              setProjSearch={setProjSearch}
              projCategory={projCategory}
              setProjCategory={setProjCategory}
              projSort={projSort}
              setProjSort={setProjSort}
              runMarketAnalysis={runMarketAnalysis}
              copyAnalysis={copyAnalysis}
              exportAnalysis={exportAnalysis}
              saveUserNotes={saveUserNotes}
              notesRef={notesRef}
              fmt={fmt}
            />
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Best Selling Categories</h2>
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.name} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="w-20 sm:w-24 text-sm font-medium text-gray-300 truncate">{cat.name}</div>
              <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded"
                  style={{ width: `${(cat.sold / maxSold) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 pl-24 sm:pl-0">
              <div className="w-16 text-right text-sm text-gray-400">{cat.sold} sold</div>
              <div className="w-24 sm:w-28 text-right text-sm text-green-400 font-medium">{fmt(cat.soldRevenue)}</div>
            </div>
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
    { label: 'Under $20', min: 0, max: 19.99 },
    { label: '$21-40', min: 20, max: 40 },
    { label: '$41-60', min: 40.01, max: 60 },
    { label: '$61-80', min: 60.01, max: 80 },
    { label: '$81-100', min: 80.01, max: 100 },
    { label: 'Over $100', min: 100.01, max: Infinity },
  ];

  const stats = ranges.map((r) => {
    const inStock = products.filter((p) => p.price >= r.min && p.price < r.max).length;
    const sold = soldItems.filter((p) => p.price >= r.min && p.price < r.max);
    const soldRevenue = sold.reduce((s, p) => s + p.price, 0);
    return { ...r, inStock, soldCount: sold.length, soldRevenue };
  });

  const maxCount = Math.max(...stats.map((s) => Math.max(s.inStock, s.soldCount)), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Price Range Performance</h2>
      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300">{s.label}</span>
              <span className="text-xs text-gray-500">{s.soldCount} sold / {s.inStock} stock</span>
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">Time to Sell</h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Avg</div>
          <div className="text-base sm:text-lg font-bold text-white">{formatTime(avgHours)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Fastest</div>
          <div className="text-base sm:text-lg font-bold text-green-400">{formatTime(fastest.hours)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Slowest</div>
          <div className="text-base sm:text-lg font-bold text-red-400">{formatTime(slowest.hours)}</div>
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
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

const PIE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#8b5cf6', '#14b8a6'];

function ProjectionsTab({
  projections, projLoading, projProgress, projNotes, projSearch, setProjSearch,
  projCategory, setProjCategory, projSort, setProjSort, runMarketAnalysis,
  copyAnalysis, exportAnalysis, saveUserNotes, notesRef, fmt,
}: {
  projections: ProjectionData | null;
  projLoading: boolean;
  projProgress: string;
  projNotes: ProjectionNotes | null;
  projSearch: string;
  setProjSearch: (s: string) => void;
  projCategory: string;
  setProjCategory: (s: string) => void;
  projSort: string;
  setProjSort: (s: 'margin' | 'sources' | 'price_diff') => void;
  runMarketAnalysis: () => void;
  copyAnalysis: () => void;
  exportAnalysis: () => void;
  saveUserNotes: () => void;
  notesRef: React.RefObject<HTMLTextAreaElement>;
  fmt: (n: number) => string;
}) {
  const s = projections?.summary;
  const lastProjected = projections?.generated_at
    ? Math.floor((Date.now() - new Date(projections.generated_at).getTime()) / 3600000)
    : null;

  const filteredProjections = (projections?.products || [])
    .filter((p) => projCategory === 'all' || p.category === projCategory)
    .filter((p) => !projSearch || p.product_name.toLowerCase().includes(projSearch.toLowerCase()))
    .sort((a, b) => {
      if (projSort === 'margin') return b.potential_margin_pct - a.potential_margin_pct;
      if (projSort === 'sources') return b.sources_found - a.sources_found;
      return Math.abs(b.potential_margin_pct) - Math.abs(a.potential_margin_pct);
    });

  const categories = [...new Set(projections?.products.map((p) => p.category) || [])];

  const scatterData = (projections?.products || []).map((p) => ({
    x: p.sources_found,
    y: p.avg_market_price > 0 ? ((p.missanne_price - p.avg_market_price) / p.avg_market_price) * 100 : 0,
    name: p.product_name,
    missanne: p.missanne_price,
    market: p.avg_market_price,
    z: p.competitors.length,
  }));

  const categoryData = categories.map((cat) => {
    const items = (projections?.products || []).filter((p) => p.category === cat);
    const missAnneAvg = items.reduce((s, p) => s + p.missanne_price, 0) / (items.length || 1);
    const marketAvg = items.filter((p) => p.avg_market_price > 0).reduce((s, p) => s + p.avg_market_price, 0) / (items.filter((p) => p.avg_market_price > 0).length || 1);
    const resaleAvg = items.filter((p) => p.avg_resale_price > 0).reduce((s, p) => s + p.avg_resale_price, 0) / (items.filter((p) => p.avg_resale_price > 0).length || 1);
    return { category: cat, MissAnne: missAnneAvg, Market: marketAvg, Resale: resaleAvg };
  });

  const sourceCounts = new Map<string, number>();
  for (const p of projections?.products || []) {
    for (const c of p.competitors) {
      sourceCounts.set(c.source, (sourceCounts.get(c.source) || 0) + 1);
    }
  }
  const sourcePieData = Array.from(sourceCounts.entries()).map(([name, value]) => ({ name, value }));

  const resaleVsNew = categories.map((cat) => {
    const items = (projections?.products || []).filter((p) => p.category === cat);
    const resaleAvg = items.filter((p) => p.avg_resale_price > 0).reduce((s, p) => s + p.avg_resale_price, 0) / (items.filter((p) => p.avg_resale_price > 0).length || 1);
    const newAvg = items.filter((p) => p.avg_new_price > 0).reduce((s, p) => s + p.avg_new_price, 0) / (items.filter((p) => p.avg_new_price > 0).length || 1);
    return { category: cat, Resale: resaleAvg, New: newAvg, Gap: newAvg - resaleAvg };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Market Projections</h2>
          {lastProjected !== null && (
            <p className="text-xs text-gray-500">Last projected: {lastProjected}h ago</p>
          )}
        </div>
        <button onClick={runMarketAnalysis} disabled={projLoading}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-medium text-sm">
          <Play size={16} className={projLoading ? 'animate-spin' : ''} />
          {projLoading ? projProgress || 'Analyzing...' : 'Run Market Analysis'}
        </button>
      </div>

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={<DollarSign size={18} />} label="Avg Market" value={fmt(s.avg_market_price)} />
          <StatCard icon={<TrendingUp size={18} />} label="Avg Resale" value={fmt(s.avg_resale_price)} />
          <StatCard icon={<TrendingDown size={18} />} label="Below Market" value={`${s.items_below_market}`} color="green" />
          <StatCard icon={<TrendingUp size={18} />} label="Above Market" value={`${s.items_above_market}`} color="red" />
          <StatCard icon={<BarChart3 size={18} />} label="Competitive" value={`${s.items_competitive_in_resale}`} />
          <StatCard icon={<Package size={18} />} label="Sources" value={`${projections?.total_sources_searched || 0}`} />
        </div>
      )}

      {scatterData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Price Position vs Competitor Count</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" dataKey="x" name="Sources" stroke="#6b7280" tick={{ fontSize: 11 }} label={{ value: 'Sources Found', position: 'bottom', fill: '#6b7280', fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" name="% vs Market" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                    formatter={(val: number, name: string) => {
                      if (name === '% vs Market') return [`${val.toFixed(1)}%`, name];
                      return [val, name];
                    }}
                    labelFormatter={() => ''}
                  />
                  <Scatter data={scatterData} fill="#3b82f6">
                    {scatterData.map((entry, i) => (
                      <Cell key={i} fill={entry.y < -10 ? '#22c55e' : entry.y > 10 ? '#ef4444' : '#eab308'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded" />Below market</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded" />At market</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded" />Above market</span>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Category Price Comparison</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="category" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} formatter={(val: number) => [fmt(val)]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="MissAnne" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Market" fill="#6b7280" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Resale" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {sourcePieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Source Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourcePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {sourcePieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Resale vs New Price Gap</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resaleVsNew}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="category" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} formatter={(val: number) => [fmt(val)]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Resale" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="New" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-400">Market Analysis</h3>
          <div className="flex gap-2">
            <button onClick={copyAnalysis} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 flex items-center gap-1 transition-colors">
              <Copy size={12} /> Copy
            </button>
            <button onClick={exportAnalysis} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 flex items-center gap-1 transition-colors">
              <Download size={12} /> Export
            </button>
          </div>
        </div>
        <div className="bg-gray-950 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">{projNotes?.generated_analysis || 'Run market analysis to generate insights.'}</pre>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Your Notes</label>
          <textarea
            ref={notesRef}
            defaultValue={projNotes?.user_notes || ''}
            onBlur={saveUserNotes}
            placeholder="Add your own notes and projections..."
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 h-32 resize-none focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {filteredProjections.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-400">Product Market Cards</h3>
            <div className="flex gap-2 flex-wrap">
              <select value={projCategory} onChange={(e) => setProjCategory(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm">
                <option value="all">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={projSort} onChange={(e) => setProjSort(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm">
                <option value="margin">By Margin</option>
                <option value="sources">By Sources</option>
                <option value="price_diff">By Price Diff</option>
              </select>
              <input type="text" placeholder="Search products..." value={projSearch} onChange={(e) => setProjSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjections.map((p) => (
              <ProductMarketCard key={p.product_id} projection={p} fmt={fmt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductMarketCard({ projection: p, fmt }: { projection: ProductProjection; fmt: (n: number) => string }) {
  const posColor = p.price_position === 'below' ? 'text-green-400' : p.price_position === 'above' ? 'text-red-400' : 'text-yellow-400';
  const posIcon = p.price_position === 'below' ? <TrendingDown size={14} /> : p.price_position === 'above' ? <TrendingUp size={14} /> : <Minus size={14} />;
  const range = p.market_range.max - p.market_range.min || 1;
  const missannePos = p.missanne_price - p.market_range.min;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium text-sm text-white truncate flex-1 mr-2">{p.product_name}</h4>
        <span className={`flex items-center gap-1 text-xs font-medium ${posColor}`}>
          {posIcon} {p.price_position}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">MissAnne</span>
          <span className="text-white font-semibold">{fmt(p.missanne_price)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Market Avg</span>
          <span className="text-gray-300">{p.avg_market_price > 0 ? fmt(p.avg_market_price) : '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Resale Avg</span>
          <span className="text-green-400">{p.avg_resale_price > 0 ? fmt(p.avg_resale_price) : '—'}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden relative">
          <div className="absolute h-full bg-gray-600 rounded-full" style={{ left: 0, width: '100%' }} />
          {range > 0 && (
            <div className="absolute h-full w-1 bg-white rounded-full" style={{ left: `${(missannePos / range) * 100}%` }} />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>{fmt(p.market_range.min)}</span>
          <span>{fmt(p.market_range.max)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{p.competitors.length} competitors</span>
        <span>{p.sources_found} sources</span>
        <span className={p.potential_margin_pct > 0 ? 'text-red-400' : 'text-green-400'}>
          {p.potential_margin_pct > 0 ? '+' : ''}{p.potential_margin_pct.toFixed(0)}%
        </span>
      </div>

      {p.competitors.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-1">
          {p.competitors.slice(0, 3).map((c, i) => (
            <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between text-xs hover:bg-gray-700/50 rounded px-2 py-1 transition-colors">
              <span className="text-gray-400 truncate flex-1 mr-2">{c.source}</span>
              <span className="text-gray-300">{fmt(c.total_cost)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
