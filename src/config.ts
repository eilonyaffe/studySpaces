export const SEMESTER:string = '2';  // this is for the server. the scraper uses shell input
export const RETRY:boolean = true;  // controls if we retry scraping courses that weren't successfully scraped the first time TODO change later as environment var
export const DISTANCE_FUNC:string = "euclidian"; // controls how we sort the results. either "euclidian" or "haversine"