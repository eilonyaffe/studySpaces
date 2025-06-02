import path from 'path';
import express, { Request, Response } from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from 'fs';
import moment from 'moment';
import { hourMap } from './utils';


const retry:boolean = false;  // controls if we retry scraping courses that weren't successfully scraped the first time
const semester:number = 2;  // to be changed by admin, 1 2 or 3

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
  const { startTime, endTime, given_date } = req.query;

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
  const dirPath = path.join(__dirname, `../data/full/semester_${semester}/processed`);
  // const targetFile = fs.readdirSync(dirPath).find(f => f === `${startTimeHour}.json`);

  type Entry = { building: number; room: number };
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
      validEntries = entriesThisHour;
    } else {
      validEntries = validEntries.filter((ve: Entry) =>
        entriesThisHour.some((e: Entry) => e.building === ve.building && e.room === ve.room)
      );
    }

    if (validEntries.length === 0) {
      break;
    }
  }

  res.json(validEntries || []);
});

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`);
});
