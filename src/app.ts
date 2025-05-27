import moment from 'moment';
import path from 'path';
import fs from 'fs';

import { askQuestion } from './utils';
import { startWithAutoRetryFast } from './index';

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

  // The new startWithAutoRetry logic no longer writes "bad courses" indices to a separate file,
  // but it will still produce the output JSON file in one pass.
  await startWithAutoRetryFast(outputPath, semester);
//   finalizeFile(outputPath);
  console.log("VVV Finished running on the given semester");
}

void main();
