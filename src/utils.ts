import * as readline from 'readline';

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