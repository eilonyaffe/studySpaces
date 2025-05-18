import * as readline from 'readline';
import fs from 'fs';

export type timeSpace = {
    building: number;
    room: number;
    day: number;
    start: number;
    end: number;
};
  
export const hebrewDayMap: { [key: string]: number } = {
"יום א": 1,
"יום ב": 2,
"יום ג": 3,
"יום ד": 4,
"יום ה": 5,
"יום ו": 6,
"יום ז": 7,
};

export function askQuestion(query: string): Promise<string> {
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

export function hourTo24hString(hour: number): string {
    return hour.toString().padStart(2, '0') + ":00";
}

export function appendResultsToFile(path: string, items: timeSpace[]) {
    const data = items.map(item => JSON.stringify(item)).join(',\n') + ',\n';
    fs.appendFileSync(path, data, 'utf-8');
}

export function initializeFile(path: string) {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, '[\n', 'utf-8');  // Start JSON array
    }
}

export function finalizeFile(path: string) {
    let content = fs.readFileSync(path, 'utf-8').trim();
    if (content.endsWith(',')) content = content.slice(0, -1); // remove trailing comma
    fs.writeFileSync(path, content + '\n]', 'utf-8');
}