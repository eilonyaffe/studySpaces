# StudySpaces

A Node.js/TypeScript project for managing and serving study space data at BGU.

---

## ✨ Features
✅ Scrapes room availability data  
✅ Serves user search queries  
✅ Simple HTML frontend

---

## 🚀 Project Structure
- `data/full/semester_{semester}/processed/`: JSON files for each hour
- `templates/index.html`: frontend for selecting date/time
- `app.ts`: admin script for scraping
- `server.ts`: user-facing server for `/search` requests

---

## ⚙️ Scripts
- `npm run build` → Compile TypeScript
- `npm run start` → Build & run `index.ts`
- `npm run dev` → Run with `ts-node`
- `npm run scrape` → Scrape semester data

---

## 🔧 Usage
1️⃣ Install:  
```bash
npm install

2️⃣ Scrape data (admin):
npm run start

3️⃣ Start server:
node dist/server.js
