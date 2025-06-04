# StudySpaces

A Node.js/TypeScript project for managing and serving available classroom spaces in the main campus of BGU.

---

## ✨ Features
✅ Scrapes room availability data  
✅ Serves user search queries, filtered by date, time range, and sorted by location (of provided by the user)
✅ Simple yet functional HTML frontend

---

## 🧠 Logic
✅ It is publicly available to view BGU's course schedules on the web
✅ Performing a "complement" for these schedules (which indicate when the rooms are occupied) allows us to find available rooms
✅ If the user provides a location, we use the haversine function to find his distance from each of the available buildings to sort the available rooms provided to the user

---

## 🚀 Project Structure
- `data/full/semester_{semester}/processed/`: JSON files for each hour
- `templates/index.html`: frontend for selecting time range, date, and location
- `app.ts`: admin script for scraping (uses `index.ts` and `utils.ts` for auxiliary function)
- `server.ts`: user-facing server for `/search` requests
- `geo_distance.ts`: functions to sort the results using haversine- a function for measuring distances between geo locations
- `config.ts`: booleans and ints that determine the settings of the program
- `static/locations.json`: contains building numbers and locations for buildings relevant to the app


---

## ⚙️ Scripts
- `npm start` → Build & run `server.ts`
- `npm run scrape` → Build & run `app.ts`