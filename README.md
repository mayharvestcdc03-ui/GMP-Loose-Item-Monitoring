# GMP and Loose Item Control Monitoring System
May Harvest Corporation • Document Code: QAC001

A web-based monitoring system for:
- Incoming Personnel Registration
- GMP Personnel Entry Checklist
- Loose Item Declaration & Accounting (Time In / Break / Time Out)
- Reviewer Verification & Signatures
- Break Out / Break In Logs
- Weekly Review & Noted By Signatures
- GMP Violators Log & Reports

## Deployment on Render

This project is configured to work seamlessly on [Render](https://render.com) as either a **Static Site** or a **Web Service**:

### Option 1: Static Site (Recommended - Free, Fast, Never sleeps)
- **Name:** `gmp-loose-item-monitoring`
- **Root Directory:** `.`
- **Build Command:** *(leave empty)*
- **Publish Directory:** `.`

### Option 2: Web Service
- **Name:** `gmp-loose-item-monitoring`
- **Environment:** `Node`
- **Build Command:** *(leave empty or `npm install`)*
- **Start Command:** `node server.js`
