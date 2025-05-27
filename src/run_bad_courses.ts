import puppeteer, { ElementHandle, Browser } from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { timeSpace, hebrewDayMap, appendResultsToFile, finalizeFile } from './utils';


export async function runBadCourses(browser: Browser, semester: string, outputPath: string): Promise<boolean> {
    let alertDetected = false;
    const unscrapedPath = path.join('data/full', 'unscraped.txt');
    if (!fs.existsSync(unscrapedPath)) {
        console.log('🟢 Nothing to retry – file missing/empty.');
        return true;
    }
    const page = await browser.newPage();

    const badIndices = fs.readFileSync(unscrapedPath, 'utf-8').split(/\r?\n/).filter(Boolean).map(Number);

    if (badIndices.length === 0) {
        console.log('🟢 unscraped.txt is empty – nothing to redo.');
        return true;
    }

    console.log(`➡ will retry ${badIndices.length} failed courses`);

    try{
      page.on('dialog', async dialog => {
        const message = dialog.message();
        if (message.includes('הקורס אינו קיים') || message.includes('לא נמצאו קורסים')) {
          console.warn('⚠️ Alert detected: No matching courses.');
          alertDetected = true;
          await dialog.accept();
        }
      });
    }
    catch (err){
      console.error("Error loading the dialog box:", err);
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));  // let dialog resolve

    if (alertDetected) {
      return true;
    }
    
    try{
      await page.goto('https://bgu4u.bgu.ac.il/pls/scwp/!app.gate?app=ann', {
        waitUntil: 'domcontentloaded',
      });
    }
    catch (err){
      console.error("Error loading the URL:", err);
      return false;
    }
  
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for the page to load


    let frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
      console.error('Main frame not found');
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
      console.error("Error finding 'advanced search' link:", err);
      return false;
    }
    
    const elementHandle = handle.asElement() as ElementHandle<HTMLElement> | null;
    if (elementHandle) {
      try{
        await elementHandle.click();
        console.log("V Clicked 'advanced search'");
      }
      catch (err){
        console.error("Failed to click 'advanced search':", err);
        return false;
      }
    } else {
        console.log("Could not find 'advanced search'");
        return false;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for advanced search page load

    try{
      frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
        console.error('Search frame not found after click');
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
        return false;
    }

    // entering the correct semester's number
    const semesterDropdown = await frame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
    if (semesterDropdown) {
        await semesterDropdown.select(semester.toString());
        console.log(`Selected semester '${semester}'`);
    } else {
        console.log("Could not find semester dropdown");
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
          console.error("Failed to click 'search':", err);
          return false;
        }
      } else {
        console.log("Could not find 'search' button");
        return false;
      }
    }
    catch (err){
      console.error("Error handling the advanced search parameters insertion", err);
      return false;
    }
    
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  
    frame = page.frames().find(f => f.name() === 'main');
    if (!frame) {
      console.error('Main frame not found after search');
      return false;
    }
  
    await new Promise(resolve => setTimeout(resolve, 5000)); //must keep! ensures all course links load to correctly count courseLinks

      
  for (const idx of badIndices) {
      frame = page.frames().find(f => f.name() === 'main');
      if (!frame) break;
  
      // re-fetch current list of hrefs
      const hrefs: string[] = await frame.$$eval('a', anchors =>
        anchors
          .filter(a => a.href.includes("javascript:goCourseSemester"))
          .map(a => a.getAttribute('href') || '')
      );
  
      const href = hrefs[idx];
      if (!href) {
        console.log(`X Skipping missing link at index ${idx}`);
        return false;
      }
          
      let handle;
      try{
        handle = await frame.evaluateHandle((href) => {
          const a = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
          return a.find(el => el.getAttribute('href') === href) || null;
        }, href);
      }
      catch (err){
        console.error("Failed to enter course:", err);
        return false;
      }
        
      if (handle!=null){
        const courseLink = handle.asElement() as ElementHandle<HTMLAnchorElement> | null;
        if (!courseLink) {
          console.log("Could not find course link");
          return false;
        }
        try{
          await courseLink.click();
        }
        catch (err){
          console.error("Failed to click 'course link':", err);
          return false;
        }
      }
      else{
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
  
      const resultFrame2 = page.frames().find(f => f.name() === 'main');
      if (!resultFrame2) {
        console.log("Missing course details frame");
        return false;
      }
      let scheduleItems: timeSpace[] = [];
      try {
        scheduleItems = await resultFrame2.evaluate((map) => {
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

              if ([1,2,3,4,5,6,7,14,47,48,25,24,9].includes(bld)) continue;
              if (bld === 26 && /המרכז לאנרגיה.*\[26\]/.test(txt)) continue;

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
      } catch (err){
        console.error("Failed to extract schedule from course detail page:", err);
        continue;
      }
  
      if (scheduleItems.length > 0) {
        appendResultsToFile(outputPath, scheduleItems);
        console.log(`✅ Scraped ${scheduleItems.length} schedule(s):`, scheduleItems);
      } else {
          console.log('Skipped course – no valid schedule entries found');
      }
      
      try{
        await resultFrame2.evaluate(() => window.history.back());
      }
      catch(err){
        console.error("Failed to go back:", err);
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
        console.error('Failed to reload frame after going back');
        break;
      }
    } //went through all courses
  
    return true;
}


export async function startWithAutoRetryBadCourses(outputPath:string, semester:string) {
  while (true) {
    const browser = await puppeteer.launch({ headless: false });
    try {
      const completed = await runBadCourses(browser, semester, outputPath);
      if (completed) break;
    } catch (err) {
      console.error("General error with run:", err);
      // retry
    } finally {
      await browser.close();
    }
  }
  finalizeFile(outputPath);
}
