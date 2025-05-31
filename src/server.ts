import path from 'path';
import express, { Request, Response } from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from 'fs';
import moment from 'moment';

const retry:boolean = false;  // controls if we retry scraping courses that weren't successfully scraped the first time

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
  const { startTime, date } = req.query;

  if (!startTime || !date) {
    res.status(400).json({ error: "Missing parameters" });
    return;
  }

  // Convert date to day of week (1–7)
  const m = moment(date as string, "YYYY-MM-DD");
  let dayNumber = m.day(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayNumber = dayNumber === 0 ? 1 : dayNumber + 1;

  // Load JSON files from data/full/semester_2/processed/
  const dirPath = path.join(__dirname, "../data/full/semester_2/processed");
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));

  const results: any[] = [];
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(content);

    for (const entry of jsonData) {
      if (entry.day === dayNumber) {
        results.push(entry);
        if (results.length >= 20) break;
      }
    }
    if (results.length >= 20) break;
  }

  res.json(results);
});

app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`);
});
