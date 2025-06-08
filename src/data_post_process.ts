import fs from 'fs';
import path from "path";

import {initializeFile, timeSpace } from "./utils";


export function initializeDataFiles(semester:string) {
const dir = path.join(`data/semester_${semester}/processed`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let i=8;
  while (i<=20){
    const outputPath = path.join(dir, `${i}.json`);
    initializeFile(outputPath);
    i++;
  }
}


//Fill the files with all relevant classrooms
export function fillTimeFilesWithFullBuildingRoomDays(semester: string, inputFilePath: string) {
  const inputData: timeSpace[] = JSON.parse(fs.readFileSync(inputFilePath, 'utf-8'));

  const dir = path.join(`data/semester_${semester}/processed`);

  // Collect all unique building-room pairs from the input data
  const buildingRoomPairs: Set<string> = new Set();
  for (const entry of inputData) {
    const key = JSON.stringify({ building: entry.building, room: entry.room });
    buildingRoomPairs.add(key);
  }

  // Prepare the full set of entries for days 1–7 for each building-room pair
  const allEntries: { building: number; room: number; day: number }[] = [];
  for (const pairStr of buildingRoomPairs) {
    const { building, room } = JSON.parse(pairStr);
    for (let day = 1; day <= 7; day++) {
      allEntries.push({ building, room, day });
    }
  }

  // Initialize or overwrite each hourly JSON file with these entries
  for (let hour = 8; hour <= 20; hour++) {
    const outputPath = path.join(dir, `${hour}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allEntries, null, 2), 'utf-8');
  }

  console.log("✅ All time files filled with building-room-day combinations!");
}

//This does the complement operation- uses the scheduled classes to remove occupied studySpaces by some course
export function removeOccupiedEntriesFromTimeFiles(semester: string, inputFilePath: string) {
  const inputData: timeSpace[] = JSON.parse(fs.readFileSync(inputFilePath, 'utf-8'));
  const processedDir = path.join(`data/semester_${semester}/processed`);

  // For each hourly file (8–20)
  for (let hour = 8; hour <= 20; hour++) {
    const outputPath = path.join(processedDir, `${hour}.json`);
    const hourEntries: { building: number; room: number; day: number }[] = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

    const intervalStart = hour * 100;
    const intervalEnd = (hour + 1) * 100;

    // Arrays for updated entries and removed entries
    const updatedEntries: typeof hourEntries = [];

    for (const entry of hourEntries) {
      const conflicting = inputData.find(scheduled =>
        scheduled.building === entry.building &&
        scheduled.room === entry.room &&
        scheduled.day === entry.day &&
        scheduled.start < intervalEnd &&
        scheduled.end > intervalStart
      );

      if (!conflicting) {
        // Keep if not occupied
        updatedEntries.push(entry);
      }
    }

    // Write updated hourly file
    fs.writeFileSync(outputPath, JSON.stringify(updatedEntries, null, 2), 'utf-8');
  }
}

export function squeezeAllJsonFilesToArrayJsonFormat(semester: string) {
  const processedDir = path.join(`data/semester_${semester}/processed`);

  // Helper to process a directory (like processed/)
  const squeezeDir = (dirPath: string) => {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8').trim();

      let data: any[] = [];
      try {
        // Try to parse as a full JSON array
        data = JSON.parse(content);
      } catch (err) {
        // Might be JSON lines; parse each line
        data = content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      }

      // Create JSON array (pretty but with one line per object)
      const finalJson = '[\n' + data.map(entry => JSON.stringify(entry)).join(',\n') + '\n]';
      fs.writeFileSync(filePath, finalJson, 'utf-8');
    }
  };

  // Process processed/
  squeezeDir(processedDir);
  console.log("✅ Squeezed all JSON files to valid JSON arrays (each object on its own line)");
}
