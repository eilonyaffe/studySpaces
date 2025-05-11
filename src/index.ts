import puppeteer, { ElementHandle } from 'puppeteer';
import * as readline from 'readline';

// Prompt the user for input
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

  const browser = await puppeteer.launch({ headless: false });  // launch chromium
  const page = await browser.newPage();  // open a new page

  await page.goto('https://bgu4u.bgu.ac.il/pls/scwp/!app.gate?app=ann', {
    waitUntil: 'domcontentloaded',
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const frame = page.frames().find(f => f.name() === 'main');
  if (!frame) {
    console.error('Main frame not found');
    await browser.close();
    return;
  }

  // Click "חיפוש מורחב"
  const handle = await frame.evaluateHandle(() => {
    const xpath = "//a[contains(text(), 'חיפוש מורחב')]";
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue as HTMLElement | null;
  });

  const elementHandle = handle.asElement() as ElementHandle<HTMLElement> | null;
  if (elementHandle) {
    await elementHandle.click();
    console.log("✅ Clicked 'advanced search'");
  } else {
    console.log("Could not find 'advanced search'");
    await browser.close();
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Re-fetch the frame after the page reloads to the advanced search screen
  const searchFrame = page.frames().find(f => f.name() === 'main');
  if (!searchFrame) {
    console.error('Search frame not found after click');
    await browser.close();
    return;
  }

  // input * instead of course name
  const inputHandle = await searchFrame.$('#oc_course_name');

  const inputField = inputHandle as ElementHandle<HTMLInputElement> | null;
  if (inputField) {
    await inputField.click({ clickCount: 3 }); // select existing text
    await inputField.type('*');
    console.log("Typed '*' into course name field");
  } else {
    console.log("Could not find course name input field");
    await browser.close();
    return;
  }

  // choose a different semester per the user's input
  const semesterDropdown = await searchFrame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
  if (semesterDropdown) {
    await semesterDropdown.select(semester);
    console.log(`Selected semester '${semester}'`);
  } else {
    console.log("Could not find semester dropdown");
    await browser.close();
    return;
  }

  // Click the "חפש" button
  const searchBtn = await searchFrame.$('#GOPAGE2') as ElementHandle<HTMLElement> | null;

  if (searchBtn) {
    await searchBtn.click();
    console.log("Clicked 'search' button");
  } else {
    console.log("Could not find 'search' button");
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  await browser.close();
}

run();
