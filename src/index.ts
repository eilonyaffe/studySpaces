import puppeteer, { ElementHandle } from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

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
    console.log("✅ Clicked 'חיפוש מורחב'");
  } else {
    console.log("❌ Could not find 'חיפוש מורחב'");
    await browser.close();
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Re-fetch the frame after the page changes
  const searchFrame = page.frames().find(f => f.name() === 'main');
  if (!searchFrame) {
    console.error('Search frame not found after click');
    await browser.close();
    return;
  }

  // Use XPath to find the input for course name
  const inputHandle = await searchFrame.$('#oc_course_name');


  const inputField = inputHandle as ElementHandle<HTMLInputElement> | null;
  if (inputField) {
    await inputField.click({ clickCount: 3 }); // select existing text
    await inputField.type('*');
    console.log("✅ Typed '*' into course name field");
  } else {
    console.log("❌ Could not find course name input field");
    await browser.close();
    return;
  }

  // choose a different semester
  const semesterDropdown = await searchFrame.$('#on_semester') as ElementHandle<HTMLSelectElement> | null;
  if (semesterDropdown) {
    await semesterDropdown.select('2');
    console.log("✅ Selected semester '2'");
  } else {
    console.log("❌ Could not find semester dropdown");
    await browser.close();
    return;
  }

  // Click the "חפש" button
  const searchBtn = await searchFrame.$('#GOPAGE2') as ElementHandle<HTMLElement> | null;

  if (searchBtn) {
    await searchBtn.click();
    console.log("✅ Clicked 'חפש' button");
  } else {
    console.log("❌ Could not find 'חפש' button");
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
  await browser.close();
}

run();
