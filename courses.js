/* Course Copilot — Course Dataset */

const D = [
  ["MSc Computer Science", "TU Munich", "Germany", "PG", "cs", 3000, ["Sep"], 75, 6.5, "2y", "Public univ: low tuition, strong research"],
  ["MSc Data Science", "University of Toronto", "Canada", "PG", "data", 42000, ["Sep"], 78, 7, "2y", "Co-op route, big tech hub"],
  ["MSc Artificial Intelligence", "University of Edinburgh", "UK", "PG", "data", 36000, ["Sep"], 70, 6.5, "1y", "1-year, Graduate Route visa"],
  ["MS Computer Science", "Arizona State University", "USA", "PG", "cs", 33000, ["Jan", "Sep"], 60, 6.5, "2y", "STEM OPT, flexible intakes"],
  ["MSc Computer Science", "University of Melbourne", "Australia", "PG", "cs", 40000, ["Jan", "Jul"], 65, 6.5, "2y", "Post-study work visa"],
  ["MSc Data Analytics", "University College Dublin", "Ireland", "PG", "data", 27000, ["Sep"], 60, 6.5, "1y", "EU hub, 2y stay-back"],
  ["MBA", "ESSEC Business School", "France", "PG", "business", 45000, ["Sep"], 65, 7, "1y", "Needs work experience"],
  ["MSc International Management", "University of Mannheim", "Germany", "PG", "business", 3000, ["Sep"], 72, 6.5, "2y", "Low tuition, top German business"],
  ["MEng Mechanical Engineering", "TU Delft", "Netherlands", "PG", "eng", 19000, ["Sep"], 72, 6.5, "2y", "Research-heavy, high ranking"],
  ["MS Mechanical Engineering", "Purdue University", "USA", "PG", "eng", 30000, ["Jan", "Sep"], 65, 6.5, "2y", "Strong industry links"],
  ["MPH Public Health", "University of Sydney", "Australia", "PG", "health", 42000, ["Jan", "Jul"], 65, 7, "2y", "Global health focus"],
  ["MSc Health Informatics", "University of Manchester", "UK", "PG", "health", 31000, ["Sep"], 65, 6.5, "1y", "Mix of health + data"],
  ["MDes Interaction Design", "Politecnico di Milano", "Italy", "PG", "design", 4000, ["Sep"], 65, 6, "2y", "Affordable, design capital"],
  ["BSc Computer Science", "University of Waterloo", "Canada", "UG", "cs", 38000, ["Sep"], 85, 6.5, "4y", "Co-op with 6 work terms"],
  ["BSc Data Science", "University of Glasgow", "UK", "UG", "data", 28000, ["Sep"], 70, 6.5, "4y", "Scottish 4y degree"],
  ["BBA Business Admin", "Monash University", "Australia", "UG", "business", 36000, ["Jan", "Jul"], 65, 6.5, "3y", "Foundation pathway available"],
  ["BEng Mechanical Engineering", "TU Berlin", "Germany", "UG", "eng", 500, ["Sep"], 75, 6.5, "3.5y", "Near-zero tuition"],
  ["BSc Computer Science", "University of Arizona", "USA", "UG", "cs", 34000, ["Jan", "Sep"], 62, 6, "4y", "Scholarships for 80%+"],
  ["BDes Communication Design", "Parsons (The New School)", "USA", "UG", "design", 48000, ["Sep"], 68, 6.5, "4y", "Portfolio required"],
  ["BSc Nursing", "University of Limerick", "Ireland", "UG", "health", 19000, ["Sep"], 70, 6.5, "4y", "Clinical placements"]
];

const RAW_COURSES = D.map((r, i) => ({
  id: i,
  name: r[0],
  uni: r[1],
  country: r[2],
  level: r[3],
  field: r[4],
  fee: r[5],
  intake: r[6],
  pct: r[7],
  ielts: r[8],
  dur: r[9],
  note: r[10],
  source_url: null,
  last_verified: null
}));

const courses = window.CourseCopilotCourseData.build(RAW_COURSES);

const COURSE_DATA_SUMMARY = window.CourseCopilotCourseData.getSummary(courses);

console.info("Course Copilot course data:", COURSE_DATA_SUMMARY);