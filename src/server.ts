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
  const { startTime, given_date } = req.query;

  if (!startTime || !given_date) {
    res.status(400).json({ error: "Missing parameters" });
    return;
  }
  console.log(startTime);
  const startTimeStr = Array.isArray(startTime) ? startTime[0] : String(startTime || '');
  const startTimeHour = hourMap[startTimeStr as string] || 0;

  // Convert date to day of week (1–7)
  const m = moment(given_date as string, "YYYY-MM-DD");
  let dayNumber = m.day(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayNumber = dayNumber + 1;

  // Load JSON files from data/full/semester_2/processed/
  const dirPath = path.join(__dirname, `../data/full/semester_${semester}/processed`);
  const targetFile = fs.readdirSync(dirPath).find(f => f === `${startTimeHour}.json`);

  const results: any[] = [];
  if (targetFile) {
    const filePath = path.join(dirPath, targetFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);

    for (const entry of jsonData) {
      if (entry.day === dayNumber) {
        results.push(entry);
        if (results.length >= 20) break;
      }
    }
  }
  else{
    console.log("no file!");
  }

  res.json(results);
});

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`);
});
