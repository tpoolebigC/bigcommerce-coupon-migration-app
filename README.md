# BigCommerce Coupon Migration Web App

A user-friendly web interface for migrating BigCommerce coupon codes from legacy format to standard edition promotions.

## Features

- ✅ **Simple Setup**: Easy credential configuration (one-time setup)
- 📥 **Export & Backup**: Download existing coupons before migration
- 🔄 **Automatic Migration**: Delete old promotions and create new standard ones
- 📊 **Progress Tracking**: Step-by-step wizard with clear progress indicators
- 🎨 **Clean UI**: Modern, intuitive interface that anyone can use

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000`

## Deployment

### Quick Deploy to Vercel (Recommended - 5 minutes)

**Easiest method - via GitHub:**

1. **Create a GitHub repo** (if you don't have one):
   ```bash
   cd web-app
   git init
   git add .
   git commit -m "BigCommerce Coupon Migration App"
   ```
   Then create a new repo on GitHub and push:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign up (free)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js - just click "Deploy"
   - Done! You'll get a URL like `https://your-app.vercel.app`

3. **Share the URL with your client** - that's it!

**Alternative - Deploy via CLI:**
```bash
npm i -g vercel
cd web-app
vercel
```

### Deploy to Other Platforms

See `DEPLOY.md` for detailed instructions for Netlify, Railway, or self-hosting.

## Usage

1. **Configure Credentials**: Enter BigCommerce API credentials (stored in browser)
2. **Export Coupons**: Download backup of existing coupons
3. **Review**: Check the list of coupons to migrate
4. **Migrate**: Click to start the migration process
5. **Results**: View the migration results and new coupon IDs

## Security Note

- Credentials are stored in the browser's localStorage (client-side only)
- For production use, consider adding authentication
- API calls are made server-side through Next.js API routes

## Support

For issues or questions, refer to the main migration script documentation.
