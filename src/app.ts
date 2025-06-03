import moment from 'moment';
import path from 'path';
import fs from 'fs';

import { askQuestion } from './utils';
import { startWithAutoRetryFast } from './index';
import { initializeDataFiles, fillTimeFilesWithFullBuildingRoomDays, removeOccupiedEntriesFromTimeFiles, squeezeAllJsonFilesToArrayJsonFormat } from './data_post_process';

const retry:boolean = true;  // controls if we retry scraping courses that weren't successfully scraped the first time TODO change later as environment

async function main() {
  const semester: string = await askQuestion('enter semester number (1, 2, 3):');
  if (!['1', '2', '3'].includes(semester)) {
    console.error('Invalid number');
    return main();
  }

  const currentDate: moment.Moment = moment();
  const fullTime: string = currentDate.format('DD-MM-YYYY');

  const dir = path.join(`data/full/semester_${semester}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputPath = path.join(dir, `${fullTime}.json`);

  const unscraped_dir = path.join(`data/full`);
  const unscrapedPath = path.join(unscraped_dir, 'unscraped.json');
  fs.writeFileSync(unscrapedPath, '[]', 'utf-8');

  await startWithAutoRetryFast(outputPath, semester, retry);
  console.log("VVV Finished running on the given semester");

  initializeDataFiles(semester);
  fillTimeFilesWithFullBuildingRoomDays(semester, outputPath);
  removeOccupiedEntriesFromTimeFiles(semester, outputPath);
  squeezeAllJsonFilesToArrayJsonFormat(semester);

  console.log("✅ Data distribution completed.");
}

void main();
