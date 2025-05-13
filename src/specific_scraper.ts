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
  const day = await askQuestion('Enter semester (1, 2, or 3): ');
  if (!['1', '2', '3'].includes(semester)) {
    console.error('Invalid semester value. Please enter 1, 2, or 3.');
    return;
  }
  const start = await askQuestion('Enter semester (1, 2, or 3): ');
  if (!['1', '2', '3'].includes(semester)) {
    console.error('Invalid semester value. Please enter 1, 2, or 3.');
    return;
  }
  const end = await askQuestion('Enter semester (1, 2, or 3): ');
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


  await browser.close();
}

run();
