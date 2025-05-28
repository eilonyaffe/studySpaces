import fs from 'fs';
import path from "path";

import {appendResultsToFile, initializeFile, finalizeFile, timeSpace } from "./utils";


export function initializeDataFiles(semester:string) {
const dir = path.join(`data/full/semester_${semester}/processed`);
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

export function distributeTimeSpacesToTimeFiles(semester: string, inputFilePath: string) {
  const inputData: timeSpace[] = JSON.parse(fs.readFileSync(inputFilePath, 'utf-8'));

  const dir = path.join(`data/full/semester_${semester}/processed`);

  // Prepare an object to accumulate data for each hour
  const hourlyData: { [hour: number]: timeSpace[] } = {};
  for (let hour = 8; hour <= 20; hour++) {
    hourlyData[hour] = [];
  }

  // For each timeSpace, see which hours it overlaps with
  for (const entry of inputData) {
    for (let hour = 8; hour <= 20; hour++) {
      const intervalStart = hour * 100;     // e.g., 14 -> 1400
      const intervalEnd = (hour + 1) * 100; // e.g., 14 -> 1500

      // Check for overlap
      if (entry.start < intervalEnd && entry.end > intervalStart) {
        hourlyData[hour].push(entry);
      }
    }
  }

  // Append the entries to their respective hourly JSON files
  for (let hour = 8; hour <= 20; hour++) {
    const outputPath = path.join(dir, `${hour}.json`);
    appendResultsToFile(outputPath, hourlyData[hour]);
    finalizeFile(outputPath);
  }

  console.log("✅ Distribution of timeSpaces completed!");
}
