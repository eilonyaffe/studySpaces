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
✅ Performing a "complement" for these schedules (which indicate occupancy) allows us to find available rooms  
✅ If the user provided a location, we sort results by distance from the buildings, by the haversine function   

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


**StudySpaces** – Proprietary License (Personal and Educational Use Only)

Copyright © 2025

All rights reserved.

This software and associated documentation files (the "Software") are the exclusive property of the copyright holder.

You are **permitted** to:

- View and use the Software for **personal**, **non-commercial**, or **educational** purposes only.

You are **NOT permitted** to:

- Copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
- Use the Software for any **commercial**, **organizational**, or **public deployment** purposes.
- Reverse engineer, decompile, or disassemble any part of the Software.

Any use of the Software beyond these permissions requires prior, explicit, and written consent from the copyright holder.

---

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.  
IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.