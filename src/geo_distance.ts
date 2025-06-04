import fs from 'fs';
import path from "path";

export type Entry = { building: number; room: number };

type Location = {
  building: number;
  latitude: string;
  longitude: string;
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function sortEntries(validEntries: Entry[], userLat?: number, userLon?: number): Entry[] {
  //read the buildings locations json  
  const locPath = path.join(__dirname, "../static/locations.json");
  const raw = fs.readFileSync(locPath, 'utf-8');
  const locations: Location[] = JSON.parse(raw);

  if (userLat !== undefined && userLon !== undefined) { // User gave location
    return validEntries
      .map(entry => {
        const loc = locations.find(l => l.building === entry.building); //TODO maybe use map instead of array search
        const distance = loc
          ? haversine(userLat, userLon, parseFloat(loc.latitude), parseFloat(loc.longitude))
          : Infinity;
        return { ...entry, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .map(({ building, room }) => ({ building, room })); // remove the newly created distance property from the output
  } else {  // Default: sort by building number
    return validEntries.sort((a, b) => a.building - b.building);
  }
}