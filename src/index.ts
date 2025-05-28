import * as cheerio from "cheerio";
import moment from "moment";
import iconv from "iconv-lite";
import path from 'path';
import fs from 'fs';

import {appendResultsToFile, initializeFile, finalizeFile, parseScheduleFromCoursePage, CourseLink, appendToUnscraped } from "./utils";


async function getLinks(semester: string): Promise<[CourseLink[], boolean]> {
  try {
    const currentYear = moment().format("YYYY");
    const body = `rc_rowid=&lang=he&st=a&step=2&oc_course_name=*&on_course_ins=0&on_course_ins_list=0&on_course_department=&on_course_department_list=&on_course_degree_level=&on_course_degree_level_list=&on_course=&on_credit_points=&on_hours=&on_year=${currentYear}&on_semester=${semester}&oc_lecturer_last_name=&oc_lecturer_first_name=&oc_start_time=&oc_end_time=&on_campus=`;

    const res = await fetch("https://bgu4u.bgu.ac.il/pls/scwp/!app.ann", {
      body: body,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    const links: CourseLink[] = [];
    $("a[href^=\"javascript:goCourseSemester\"]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const match = href.match(/goCourseSemester\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/);
      if (match) {
        const [, department, degree_level, course_number, year, semester] = match;
        links.push({ department, degree_level, course_number, year, semester });
      }
    });

    console.log("Extracted links:", links.length);
    return [links, links.length > 0];  // if zero, means the function run failed
  } catch (error) {
    console.error("❌ Error in getLinks:", error);
    return [[], false];
  }
}

async function dataFromPage(course: CourseLink, outputPath: string, first_run: boolean): Promise<void> {
  try {
    const body = `rc_rowid=&lang=he&st=a&step=3&rn_course=${course.course_number}&rn_course_details=&rn_course_department=${course.department}&rn_course_degree_level=${course.degree_level}&rn_course_ins=0&rn_year=${course.year}&rn_semester=${course.semester}&oc_course_name=*&oc_end_time=&oc_lecturer_first_name=&oc_lecturer_last_name=&oc_start_time=&on_campus=&on_common=0&on_course=&on_course_degree_level=&on_course_degree_level_list=&on_course_department=&on_course_department_list=&on_course_ins=0&on_course_ins_list=0&on_credit_points=&on_hours=&on_lang=0&on_semester=${course.semester}&on_year=${course.year}`;

    const res = await fetch("https://bgu4u.bgu.ac.il/pls/scwp/!app.ann", {
      body,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const buffer = Buffer.from(await res.arrayBuffer());
    const html = iconv.decode(buffer, "iso-8859-8");

    const scheduleItems = parseScheduleFromCoursePage(html);

    if (scheduleItems.length > 0) {
      appendResultsToFile(outputPath, scheduleItems);
      console.log(`✅ Scraped ${scheduleItems.length} schedule(s) from course ${course.course_number}:`, scheduleItems);
    } else {
      console.log(`Skipped course ${course.course_number} – no valid schedule entries found`);
      if (first_run) appendToUnscraped(course);
    }
  } catch (err) {
    console.error(`❌ Error in dataFromPage for course ${course.course_number}:`, err);
    if (first_run) appendToUnscraped(course);
  }
}

async function retryBadCourses(outputPath: string): Promise<void> {
  const unscrapedPath = path.join("data", "full", "unscraped.json");

  if (!fs.existsSync(unscrapedPath)) {
    console.log("No unscraped.json file found — skipping retry.");
    return;
  }

  const data = fs.readFileSync(unscrapedPath, "utf-8").trim();
  if (!data || data === "[]") {
    console.log("unscraped.json is empty — nothing to retry.");
    return;
  }

  let courses: CourseLink[];
  try {
    courses = JSON.parse(data);
  } catch (err) {
    console.error("❌ Failed to parse unscraped.json:", err);
    return;
  }

  console.log(`🔁 Retrying ${courses.length} courses from unscraped.json`);

  for (const course of courses) {
    await dataFromPage(course, outputPath, false);
  }

  console.log("✅ Finished retrying unscraped courses");
}


export async function startWithAutoRetryFast(outputPath: string, semester: string, retry: boolean): Promise<void> {

  let links: CourseLink[] = [];
  let gotLinks = false;

  while (!gotLinks) {
    const [retrievedLinks, success] = await getLinks(semester);
    links = retrievedLinks;
    gotLinks = success;

    if (!gotLinks) {
      console.log("Retrying getLinks due to no links retrieved...");
    }
  }
  initializeFile(outputPath);

  for (const link of links) {
    await dataFromPage(link, outputPath, true);
  }

  if (retry) await retryBadCourses(outputPath);

  finalizeFile(outputPath);
}
