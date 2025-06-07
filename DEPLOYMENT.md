# 🚀 Deployment Guide - Temporal Minesweeper

This guide helps you deploy your Temporal Minesweeper game online for free with **self-hosted Temporal**.

## 🧪 Test Locally First

Before deploying online, test the Docker setup locally:

```bash
# Test the full deployment
npm run deploy:test

# Or run step by step
npm run docker:build
npm run docker:run
```

Visit:
- 🎮 **Game**: http://localhost:3000
- 📊 **Temporal UI**: http://localhost:8233

## 🌐 Free Hosting Options

### Option 1: Railway (Recommended) 

**Why Railway**: Easy setup, supports Docker, generous free tier.

1. **Setup**:
   - Push your code to GitHub
   - Connect GitHub repo to [Railway](https://railway.app)
   - Railway auto-detects Dockerfile and deploys

2. **Configuration**: 
   - Railway automatically assigns a public URL
   - No additional config needed!

3. **Access**:
   - Game: `https://your-app.railway.app`
   - Temporal UI: `https://your-app.railway.app:8233` (if exposed)

### Option 2: Render

1. **Setup**:
   - Connect GitHub to [Render](https://render.com)
   - Choose "Web Service"
   - Select "Docker" environment

2. **Configuration**:
   - Build Command: `docker build -t app .`
   - Start Command: `docker run -p 10000:3000 app`

### Option 3: Fly.io

1. **Install CLI**: 
   ```bash
   brew install flyctl  # or curl -L https://fly.io/install.sh | sh
   ```

2. **Deploy**:
   ```bash
   fly auth login
   fly launch
   fly deploy
   ```

## 🔧 Configuration Notes

### Ports
- **3000**: Web server (your game)
- **7233**: Temporal server (internal)
- **8233**: Temporal UI (optional to expose)

### Environment Variables
All services connect automatically via:
- `TEMPORAL_ADDRESS=localhost:7233`
- `PORT=3000` (or platform-assigned port)

## 🏥 Health Checks

The deployment includes a health check endpoint:
- `GET /api/health` - Returns server status

## 🐛 Troubleshooting

### Container won't start?
```bash
# Check logs locally
docker logs <container-id>

# Rebuild clean
docker system prune -a
npm run docker:build
```

### Services not connecting?
- Temporal server takes ~10-30 seconds to start
- Worker waits for Temporal server
- Web server waits for worker

### Out of memory?
- Railway/Render free tiers have memory limits
- Temporal server uses ~200-500MB RAM
- Consider upgrading to paid tier if needed

## 🎯 Quick Start Summary

1. **Test locally**: `npm run deploy:test`
2. **Push to GitHub**: `git push`
3. **Deploy on Railway**: Connect repo → Auto-deploy
4. **Share with friends**: Send them your Railway URL!

## 🚀 Go Live!

Once deployed, your friends can play at your public URL without any setup. The game state persists across sessions thanks to Temporal! 🎮

---

**Need help?** Check the logs in your hosting platform's dashboard or test locally first. 