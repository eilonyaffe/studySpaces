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

let totalToScrape:number = -1; //starting value, indicates that wasn't changed yet in run
let alertDetected = false;

async function run(dayString:string, stdStartTime:string, stdEndTime:string, dayNum:number, startTimeNum:number, EndTimeNum:number): Promise<boolean> {
    //start browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    page.on('dialog', async dialog => {
      const message = dialog.message();
      if (message.includes('הקורס אינו קיים') || message.includes('לא נמצאו קורסים')) {
        console.warn('⚠️ Alert detected: No matching courses.');
        alertDetected = true;
        await dialog.accept();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1500));  // let dialog resolve

    if (alertDetected) {
      await browser.close();
      return true;
    }
    
    try{
      await page.goto('https://bgu4u.bgu.ac.il/pls/scwp/!app.gate?app=ann', {
        waitUntil: 'domcontentloaded',
      });
    }
    catch (err){
      console.error("❌ Error loading the URL:", err);
      await browser.close();
      return false;
    }
  
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for the page to load
  
    let frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
      console.error('Main frame not found');
      await browser.close();
      return false;
    }

    //click extended search
    let handle;
    try{
      handle = await frame.evaluateHandle(() => {
        const xpath = "//a[contains(text(), 'חיפוש מורחב')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue as HTMLElement | null;
    });
    } catch (err){
      console.error("❌ Error finding 'advanced search' link:", err);
      await browser.close();
      return false;
    }
    
    const elementHandle = handle.asElement() as ElementHandle<HTMLElement> | null;
    if (elementHandle) {
      try{
        await elementHandle.click();
        console.log("V Clicked 'advanced search'");
      }
      catch (err){
        console.error("❌ Failed to click 'advanced search':", err);
        await browser.close();
        return false;
      }
    } else {
        console.log("X Could not find 'advanced search'");
        await browser.close();
        return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for advanced search page load

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

    // entering the correct semester's number
    const semesterDropdown = await frame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
    if (semesterDropdown) {
        await semesterDropdown.select(semester.toString());
        console.log(`Selected semester '${semester}'`);
    } else {
        console.log("Could not find semester dropdown");
        await browser.close();
        return false;
    }

    // choosing the time range
    const startTimeDropdown = await frame.$('#oc_start_time') as ElementHandle<HTMLSelectElement> | null;
    if (startTimeDropdown) {
        await startTimeDropdown.select(stdStartTime);
        console.log(`Selected time '${stdStartTime}'`);
    } else {
        console.log("Could not find start time dropdown");
        await browser.close();
        return false;
    }
    const endTimeDropdown = await frame.$('#oc_end_time') as ElementHandle<HTMLSelectElement> | null;
    if (endTimeDropdown) {
        await endTimeDropdown.select(stdEndTime);
        console.log(`Selected time '${stdEndTime}'`);
    } else {
        console.log("Could not find end time dropdown");
        await browser.close();
        return false;
    }

    // choosing the correct day
    const dayHandle = await frame.$(`#${dayString}`) as ElementHandle<HTMLSelectElement> | null;
    if (dayHandle) {
      try{
        await dayHandle.click();
        console.log(`✅ Clicked day element '${dayString}'`);
      }
      catch (err){
        console.error("❌ Failed to click 'day element':", err);
        await browser.close();
        return false;
      }

    } else {
      console.warn(`⚠️ Could not find element with id '${dayString}'`);
      await browser.close();
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));

    // hit search button
    const searchBtn = await frame.$('#GOPAGE2') as ElementHandle<HTMLElement> | null;
      if (searchBtn) {
        try{
          await searchBtn.click();
          console.log("Clicked 'search' button");
        }
        catch (err){
          console.error("❌ Failed to click 'search':", err);
          await browser.close();
          return false;
        }
      } else {
        console.log("Could not find 'search' button");
        await browser.close();
        return false;
      }
    
      await new Promise(resolve => setTimeout(resolve, 1000));
    
      frame = page.frames().find(f => f.name() === 'main');
      if (!frame) {
        console.error('Main frame not found after search');
        await browser.close();
        return false;
      }
    
      await new Promise(resolve => setTimeout(resolve, 2000)); //must keep! ensures all course links load to correctly count courseLinks

      const courseLinks = await frame.$$eval('a', anchors => //calulate the number of courses needed to scrape
        anchors
          .filter(a => a.href.includes("javascript:goCourseSemester"))
          .map(a => a.getAttribute('href'))
      );
      const total = courseLinks.length;
      console.log(`🔍 Found ${total} courses to check`);
      if (total == 0){ // this is a problem. when there aren't any corresponding courses, there will be a browser flashing
        console.log("Error loading the courses");
        await browser.close();
        return false;
      }
      const results: timeSpace[] = [];
    
      let i = 0;
    
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
          return false;
        }
    
        console.log(`➡ Visiting course ${i + 1}/${total}`);
        
        let handle;
        try{
          handle = await frame.evaluateHandle((href) => {
            const a = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
            return a.find(el => el.getAttribute('href') === href) || null;
          }, href);
        }
        catch (err){
          console.error("Failed to enter course:", err);
          await browser.close();
          return false;
        }
        
        if (handle!=null){
          const courseLink = handle.asElement() as ElementHandle<HTMLAnchorElement> | null;
          if (!courseLink) {
            console.log("X Could not find course link");
            i++;
            continue;
          }
          try{
            await courseLink.click();
          }
          catch (err){
            console.error("❌ Failed to click 'course link':", err);
            await browser.close();
            return false;
          }
        }
        else{
          return false;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    
        const resultFrame2 = page.frames().find(f => f.name() === 'main');
        if (!resultFrame2) {
          console.log("X Missing course details frame");
          i++;
          continue;
        }
        let scheduleItems: timeSpace[] = [];
        try {
          scheduleItems = await resultFrame2.evaluate((map, userDay, startTimeNum, EndTimeNum) => {
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
                
                if (day !== userDay) continue;
  
                const t = txt.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/)!;
                const start:number = parseInt(t[1] + t[2]);        // e.g. "13:00" → 1300
                const end:number = parseInt(t[3] + t[4]);
  
                if (end <= startTimeNum || start >= EndTimeNum) continue;
  
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
            }, hebrewDayMap, dayNum, startTimeNum, EndTimeNum);
        } catch (err){
          console.error("❌ Failed to extract schedule from course detail page:", err);
          continue;
        }
    
        if (scheduleItems.length > 0) {
            results.push(...scheduleItems);
            console.log(`✅ Scraped ${scheduleItems.length} schedule(s):`, scheduleItems);
        } else {
            console.log('ℹ️ Skipped course – no valid schedule entries found');
        }
        
        try{
          await resultFrame2.evaluate(() => window.history.back());
        }
        catch(err){
          console.error("❌ Failed to go back:", err);
          await browser.close();
          return false;
        }
    
        // Wait for the frame to reappear and reload fully
        let retries = 0;
        while (retries < 10) {
          frame = page.frames().find(f => f.name() === 'main');
          if (frame) {
            try {
              await frame.waitForFunction(() => {
                return Array.from(document.querySelectorAll('a'))
                      .some(a => a.href.includes("javascript:goCourseSemester"));
              }, { timeout: 2000 });
              break;  // success!
            } catch {
              // retry
            }
          }
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }
    
        if (!frame) {
          console.error('❌ Failed to reload frame after going back');
          break;
        }
        i++;
      } //went through all courses
    
      const dir = path.join('data/user_queries');
      const outputPath = path.join(dir, `${fullTime}.json`);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`💾 Saved ${results.length} entries to ${outputPath}`);
    
      await browser.close();
      return true;
}


async function startWithAutoRetry() {

  //choose day
  const dayStr:string = await askQuestion('enter day number (1 to 6):');
  const dayNum:number = Number(dayStr);
  if (isNaN(dayNum) || dayNum <= 0 || dayNum >= 7 || !Number.isInteger(dayNum)) {
    console.error('Invalid number');
    startWithAutoRetry();
  }
  const dayElement:string = "on_day" + dayStr ;

  //choose starting hour
  const timeStartStr:string = await askQuestion('enter starting hour (0 to 23):');
  const timeStartNum:number = Number(timeStartStr);
  if (isNaN(timeStartNum) || timeStartNum < 0 || timeStartNum >= 24 || !Number.isInteger(timeStartNum)) {
    console.error('Invalid hour');
    startWithAutoRetry();
  }

  //choose ending hour
  const timeEndStr:string = await askQuestion('enter ending hour (0 to 23):');
  const timeEndNum:number = Number(timeEndStr);
  if (isNaN(timeEndNum) || timeEndNum < 0 || timeEndNum >= 24 || !Number.isInteger(timeEndNum) || timeEndNum <= timeStartNum) {
    console.error('Invalid hour or hours range');
    startWithAutoRetry();
  }


  const accuracy:string = await askQuestion('enter accuracy(low or high ):');
  const accuracy_range:number = (accuracy == "high") ? 4 : 2 ;

  const startTimeRanged:number = (timeStartNum - accuracy_range < 0) ? 0 : (timeStartNum - accuracy_range);
  const endTimeRanged:number = (timeEndNum + accuracy_range > 23) ? 23 : (timeEndNum + accuracy_range);

  const stdStartTime:string = hourTo24hString(startTimeRanged);
  const stdEndTime:string = hourTo24hString(endTimeRanged);


  while (true) {
    const completed = await run(dayElement, stdStartTime, stdEndTime, dayNum, timeStartNum * 100, timeEndNum * 100);
    if (completed) break;
  }
}

startWithAutoRetry();