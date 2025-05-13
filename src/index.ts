import puppeteer, { ElementHandle } from 'puppeteer';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

type timeSpace = {
  building: number;
  room: number;
  day: number;
  start: number;
  end: number;
};

const hebrewDayMap: { [key: string]: number } = {
  "יום א": 1,
  "יום ב": 2,
  "יום ג": 3,
  "יום ד": 4,
  "יום ה": 5,
  "יום ו": 6,
  "יום ז": 7,
};

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve =>
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function run() {
  const semester = await askQuestion('Enter semester (1, 2, or 3): ');
  if (!['1', '2', '3'].includes(semester)) {
    console.error('Invalid semester value. Please enter 1, 2, or 3.');
    return;
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
  
    const data: timeSpace | null = await resultFrame2.evaluate((map) => {
      const td = document.querySelector('td.BlackInput.no_dbg_border_r');
      if (!td) return null;               // ← changed: just skip
    
      const txt = td.textContent || '';
      const day  = map[ (txt.match(/יום [א-ז]/)?.[0] || '') ] ?? -1;
      const t    = txt.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
      const start= t ? parseInt(t[1]+t[2]) : -1;
      const end  = t ? parseInt(t[3]+t[4]) : -1;
      const bld  = +(txt.match(/\[(\d+)\]/)?.[1] ?? -1);
      const room = +(txt.match(/חדר\s*(\d+)/)?.[1] ?? -1);
    
      return { building: bld, room, day, start, end };
    }, hebrewDayMap);
    
    if (data) {
      results.push(data);
      console.log('✅ Scraped:', data);
    } else {
      console.log('ℹ️ Skipped course – no schedule cell');
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

  const dir = path.join('data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const outputPath = path.join(dir, `semester_${semester}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`💾 Saved ${results.length} entries to ${outputPath}`);

  await browser.close();
}

run();
