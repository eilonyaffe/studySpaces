import moment from 'moment';
import puppeteer, { ElementHandle } from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { timeSpace, hebrewDayMap, askQuestion, hourTo24hString } from './utils';

const currentDate: moment.Moment = moment();
const fullTime:string = currentDate.format('DD-MM-YYYY_HH-mm-ss')  // used to save a file under data/user_queries/ by date and time

const month:number = currentDate.month();

let semester:number = (month==0 || month<=11 && month>=9) ? 1 :   (month<=5 && month>=2) ? 2 : (month<=8 && month>=6) ?  3 : -1;
console.log(`auto-detected the semester as: ${semester}`);


async function run() {
    const dayStr:string = await askQuestion('enter day number (1 to 6):');
    const dayNum:number = Number(dayStr);
  
    if (isNaN(dayNum) || dayNum <= 0 || dayNum >= 7 || !Number.isInteger(dayNum)) {
      console.error('Invalid number');
      return;
    }

    const dayElement:string = "on_day" + dayStr ;

    const timeStr:string = await askQuestion('enter starting hour (0 to 23):');
    const timeNum:number = Number(timeStr);
  
    if (isNaN(timeNum) || timeNum < 0 || timeNum >= 24 || !Number.isInteger(timeNum)) {
      console.error('Invalid hour');
      return;
    }

    let startTimeNum:number = timeNum - 4;
    startTimeNum = (startTimeNum < 0) ? 0 : startTimeNum; //if the start time is very early

    let EndTimeNum:number = timeNum + 4;
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

    // choosing the correct day
    const dayHandle = await frame.$(`#${dayElement}`) as ElementHandle<HTMLSelectElement> | null;
    if (dayHandle) {
        await dayHandle.click();
        console.log(`✅ Clicked day element '${dayElement}'`);
    } else {
    console.warn(`⚠️ Could not find element with id '${dayElement}'`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // hit search button
    const searchBtn = await frame.$('#GOPAGE2') as ElementHandle<HTMLElement> | null;
      if (searchBtn) {
        await searchBtn.click();
        console.log("Clicked 'search' button");
      } else {
        console.log("Could not find 'search' button");
      }
    
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      frame = page.frames().find(f => f.name() === 'main');
      if (!frame) {
        console.error('Main frame not found after search');
        await browser.close();
        return;
      }
    
      const courseLinks = await frame.$$eval('a', anchors =>
        anchors
          .filter(a => a.href.includes("javascript:goCourseSemester"))
          .map(a => a.getAttribute('href'))
      );
    
      const results: timeSpace[] = [];
    
      let i = 0;
      const total = courseLinks.length;
    
      while (i < total) {
        frame = page.frames().find(f => f.name() === 'main');
        if (!frame) break;
    
        // re-fetch current list of hrefs
        const hrefs: string[] = await frame.$$eval('a', anchors =>
          anchors
            .filter(a => a.href.includes("javascript:goCourseSemester"))
            .map(a => a.getAttribute('href') || '')
        );
    
        const href = hrefs[i];
        if (!href) {
          console.log(`X Skipping missing link at index ${i}`);
          i++;
          continue;
        }
    
        console.log(`➡ Visiting course ${i + 1}/${total}`);
    
        const handle = await frame.evaluateHandle((href) => {
          const a = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
          return a.find(el => el.getAttribute('href') === href) || null;
        }, href);
    
        const courseLink = handle.asElement() as ElementHandle<HTMLAnchorElement> | null;
        if (!courseLink) {
          console.log("X Could not find course link");
          i++;
          continue;
        }
    
        await courseLink.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
    
        const resultFrame2 = page.frames().find(f => f.name() === 'main');
        if (!resultFrame2) {
          console.log("X Missing course details frame");
          i++;
          continue;
        }
    
        const scheduleItems: timeSpace[] = await resultFrame2.evaluate((map) => {
            const seen = new Set<string>();
            const output: timeSpace[] = [];
          
            // every table row on the page
            const rows = Array.from(document.querySelectorAll('tr'));
          
            for (const row of rows) {
              const txt = row.textContent?.replace(/\s+/g, ' ').trim() || '';
          
              // only rows that look like a schedule line
              if (!/יום [א-ז]/.test(txt) || !/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/.test(txt))
                continue;
          
              const day   = map[txt.match(/יום [א-ז]/)![0]] ?? -1;
              const t     = txt.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/)!;
              const start = parseInt(t[1] + t[2]);        // e.g. "13:00" → 1300
              const end   = parseInt(t[3] + t[4]);
              const bld   = +(txt.match(/\[(\d+)\]/)?.[1] ?? -1);
              const room  = +(txt.match(/חדר\s*(\d+)/)?.[1] ?? -1);
          
              const item: any = { building: bld, room, day, start, end };
              if (Object.values(item).includes(-1)) continue;      // reject partial rows
          
              const key = JSON.stringify(item);                    // de-dup
              if (!seen.has(key)) {
                seen.add(key);
                output.push(item);
              }
            }
          
            return output;
        }, hebrewDayMap);
    
        if (scheduleItems.length > 0) {
            results.push(...scheduleItems);
            console.log(`✅ Scraped ${scheduleItems.length} schedule(s):`, scheduleItems);
        } else {
            console.log('ℹ️ Skipped course – no valid schedule entries found');
        }
    
        await resultFrame2.evaluate(() => window.history.back());
    
        // Wait for the frame to reappear and reload fully
        let retries = 0;
        while (retries < 10) {
          frame = page.frames().find(f => f.name() === 'main');
          if (frame) {
            try {
              await frame.waitForFunction(() => {
                return Array.from(document.querySelectorAll('a'))
                      .some(a => a.href.includes("javascript:goCourseSemester"));
              }, { timeout: 3000 });
              break;  // success!
            } catch {
              // retry
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
    
        if (!frame) {
          console.error('❌ Failed to reload frame after going back');
          break;
        }
        i++;
      }
    
      const dir = path.join('data/user_queries');
      const outputPath = path.join(dir, `${fullTime}.json`);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`💾 Saved ${results.length} entries to ${outputPath}`);
    
      await browser.close();
}

run();