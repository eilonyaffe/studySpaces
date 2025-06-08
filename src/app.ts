import moment from 'moment';
import path from 'path';
import fs from 'fs';

import { pruneOldJsonFiles } from './utils';
import { startWithAutoRetryFast } from './index';
import { initializeDataFiles, fillTimeFilesWithFullBuildingRoomDays, removeOccupiedEntriesFromTimeFiles, squeezeAllJsonFilesToArrayJsonFormat } from './data_post_process';
import { RETRY, SEMESTER} from './config';

async function main() {
  pruneOldJsonFiles(SEMESTER);

  const currentDate: moment.Moment = moment();
  const fullTime: string = currentDate.format('DD-MM-YYYY');

  const dir = path.join(`data/semester_${SEMESTER}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const outputPath = path.join(dir, `${fullTime}.json`);

  const unscraped_dir = path.join(`data`);
  const unscrapedPath = path.join(unscraped_dir, 'unscraped.json');
  fs.writeFileSync(unscrapedPath, '[]', 'utf-8');

  await startWithAutoRetryFast(outputPath, SEMESTER, RETRY);
  console.log("VVV Finished running on the given semester");

  initializeDataFiles(SEMESTER);
  fillTimeFilesWithFullBuildingRoomDays(SEMESTER, outputPath);
  removeOccupiedEntriesFromTimeFiles(SEMESTER, outputPath);
  squeezeAllJsonFilesToArrayJsonFormat(SEMESTER);

  console.log("✅ Data distribution completed.");
}

void main();
