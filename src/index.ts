import moment from 'moment';
import puppeteer, { ElementHandle } from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { timeSpace, hebrewDayMap, askQuestion, hourTo24hString } from './utils';

const currentDate: moment.Moment = moment();
const fullTime:string = currentDate.format('DD-MM-YYYY')  // used to save a file under data/user_queries/ by date and time


async function run() {


    const semester = await askQuestion('Enter semester (1, 2, or 3): ');
    if (!['1', '2', '3'].includes(semester)) {
      console.error('Invalid semester value. Please enter 1, 2, or 3.');
      return;
    }

    const dir = path.join('data/full');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
    const outputPath = path.join(dir, `semester_${semester}_${fullTime}.json`);
    const fileStream = fs.createWriteStream(outputPath, { flags: 'w', encoding: 'utf-8' });
    fileStream.write('[\n');  // Start of JSON array
  
    let firstWrite = true;

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

    const semesterDropdown = await frame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
    if (semesterDropdown) {
      await semesterDropdown.select(semester);
      console.log(`Selected semester '${semester}'`);
    } else {
      console.log("Could not find semester dropdown");
      await browser.close();
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // hit search button
    const searchBtn = await frame.$('#GOPAGE2') as ElementHandle<HTMLElement> | null;
      if (searchBtn) {
        await searchBtn.click();
        console.log("Clicked 'search' button");
      } else {
        console.log("Could not find 'search' button");
      }
    
      await new Promise(resolve => setTimeout(resolve, 2000));
    
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
          
              const day:number = map[txt.match(/יום [א-ז]/)![0]] ?? -1;
              
              const t = txt.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/)!;
              const start:number = parseInt(t[1] + t[2]);        // e.g. "13:00" → 1300
              const end:number = parseInt(t[3] + t[4]);

              const bld:number = +(txt.match(/\[(\d+)\]/)?.[1] ?? -1);
              const room:number = +(txt.match(/חדר\s*(-?\d+)/)?.[1] ?? -1);
          
              const item: any = { building: bld, room, day, start, end };
              if (Object.values(item).includes(-1)) continue;      // reject partial rows
          
              const key:string = JSON.stringify(item);                    // de-dup
              if (!seen.has(key)) {
                seen.add(key);
                output.push(item);
              }
            }
          
            return output;
          }, hebrewDayMap);
    
        if (scheduleItems.length > 0) {
          for (const item of scheduleItems) {
              if (!firstWrite) fileStream.write(',\n');
              fileStream.write(JSON.stringify(item, null, 2));
              firstWrite = false;
          }
          console.log(`✅ Scraped ${scheduleItems.length}`);
        } 
        else {
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
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries++;
        }
    
        if (!frame) {
          console.error('❌ Failed to reload frame after going back');
          break;
        }
        i++;
      }
    
      fileStream.write('\n]\n');  // Close JSON array
      fileStream.end();
      console.log(`💾 Appended output saved to ${outputPath}`);
    
      await browser.close();
}

run();
