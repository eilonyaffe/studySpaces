import path from 'path';
import express, { Request, Response } from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from 'fs';
import moment from 'moment';

import { hourMap} from './utils';
import {sortEntries, Entry} from './geo_distance';
import { SEMESTER} from './config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "../static")));

app.get('/favicon.ico', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../static/favicon.ico"));
});


app.get("/", (req: Request, res: Response) => {
    const indexPath = path.join(__dirname, "../templates/index.html");
    res.sendFile(indexPath);
});

app.get("/search", (req, res): void => {
  const { startTime, endTime, given_date, lat, lon } = req.query;
  const userLat = lat ? parseFloat(lat as string) : undefined;
  const userLon = lon ? parseFloat(lon as string) : undefined;

  if (!startTime || !endTime || !given_date) {
    res.status(400).json({ error: "Missing parameters" });
    return;
  }
  // console.log(startTime);
  const startTimeStr = Array.isArray(startTime) ? startTime[0] : String(startTime || '');
  const endTimeStr = Array.isArray(endTime) ? endTime[0] : String(endTime || '');
  const startTimeHour = hourMap[startTimeStr as string] || 0;
  const endTimeHour = hourMap[endTimeStr as string] || 0;

  // Convert date to day of week (1–7)
  const m = moment(given_date as string, "YYYY-MM-DD");
  let dayNumber = m.day() + 1; // 0=Sunday, 1=Monday, ..., 6=Saturday

  // Load JSON files from data/full/semester_2/processed/
  const dirPath = path.join(__dirname, `../data/full/semester_${SEMESTER}/processed`);
  // const targetFile = fs.readdirSync(dirPath).find(f => f === `${startTimeHour}.json`);

  let validEntries: Entry[] | null = null;

  for (let hour = startTimeHour; hour < endTimeHour; hour++) {
    const filePath = path.join(dirPath, `${hour}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`File not found for hour ${hour}`);
      validEntries = [];
      break;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);

    const entriesThisHour: Entry[] = jsonData
      .filter((entry: any) => entry.day === dayNumber)
      .map((entry: any) => ({
        building: entry.building,
        room: entry.room
      }));

    if (validEntries === null) {
      validEntries = entriesThisHour; //at the first hour, keeps all entries with the correct day number
    } else {
      validEntries = validEntries.filter((ve: Entry) =>  //each subsequent iteration, filter for entries that are also in entriesThisHour, hence intersection
        entriesThisHour.some((e: Entry) => e.building === ve.building && e.room === ve.room)
      );
    }

    if (validEntries.length === 0) {
      break;
    }
  }
  const sorted = sortEntries(validEntries || [], userLat, userLon); //sorted by proximity to the user, if he gave his location
  res.json(sorted);
});

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`);
});
