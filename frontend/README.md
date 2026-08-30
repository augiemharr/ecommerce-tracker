# E-Commerce Tracker

Track competitor e-commerce websites - monitor products, pricing, and estimate revenue.

## Deploy to Vercel

1. **Push to GitHub**:
   ```bash
   cd ecommerce-tracker/frontend
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Go to [vercel.com](https://vercel.com)** and sign up/log in

3. **Import your GitHub repo**:
   - Click "New Project"
   - Select your repo
   - Root Directory: `frontend`
   - Framework Preset: Next.js
   - Click Deploy

4. **Done!** Your app will be live at `https://your-project.vercel.app`

## How It Works

- **Frontend**: Next.js dashboard on Vercel
- **Backend**: Python serverless functions in `/api/` directory
- **Database**: SQLite stored in `/tmp` (resets on cold start - use Turso/PlanetScale for production)

## Features

- Track multiple e-commerce sites (AliExpress, Etsy, Shopify, Generic)
- Monitor product prices and inventory
- Estimate revenue from sales/review data
- Price history charts
- Site comparison dashboard

## Local Development

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sites` | Add a site to track |
| GET | `/api/sites` | List all tracked sites |
| DELETE | `/api/sites/[id]` | Remove a site |
| POST | `/api/sites/[id]/scrape` | Trigger a scrape |
| GET | `/api/sites/[id]` | Get site analytics |
| GET | `/api/sites/[id]/products` | Get product list |
| GET | `/api/compare?site_ids=1,2` | Compare sites |

## Important Notes

- Revenue estimates are approximations, not exact figures
- Some sites may block scrapers (use proxies in production)
- SQLite in `/tmp` resets on cold starts - data won't persist across deployments
- For production, swap to Turso (free SQLite hosting) or PlanetScale
