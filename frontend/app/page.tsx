'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Package, DollarSign, ExternalLink, AlertTriangle, Sparkles } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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
  first_seen_missing: string;
  confirmed_at: string | null;
  missing_count: number;
  confirmation_method: '404' | 'content_check' | 'combined';
}

interface PendingSoldItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image_url: string | null;
  product_url: string;
  first_seen_missing: string;
  missing_count: number;
  last_checked: string | null;
  verification_status: 'pending' | 'retry' | 'failed';
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
  pending_sold: PendingSoldItem[];
  new_items: { name: string; price: number; added_at: string }[];
}

export default function Dashboard() {
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'name'>('price_desc');
  const [currency, setCurrency] = useState<'NZD' | 'USD' | 'PHP'>('NZD');
  const [tab, setTab] = useState<'products' | 'sold' | 'pending' | 'new'>('products');

  const rates = { NZD: 1, USD: 0.59, PHP: 33.2 };
  const symbols = { NZD: 'NZ$', USD: '$', PHP: '₱' };

  useEffect(() => { loadData(); }, []);

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
        if (result.total_sold_tracked > 0) {
          alert(`Scraped ${result.products_found} products.\n${result.sold_this_scrape} items sold since last scrape.\n${result.new_this_scrape} new items listed.\nTotal sold: ${result.total_sold_tracked}`);
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
      const last = entries[entries.length - 1];
      return {
        ...last,
        date: day,
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
    .sort((a, b) => new Date(b.confirmed_at || b.first_seen_missing).getTime() - new Date(a.confirmed_at || a.first_seen_missing).getTime());

  const filteredPending = (data?.pending_sold || [])
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.first_seen_missing).getTime() - new Date(a.first_seen_missing).getTime());

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={<Package size={20} />} label="Total Products" value={data?.total_products?.toLocaleString() || '0'} />
          <StatCard icon={<DollarSign size={20} />} label="Avg Price" value={fmt(data?.avg_price || 0)} />
          <StatCard icon={<AlertTriangle size={20} />} label="Missing" value={String(data?.pending_sold?.length || 0)} pending />
          <StatCard icon={<AlertTriangle size={20} />} label="Confirmed Sold" value={String(data?.sold_items?.length || 0)} sold />
          <StatCard icon={<Sparkles size={20} />} label="Revenue from Sold" value={fmt(totalSoldRevenue)} highlight />
        </div>

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Revenue per Day</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(val: number) => [fmt(val), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="sold_revenue_this_scrape" stroke="#22c55e" fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Sold Items per Scrape</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div style={{ backgroundColor: '#1f2937', border: '1px solid #374151', padding: '8px' }}>
                            <p style={{ color: '#9ca3af', marginBottom: 4 }}>{label}</p>
                            {payload.map((entry, i) => (
                              <p key={i} style={{ color: entry.color, margin: 0 }}>
                                {entry.dataKey === 'sold_this_scrape' ? 'Sold' : 'New'} : {entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar dataKey="sold_this_scrape" name="Sold" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="new_this_scrape" name="New" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">Cumulative Sold Items</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      formatter={(val: number) => [val, 'Total Sold']}
                    />
                    <Area type="monotone" dataKey="cumulative_sold" stroke="#f97316" fillOpacity={1} fill="url(#colorSold)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              {([
                { key: 'products', label: 'Products', count: filteredProducts.length },
                { key: 'pending', label: 'Missing', count: filteredPending.length },
                { key: 'sold', label: 'Confirmed Sold', count: filteredSold.length },
                { key: 'new', label: 'New Listings', count: filteredNew.length },
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

          {tab === 'pending' && (
            <div className="space-y-2">
              {filteredPending.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No missing items. All products accounted for. Items need 3+ scrapes missing to be confirmed as sold.
                </div>
              )}
              {filteredPending.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center gap-4 p-3 bg-yellow-900/10 border border-yellow-900/20 rounded-lg">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Missing since {new Date(item.first_seen_missing).toLocaleDateString()}</span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        item.verification_status === 'failed' ? 'bg-red-900/30 text-red-400' :
                        item.verification_status === 'retry' ? 'bg-orange-900/30 text-orange-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {item.missing_count} scrape{item.missing_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-yellow-400 font-semibold">{fmt(item.price)}</div>
                  <a href={item.product_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                    <ExternalLink size={14} className="text-gray-400" />
                  </a>
                </div>
              ))}
            </div>
          )}

          {tab === 'sold' && (
            <div className="space-y-2">
              {filteredSold.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  No confirmed sold items yet. Items need 3+ scrapes missing + verification check.
                </div>
              )}
              {filteredSold.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center gap-4 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Confirmed {new Date(item.confirmed_at || item.first_seen_missing).toLocaleDateString()}</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                        {item.confirmation_method === '404' ? '404' : 
                         item.confirmation_method === 'content_check' ? 'Content' : 'Combined'}
                      </span>
                    </div>
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
                    <span className="text-xs text-gray-500">Added on {new Date(item.added_at).toLocaleDateString()}</span>
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

function StatCard({ icon, label, value, highlight = false, sold = false, pending = false, new: isNew = false }: {
  icon: React.ReactNode; label: string; value: string;
  highlight?: boolean; sold?: boolean; pending?: boolean; new?: boolean;
}) {
  return (
    <div className={`border rounded-xl p-4 ${
      highlight ? 'bg-green-900/20 border-green-900/30' :
      sold ? 'bg-red-900/20 border-red-900/30' :
      pending ? 'bg-yellow-900/20 border-yellow-900/30' :
      isNew ? 'bg-green-900/20 border-green-900/30' :
      'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">{icon}{label}</div>
      <div className={`text-xl font-bold ${
        highlight ? 'text-green-400' : sold ? 'text-red-400' : pending ? 'text-yellow-400' : isNew ? 'text-green-400' : ''
      }`}>{value}</div>
    </div>
  );
}
