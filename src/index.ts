import moment from 'moment';
import puppeteer, { ElementHandle } from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { timeSpace, hebrewDayMap, askQuestion, hourTo24hString } from './utils';

const currentDate: moment.Moment = moment();
const fullTime:string = currentDate.format('DD-MM-YYYY')  // used to save a file under data/user_queries/ by date and time


async function run(semester: string, progressPath: string): Promise<boolean> {

  try {

    const dir = path.join('data/full', `semester_${semester}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const outputPath = path.join(dir, `${fullTime}.json`);
    let fileStream: fs.WriteStream;
    let firstWrite = true;

    if (fs.existsSync(outputPath)) {
        // File already exists — reopen for appending
        let contents = fs.readFileSync(outputPath, 'utf-8').trim();

        if (contents.endsWith("]")) {
            contents = contents.slice(0, -1).trim();  // Remove closing ]
            fs.writeFileSync(outputPath, contents, 'utf-8');
        }

        // Check if we need to add a comma before appending
        firstWrite = !contents.includes("{");  // crude check for whether there are objects
        fileStream = fs.createWriteStream(outputPath, { flags: 'a', encoding: 'utf-8' });
        if (!firstWrite) fileStream.write(',\n');
    } 
    else {
        // First time creating this file
        fileStream = fs.createWriteStream(outputPath, { flags: 'w', encoding: 'utf-8' });
        fileStream.write('[\n');
    }

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
      return false;
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
        return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
        console.error('Search frame not found after click');
        await browser.close();
        return false;
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
        return false;
    }

    const semesterDropdown = await frame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
    if (semesterDropdown) {
      await semesterDropdown.select(semester);
      console.log(`Selected semester '${semester}'`);
    } else {
      console.log("Could not find semester dropdown");
      await browser.close();
      return false;
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
        return false;
      }
    
      const courseLinks = await frame.$$eval('a', anchors =>
        anchors
          .filter(a => a.href.includes("javascript:goCourseSemester"))
          .map(a => a.getAttribute('href'))
      );
        
      let i = 0;
      const total = courseLinks.length;
      
      if (fs.existsSync(progressPath)) {
        const savedIndex = parseInt(fs.readFileSync(progressPath, 'utf-8'), 10);
        if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < total) {
          i = savedIndex;
          console.log(`🔁 Resuming from course ${i + 1}`);
        } else {
          console.log('🔁 Starting from scratch');
        }
      }

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
          console.log(`X Missing link at index ${i} — restarting run from same index`);
          fs.writeFileSync(progressPath, `${i}`, 'utf-8');
          if (browser) await browser.close();
          fileStream.write('\n]\n');
          fileStream.end();
          return await run(semester, progressPath);
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
              fs.writeFileSync(progressPath, `${i + 1}`, 'utf-8');
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
          await new Promise(resolve => setTimeout(resolve, 2000));
        
          frame = page.frames().find(f => f.name() === 'main');
          if (!frame) continue;
        
          try {
            // Wait until the course list reappears
            await frame.waitForFunction(() =>
              Array.from(document.querySelectorAll('a'))
                .some(a => a.href.includes("javascript:goCourseSemester")),
              { timeout: 3000 }
            );
            break;  // success
          } catch {
            retries++;
          }
        }
        
        if (!frame) {
          console.error('❌ Failed to reload frame after going back');
          return false;
        }
        i++;
      }
    
      fileStream.write('\n]\n');  // Close JSON array
      fileStream.end();
      console.log(`💾 Appended output saved to ${outputPath}`);
    
      await browser.close();
      if (i < total) {
        console.log(`⚠️ Incomplete scrape: ${i}/${total}. Run again to resume.`);
        return false;
      } 
      else {
        console.log('🎉 Scrape complete. Deleting progress file.');
        fs.writeFileSync(progressPath, `-1`, 'utf-8');
        return true;
      }
    }
    catch(err){
      console.error('❌ Unexpected error during run():', err);
      return false;
    }
}

async function startWithAutoRetry() {
  const semester = await askQuestion('Enter semester (1, 2, or 3): ');
  if (!['1', '2', '3'].includes(semester)) {
    console.error('Invalid semester value. Please enter 1, 2, or 3.');
    return;
  }

  const progressPath = path.join('data/full/progress_counters', `semester_${semester}.txt`);

  while (true) {
    const completed = await run(semester, progressPath);
    if (completed) break;
    console.log('🔁 Retrying due to incomplete scrape...');
  }
}

startWithAutoRetry();