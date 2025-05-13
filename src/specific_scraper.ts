import moment from 'moment';
import puppeteer, { ElementHandle } from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { timeSpace, hebrewDayMap, askQuestion, hourTo24hString } from './utils';

const currentDate: moment.Moment = moment();
const month:number = currentDate.month();

let semester:number = (month==0 || month<=11 && month>=9) ? 1 :   (month<=5 && month>=2) ? 2 : (month<=8 && month>=6) ?  3 : -1;
console.log(`auto-detected the semester as: ${semester}`);


async function run() {
    const dayStr = await askQuestion('enter day number (1 to 7):');
    const dayNum = Number(dayStr);
  
    if (isNaN(dayNum) || dayNum <= 0 || dayNum >= 8 || !Number.isInteger(dayNum)) {
      console.error('Invalid number');
      return;
    }

    const dayElement:string = "on_day" + dayStr ;
    console.log(`day element '${dayElement}'`);

    const timeStr:string = await askQuestion('enter starting hour (0 to 23):');
    const timeNum:number = Number(timeStr);
  
    if (isNaN(timeNum) || timeNum < 0 || timeNum >= 24 || !Number.isInteger(timeNum)) {
      console.error('Invalid hour');
      return;
    }

    let startTimeNum = timeNum - 4;
    startTimeNum = (startTimeNum < 0) ? 0 : startTimeNum; //if the start time is very early

    let EndTimeNum = timeNum + 4;
    EndTimeNum = (EndTimeNum >= 23) ? 23 : EndTimeNum; //if the start time is very late

    const stdStartTime:string = hourTo24hString(startTimeNum);
    const stdEndTime:string = hourTo24hString(EndTimeNum);

  
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
  
    await page.goto('https://bgu4u.bgu.ac.il/pls/scwp/!app.gate?app=ann', {
      waitUntil: 'domcontentloaded',
    });
  
    await new Promise(resolve => setTimeout(resolve, 2000));
  
    let frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
      console.error('Main frame not found');
      await browser.close();
      return;
    }

    const handle = await frame.evaluateHandle(() => {
        const xpath = "//a[contains(text(), 'חיפוש מורחב')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue as HTMLElement | null;
    });
    
    const elementHandle = handle.asElement() as ElementHandle<HTMLElement> | null;
    if (elementHandle) {
        await elementHandle.click();
        console.log("V Clicked 'advanced search'");
    } else {
        console.log("X Could not find 'advanced search'");
        await browser.close();
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
        console.error('Search frame not found after click');
        await browser.close();
        return;
    }

    // entering * to get all relevant courses
    const inputHandle = await frame.$('#oc_course_name');
    const inputField = inputHandle as ElementHandle<HTMLInputElement> | null;
    if (inputField) {
        await inputField.click({ clickCount: 3 });
        await inputField.type('*');
        console.log("Typed '*' into course name field");
    } else {
        console.log("Could not find course name input field");
        await browser.close();
        return;
    }

    // entering the correct semester's number
    const semesterDropdown = await frame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
    if (semesterDropdown) {
        await semesterDropdown.select(semester.toString());
        console.log(`Selected semester '${semester}'`);
    } else {
        console.log("Could not find semester dropdown");
        await browser.close();
        return;
    }

    // choosing the time range
    const startTimeDropdown = await frame.$('#oc_start_time') as ElementHandle<HTMLSelectElement> | null;
    if (startTimeDropdown) {
        await startTimeDropdown.select(stdStartTime);
        console.log(`Selected time '${stdStartTime}'`);
    } else {
        console.log("Could not find start time dropdown");
        await browser.close();
        return;
    }
    const endTimeDropdown = await frame.$('#oc_end_time') as ElementHandle<HTMLSelectElement> | null;
    if (endTimeDropdown) {
        await endTimeDropdown.select(stdEndTime);
        console.log(`Selected time '${stdEndTime}'`);
    } else {
        console.log("Could not find end time dropdown");
        await browser.close();
        return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    await browser.close();
}

run();