/* Course Copilot — Planning Metadata
 *
 * This layer adds planning-only information that is not present in the
 * original course dataset: estimated country costs and application deadlines.
 * Replace these values with institution/country-verified data before using
 * them as official counselling facts.
 */
(function () {
  const COUNTRY_COSTS = {
    USA: { living: 18000, insurance: 2200, visa: 535 },
    UK: { living: 17000, insurance: 900, visa: 600 },
    Canada: { living: 15000, insurance: 900, visa: 150 },
    Germany: { living: 12000, insurance: 1500, visa: 100 },
    Australia: { living: 19000, insurance: 800, visa: 1100 },
    Ireland: { living: 15000, insurance: 1000, visa: 350 },
    France: { living: 14000, insurance: 500, visa: 110 },
    Netherlands: { living: 15000, insurance: 1600, visa: 250 },
    Sweden: { living: 14000, insurance: 1000, visa: 150 },
    Singapore: { living: 13000, insurance: 700, visa: 70 },
    "New Zealand": { living: 16000, insurance: 700, visa: 450 }
  };

  /*
   * Planning defaults. These are intentionally editable and clearly marked
   * as planning values because the supplied dataset currently has no official
   * application-deadline field/source.
   */
  const DEFAULT_DEADLINES = {
    Jan: "2026-11-15",
    May: "2027-02-15",
    Jul: "2027-04-15",
    Sep: "2027-05-15"
  };

  const COURSE_DEADLINE_OVERRIDES = {
    /* Example:
     * "0": { Sep: "2027-04-30" }
     */
  };

  function yearsFromDuration(duration) {
    const match = String(duration || "").match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return 1;
    const years = Number(match[1]);
    return Number.isFinite(years) && years > 0 ? years : 1;
  }

  function getCountryCost(country) {
    return COUNTRY_COSTS[country] || {
      living: 15000,
      insurance: 1000,
      visa: 250
    };
  }

  function getDeadlineMap(course) {
    const override = COURSE_DEADLINE_OVERRIDES[String(course.id)] || {};
    const map = {};
    (Array.isArray(course.intake) ? course.intake : []).forEach(intake => {
      map[intake] = override[intake] || DEFAULT_DEADLINES[intake] || null;
    });
    return map;
  }

  function enrichCourse(course) {
    const costs = getCountryCost(course.country);
    const years = yearsFromDuration(course.duration || course.dur);
    course.estimatedLivingCostAnnual = costs.living;
    course.estimatedInsuranceAnnual = costs.insurance;
    course.estimatedVisaCost = costs.visa;
    course.estimatedStudyYears = years;
    course.applicationDeadlines = getDeadlineMap(course);
    course.planningDataStatus = "planning-estimate";
    return course;
  }

  function enrichCourses(courseList) {
    if (!Array.isArray(courseList)) return [];
    courseList.forEach(enrichCourse);
    return courseList;
  }

  function estimate(course) {
    const years = Number(course.estimatedStudyYears) || yearsFromDuration(course.duration || course.dur);
    const tuition = Number(course.fee) || 0;
    const living = Number(course.estimatedLivingCostAnnual) || 0;
    const insurance = Number(course.estimatedInsuranceAnnual) || 0;
    const visa = Number(course.estimatedVisaCost) || 0;
    return {
      years,
      tuitionTotal: tuition * years,
      livingTotal: living * years,
      insuranceTotal: insurance * years,
      visaTotal: visa,
      total: tuition * years + living * years + insurance * years + visa,
      annual: tuition + living + insurance
    };
  }

  function nextDeadline(course, today = new Date()) {
    const deadlines = course.applicationDeadlines || {};
    const candidates = Object.entries(deadlines)
      .map(([intake, value]) => ({ intake, date: value ? new Date(value + "T23:59:59") : null }))
      .filter(item => item.date && !Number.isNaN(item.date.getTime()) && item.date >= today)
      .sort((a, b) => a.date - b.date);
    return candidates[0] || null;
  }

  function daysUntil(date, today = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }

  function deadlineInfo(course) {
    const next = nextDeadline(course);
    if (!next) return { next: null, days: null, urgent: false, label: "No upcoming deadline" };
    const days = daysUntil(next.date);
    let label = `${next.intake} intake · ${next.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
    if (days < 0) label = `${next.intake} deadline passed`;
    else if (days === 0) label = `${next.intake} closes today`;
    else if (days === 1) label = `${next.intake} closes tomorrow`;
    else label = `${next.intake} closes in ${days} days`;
    return { next, days, urgent: days <= 30, label };
  }

  function urgencyBonus(course) {
    const info = deadlineInfo(course);
    if (info.days === null || info.days < 0) return 0;
    if (info.days <= 7) return 8;
    if (info.days <= 14) return 6;
    if (info.days <= 30) return 4;
    if (info.days <= 60) return 2;
    return 0;
  }

  window.CourseCopilotPlanning = {
    COUNTRY_COSTS,
    DEFAULT_DEADLINES,
    COURSE_DEADLINE_OVERRIDES,
    enrichCourses,
    estimate,
    deadlineInfo,
    urgencyBonus,
    yearsFromDuration
  };
})();

/* Enrich the loaded course objects immediately after this script is loaded. */
if (typeof courses !== "undefined" && Array.isArray(courses)) {
  window.CourseCopilotPlanning.enrichCourses(courses);
}