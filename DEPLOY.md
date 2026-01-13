# Deployment Guide

## Option 1: Deploy to Vercel (Recommended - Easiest & Free)

Vercel is made by the Next.js team and is the easiest way to deploy.

### Quick Deploy (GitHub)

1. **Push to GitHub:**
   ```bash
   cd web-app
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to https://vercel.com
   - Sign up/login (free)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"
   - Done! You'll get a URL like `https://your-app.vercel.app`

### Manual Deploy (CLI)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd web-app
   vercel
   ```
   Follow the prompts (first time will ask you to login)

3. **For production:**
   ```bash
   vercel --prod
   ```

## Option 2: Deploy to Netlify

1. **Build the app:**
   ```bash
   cd web-app
   npm run build
   ```

2. **Deploy:**
   - Go to https://app.netlify.com
   - Drag & drop the `.next` folder (or use CLI)
   - Or connect to GitHub for auto-deploys

## Option 3: Deploy to Railway

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo
4. Railway auto-detects Next.js

## Option 4: Self-Hosted (Your Own Server)

1. **Build:**
   ```bash
   npm run build
   ```

2. **Start:**
   ```bash
   npm start
   ```

3. **Use PM2 for production:**
   ```bash
   npm install -g pm2
   pm2 start npm --name "coupon-migration" -- start
   pm2 save
   pm2 startup
   ```

## Security Considerations

⚠️ **Important:** This app stores credentials in the browser's localStorage. For production use:

1. **Option A: Acceptable for trusted client**
   - Credentials stay in their browser (client-side only)
   - No server storage
   - Each user manages their own credentials

2. **Option B: Add authentication (more secure)**
   - Add password protection
   - Or require authentication before use
   - Consider adding environment variable restrictions

## Sharing with Client

Once deployed, simply share the URL with your client:
- `https://your-app.vercel.app` (or your deployment URL)

**Instructions for client:**
1. Open the URL in their browser
2. Go to Setup page
3. Enter their BigCommerce API credentials (stored locally in their browser)
4. Follow the migration wizard

## Custom Domain (Optional)

- **Vercel:** Settings → Domains → Add your domain
- **Netlify:** Domain settings → Add custom domain
