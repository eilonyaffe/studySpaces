import path from 'path';
import express, { Request, Response } from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";

const retry:boolean = false;  // controls if we retry scraping courses that weren't successfully scraped the first time

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "../static")));

app.get('/favicon.ico', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../static/favicon.ico"));
});


app.get("/", (req: Request, res: Response) => {
    const indexPath = path.join(__dirname, "../templates/index.html");
    res.sendFile(indexPath);
});


app.listen(port, () => {
    console.log(`The server is running at http://localhost:${port}`);
});
