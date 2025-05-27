import * as readline from 'readline';
import fs from 'fs';
import * as cheerio from "cheerio";

interface timeSpace {
  building: number;
  room: number;
  day: number;
  start: number;
  end: number;
}

const hebrewDayMap: { [key: string]: number } = {
  "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "שבת": 7
};

export function askQuestion(query: string): Promise<string> {
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

return new Promise(resolve =>
    rl.question(query, answer => {
    rl.close();
    resolve(answer.trim());
    })
);
}

export function hourTo24hString(hour: number): string {
    return hour.toString().padStart(2, '0') + ":00";
}

export function appendResultsToFile(path: string, items: timeSpace[]) {
    const data = items.map(item => JSON.stringify(item)).join(',\n') + ',\n';
    fs.appendFileSync(path, data, 'utf-8');
}

export function initializeFile(path: string) {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, '[\n', 'utf-8');  // Start JSON array
    }
}

export function finalizeFile(path: string) {
    let content = fs.readFileSync(path, 'utf-8').trim();
    if (content.endsWith(',')) content = content.slice(0, -1); // remove trailing comma
    fs.writeFileSync(path, content + '\n]', 'utf-8');
}

export function readBadNums(filePath: string): number[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').map(line => parseInt(line.trim())).filter(n => !isNaN(n));
}

export function parseScheduleFromCoursePage(html: string): timeSpace[] {
  const $ = cheerio.load(html);
  const output: timeSpace[] = [];
  const seen = new Set<string>();

  const scheduleRows = $("table.dataTable").first().find("tr").toArray();

  for (const row of scheduleRows) {
    const detailTd = $(row).find("td").eq(3);
    if (!detailTd.length) continue;

    const detailsText = detailTd.text().replace(/\s+/g, " ").trim();

    // Match day of week in Hebrew (e.g., "א", "ב", ...)
    const dayMatch = detailsText.match(/יום ([א-ת])/);
    let day;
    if (!dayMatch){
        day=-1;
    }
    else{
        day = hebrewDayMap[dayMatch[1]] ?? -1;
    }
    // Match time
    const timeMatch = detailsText.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;
    const start = parseInt(timeMatch[1].padStart(2, "0") + timeMatch[2]);
    const end = parseInt(timeMatch[3].padStart(2, "0") + timeMatch[4]);


    // Match building number
    const bldMatch = detailsText.match(/\[(\d+)\]/);
    const building = bldMatch ? parseInt(bldMatch[1]) : -1;
    if ([1, 2, 3, 4, 5, 6, 7, 14, 47, 48, 25, 24, 9].includes(building)) continue;
    if (building === 26 && /המרכז לאנרגיה.*\[26\]/.test(detailsText)) continue;

    // Match room number
    const roomMatch = detailsText.match(/חדר\s*(\d+)/);
    const room = roomMatch ? parseInt(roomMatch[1]) : -1;

    const item = { building, room, day, start, end };
    if (Object.values(item).includes(-1)) continue;

    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }

  return output;
}