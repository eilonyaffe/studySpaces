import moment from 'moment';
import path from 'path';
import fs from 'fs';

import { askQuestion } from './utils';
import { startWithAutoRetry } from './index';
import { startWithAutoRetryBadCourses } from './run_bad_courses';

const RUN_BAD_COURSES_AGAIN = true;  // runs the courses who weren't scraped right in the first run, again


async function main(){
    const semester:string = await askQuestion('enter semester number (1, 2, 3):');
    if (!['1','2','3'].includes(semester)) {
        console.error('Invalid number');
        return main();
    }

    const currentDate: moment.Moment = moment();
    const fullTime:string = currentDate.format('DD-MM-YYYY')  // used to save a file under data/user_queries/ by date and time

    const dir = path.join(`data/full/semester_${semester}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const outputPath = path.join(dir, `${fullTime}.json`);

    await startWithAutoRetry(outputPath, semester);
    console.log("VVV Finished running on the given semester");


    if (RUN_BAD_COURSES_AGAIN == true) {
        console.log("Running bad courses again...");
        await startWithAutoRetryBadCourses(outputPath, semester);
    }
}

void main();