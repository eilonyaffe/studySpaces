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
- `npm start` → Build & run `server.ts`
- `npm run scrape` → Build & run `app.ts`