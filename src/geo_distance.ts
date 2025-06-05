import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Entry = { building: number; room: number };

type Location = {
  building: number;
  latitude: string;
  longitude: string;
};

function euclidean(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = lat1 - lat2;
  const dy = lon1 - lon2;
  return Math.sqrt(dx * dx + dy * dy);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // earth radius in meters
  const toRad = (deg: number) => deg * Math.PI / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const sinΔφ2 = Math.sin(Δφ / 2);
  const sinΔλ2 = Math.sin(Δλ / 2);

  const a = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Clamp c just in case of very tiny rounding errors pushing it above π
  const safeC = Math.min(Math.PI, Math.max(0, c));

  return R * safeC;
}

export function sortEntries(validEntries: Entry[], dist_func:string, userLat?: number, userLon?: number): Entry[] {
  //read the buildings locations json  
  const locPath = path.join(__dirname, "../static/locations.json");
  const raw = fs.readFileSync(locPath, 'utf-8');
  const locations: Location[] = JSON.parse(raw);

  if (userLat !== undefined && userLon !== undefined) { // User gave location
    return validEntries
      .map(entry => {
        const loc = locations.find(l => l.building === entry.building);
        let distance: number;
        if (!loc) {
          distance = Infinity;
        } 
        else {
          const lat2 = parseFloat(loc.latitude);
          const lon2 = parseFloat(loc.longitude);
          distance = dist_func === "euclidian"
            ? euclidean(userLat, userLon, lat2, lon2)
            : haversine(userLat, userLon, lat2, lon2);
        }
        return { ...entry, distance };
      })
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.building !== b.building) return a.building - b.building;
        return a.room - b.room;
      })
      .map(({ building, room }) => ({ building, room })); // remove the newly created distance property from the output
  } 
  else {  // Default: sort by building number
    return validEntries.sort((a, b) => {
      if (a.building !== b.building) return a.building - b.building;
      return a.room - b.room;
    });
  }
}