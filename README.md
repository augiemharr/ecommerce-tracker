# E-Commerce Tracker

Track competitor e-commerce websites - monitor products, pricing, and estimate revenue.

## Features

- Track multiple e-commerce sites (AliExpress, Etsy, Shopify, Generic)
- Monitor product prices and inventory
- Estimate revenue from sales/review data
- Price history charts
- Site comparison dashboard

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, BeautifulSoup
- **Frontend**: Next.js, TypeScript, Tailwind CSS, Recharts
- **Database**: SQLite (default) or PostgreSQL

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Start the API
python main.py
```

API runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard runs at `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sites` | Add a site to track |
| GET | `/api/sites` | List all tracked sites |
| DELETE | `/api/sites/{id}` | Remove a site |
| POST | `/api/sites/{id}/scrape` | Trigger a scrape |
| GET | `/api/sites/{id}` | Get site analytics |
| GET | `/api/sites/{id}/products` | Get product list |
| GET | `/api/compare?site_ids=1,2,3` | Compare multiple sites |

## How Revenue Estimation Works

1. **Direct sales data**: If the site shows "X sold", use that × price
2. **Review-based**: Reviews / 0.05 (5% review rate) × price
3. **Stock changes**: Track inventory changes over time as sales velocity

## Important Notes

- Revenue estimates are approximations, not exact figures
- Scraping frequency should be reasonable (once daily recommended)
- Some sites may block automated requests - use proxy rotation in production
- Always respect robots.txt and terms of service
