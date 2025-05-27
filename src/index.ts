import * as cheerio from "cheerio";
import moment from "moment";
import iconv from "iconv-lite";

import {appendResultsToFile, initializeFile, finalizeFile, parseScheduleFromCoursePage } from "./utils";

type CourseLink = {
  department: string;
  degree_level: string;
  course_number: string;
  year: string;
  semester: string;
};

async function get_links(semester:string): Promise<CourseLink[]> {
  try {
    const currentYear = moment().format("YYYY");  // get current year dynamically
    const body = `rc_rowid=&lang=he&st=a&step=2&oc_course_name=*&on_course_ins=0&on_course_ins_list=0&on_course_department=&on_course_department_list=&on_course_degree_level=&on_course_degree_level_list=&on_course=&on_credit_points=&on_hours=&on_year=${currentYear}&on_semester=${semester}&oc_lecturer_last_name=&oc_lecturer_first_name=&oc_start_time=&oc_end_time=&on_campus=`;

    const res = await fetch("https://bgu4u.bgu.ac.il/pls/scwp/!app.ann", {
      body: "rc_rowid=&lang=he&st=a&step=2&oc_course_name=*&on_course_ins=0&on_course_ins_list=0&on_course_department=&on_course_department_list=&on_course_degree_level=&on_course_degree_level_list=&on_course=&on_credit_points=&on_hours=&on_year=2025&on_semester=2&oc_lecturer_last_name=&oc_lecturer_first_name=&oc_start_time=&oc_end_time=&on_campus=",
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
    return links;
  } catch (error) {
    console.error("❌ Error in get_links:", error);
    return [];
  }
}

async function data_from_page(course: CourseLink, outputPath: string): Promise<void> {
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
    }
  } catch (err) {
    console.error(`❌ Error in data_from_page for course ${course.course_number}:`, err);
  }
}

export async function startWithAutoRetryFast(outputPath: string, semester:string): Promise<void> {


  const links = await get_links(semester);
  initializeFile(outputPath);

  for (const link of links) {
    await data_from_page(link, outputPath);
  }

  finalizeFile(outputPath);
}
