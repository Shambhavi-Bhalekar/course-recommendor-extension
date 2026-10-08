/* Course Copilot — Impact-Based Ask Next Module */

(function () {

  const ASK_NEXT_CONFIG = {

    /*
     * Candidate values used to simulate possible answers.
     * These are intentionally broad and can later be replaced
     * with values learned from the course database.
     */

    budget: [
      15000,
      25000,
      35000,
      50000
    ],

    pct: [
      60,
      70,
      80,
      90
    ],

    ielts: [
      6,
      6.5,
      7,
      7.5,
      8
    ],

    level: [
      "UG",
      "PG"
    ],

    field: [
      "cs",
      "data",
      "business",
      "eng",
      "health",
      "design"
    ],

    intake: [
      "Jan",
      "May",
      "Sep"
    ],

    country: [
      "USA",
      "UK",
      "Canada",
      "Germany",
      "Australia"
    ]
  };


  /*
   * Human-readable questions.
   */

  const QUESTIONS = {

    budget: {
      label: "Budget",
      question: "What is the student's approximate annual budget?"
    },

    pct: {
      label: "Academic score",
      question: "What is the student's academic percentage / score?"
    },

    ielts: {
      label: "IELTS",
      question: "What IELTS score does the student have?"
    },

    level: {
      label: "Study level",
      question: "Is the student looking for UG or PG?"
    },

    field: {
      label: "Field",
      question: "What field does the student want to study?"
    },

    intake: {
      label: "Intake",
      question: "Which intake is the student targeting?"
    },

    country: {
      label: "Country",
      question: "Which countries is the student open to?"
    }
  };


  /*
   * Default scoring weights.
   *
   * These mirror the current recommendation engine.
   */
  const WEIGHTS = {
    field: 35,
    budget: 20,
    pct: 15,
    ielts: 10,
    country: 12,
    intake: 8
  };


  /*
   * Convert a value safely to a number.
   */
  function number(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
  }


  /*
   * Check whether a profile criterion is known.
   */
  function known(profile, key) {

    if (!profile) {
      return false;
    }

    if (key === "country") {

      return (
        Array.isArray(profile.preferredCountries) &&
        profile.preferredCountries.length > 0
      ) || (
        Array.isArray(profile.excludedCountries) &&
        profile.excludedCountries.length > 0
      );
    }

    const value = profile[key];

    return (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    );
  }


  /*
   * Clone a profile without modifying the real student profile.
   */
  function cloneProfile(profile) {

    return JSON.parse(
      JSON.stringify(profile || {})
    );
  }


  /*
   * Apply a simulated answer to a cloned profile.
   */
  function applyAnswer(profile, criterion, value) {

    const simulated = cloneProfile(profile);

    if (criterion === "country") {

      simulated.preferredCountries = [value];

      simulated.excludedCountries =
        simulated.excludedCountries || [];

    } else {

      simulated[criterion] = value;
    }

    return simulated;
  }


  /*
   * Calculate a course score.
   *
   * This deliberately mirrors the current Course Copilot
   * recommendation logic.
   */
  function scoreCourse(course, profile) {

    let score = 0;
    let possible = 0;

    /*
     * FIELD
     */
    if (known(profile, "field")) {

      possible += WEIGHTS.field;

      if (
        course.field &&
        String(course.field).toLowerCase() ===
        String(profile.field).toLowerCase()
      ) {
        score += WEIGHTS.field;
      }
    }


    /*
     * BUDGET
     */
    if (known(profile, "budget")) {

      possible += WEIGHTS.budget;

      const budget = number(profile.budget);
      const fee = number(course.fee);

      if (budget !== null && fee !== null) {

        if (fee <= budget) {
          score += WEIGHTS.budget;
        } else {

          const over =
            (fee - budget) / Math.max(budget, 1);

          score +=
            WEIGHTS.budget *
            Math.max(0, 1 - over);
        }
      }
    }


    /*
     * ACADEMIC SCORE
     */
    if (known(profile, "pct")) {

      possible += WEIGHTS.pct;

      const pct = number(profile.pct);
      const minPct = number(course.minPct);

      if (
        pct !== null &&
        minPct !== null
      ) {

        if (pct >= minPct) {
          score += WEIGHTS.pct;
        } else {

          const gap =
            (minPct - pct) /
            Math.max(minPct, 1);

          score +=
            WEIGHTS.pct *
            Math.max(0, 1 - gap);
        }
      }
    }


    /*
     * IELTS
     */
    if (known(profile, "ielts")) {

      possible += WEIGHTS.ielts;

      const ielts = number(profile.ielts);
      const required = number(course.ielts);

      if (
        ielts !== null &&
        required !== null
      ) {

        if (ielts >= required) {
          score += WEIGHTS.ielts;
        } else {

          const gap =
            (required - ielts) /
            Math.max(required, 1);

          score +=
            WEIGHTS.ielts *
            Math.max(0, 1 - gap);
        }
      }
    }


    /*
     * COUNTRY
     */
    if (known(profile, "country")) {

      possible += WEIGHTS.country;

      const preferred =
        profile.preferredCountries || [];

      const excluded =
        profile.excludedCountries || [];

      if (excluded.includes(course.country)) {

        /*
         * Explicitly avoided country.
         */
        score += 0;

      } else if (
        preferred.length === 0 ||
        preferred.includes(course.country)
      ) {

        score += WEIGHTS.country;
      }
    }


    /*
     * INTAKE
     */
    if (known(profile, "intake")) {

      possible += WEIGHTS.intake;

      if (
        Array.isArray(course.intake) &&
        course.intake.includes(profile.intake)
      ) {
        score += WEIGHTS.intake;
      }
    }


    /*
     * Normalize score to 100.
     */
    if (possible === 0) {
      return 0;
    }

    return (score / possible) * 100;
  }


  /*
   * Rank courses for a given profile.
   */
  function rankCourses(courses, profile) {

    if (!Array.isArray(courses)) {
      return [];
    }

    return courses
      .map(course => ({
        course,
        score: scoreCourse(course, profile)
      }))
      .sort((a, b) => b.score - a.score);
  }


  /*
   * Get course names from Top N.
   */
  function topNames(ranked, n = 5) {

    return ranked
      .slice(0, n)
      .map(item => item.course.name);
  }


  /*
   * Calculate overlap between two Top-5 lists.
   */
  function topOverlap(base, scenario) {

    const baseSet = new Set(base);
    const scenarioSet = new Set(scenario);

    let common = 0;

    scenarioSet.forEach(name => {

      if (baseSet.has(name)) {
        common++;
      }

    });

    return common;
  }


  /*
   * Calculate how much the Top-5 changed.
   *
   * Higher score = more recommendation impact.
   */
  function calculateTop5Impact(baseRanked, scenarioRanked) {

    const baseTop = topNames(baseRanked, 5);
    const scenarioTop = topNames(scenarioRanked, 5);

    const common = topOverlap(
      baseTop,
      scenarioTop
    );

    const membershipChange =
      5 - common;

    /*
     * Calculate rank movement for courses
     * appearing in both lists.
     */
    const basePositions = {};

    baseTop.forEach((name, index) => {
      basePositions[name] = index;
    });

    let rankMovement = 0;

    scenarioTop.forEach((name, index) => {

      if (
        Object.prototype.hasOwnProperty.call(
          basePositions,
          name
        )
      ) {

        rankMovement += Math.abs(
          basePositions[name] - index
        );
      }
    });


    /*
     * Score spread tells us whether the
     * simulated answer meaningfully separates
     * courses.
     */
    const baseScores =
      baseRanked
        .slice(0, 5)
        .map(item => item.score);

    const scenarioScores =
      scenarioRanked
        .slice(0, 5)
        .map(item => item.score);

    const baseSpread =
      baseScores.length > 1
        ? Math.max(...baseScores) -
          Math.min(...baseScores)
        : 0;

    const scenarioSpread =
      scenarioScores.length > 1
        ? Math.max(...scenarioScores) -
          Math.min(...scenarioScores)
        : 0;

    const spreadChange =
      Math.abs(
        scenarioSpread - baseSpread
      );


    /*
     * Combined impact score.
     */
    const impact =
      membershipChange * 20 +
      rankMovement * 5 +
      spreadChange;


    return {
      impact,
      membershipChange,
      rankMovement,
      spreadChange,
      baseTop,
      scenarioTop
    };
  }


  /*
   * Evaluate one missing criterion.
   */
  function evaluateCriterion(
    criterion,
    courses,
    profile
  ) {

    if (known(profile, criterion)) {
      return null;
    }

    const possibleValues =
      ASK_NEXT_CONFIG[criterion];

    if (!possibleValues) {
      return null;
    }

    const baseRanked =
      rankCourses(courses, profile);

    let totalImpact = 0;
    const scenarios = [];

    for (const value of possibleValues) {

      const simulated =
        applyAnswer(
          profile,
          criterion,
          value
        );

      const scenarioRanked =
        rankCourses(
          courses,
          simulated
        );

      const impact =
        calculateTop5Impact(
          baseRanked,
          scenarioRanked
        );

      totalImpact += impact.impact;

      scenarios.push({
        value,
        ...impact
      });
    }


    const averageImpact =
      scenarios.length > 0
        ? totalImpact / scenarios.length
        : 0;


    const strongestScenario =
      scenarios
        .slice()
        .sort(
          (a, b) =>
            b.impact - a.impact
        )[0];


    return {

      criterion,

      label:
        QUESTIONS[criterion]?.label ||
        criterion,

      question:
        QUESTIONS[criterion]?.question ||
        `What is the student's ${criterion}?`,

      averageImpact,

      strongestImpact:
        strongestScenario
          ? strongestScenario.impact
          : 0,

      scenarios
    };
  }


  /*
   * Generate the ranked Ask Next questions.
   */
  function getNextQuestions(
    courses,
    profile,
    limit = 3
  ) {

    if (!Array.isArray(courses)) {
      return [];
    }

    const criteria =
      Object.keys(WEIGHTS);

    const evaluations = [];

    for (const criterion of criteria) {

      const result =
        evaluateCriterion(
          criterion,
          courses,
          profile
        );

      if (result) {
        evaluations.push(result);
      }
    }


    /*
     * Blend actual recommendation impact
     * with the existing importance weight.
     */
    evaluations.forEach(item => {

      const weight =
        WEIGHTS[item.criterion] || 0;

      item.finalImpact =
        item.averageImpact +
        weight * 0.5;
    });


    evaluations.sort(
      (a, b) =>
        b.finalImpact -
        a.finalImpact
    );


    return evaluations.slice(0, limit);
  }


  /*
   * Return one best question.
   */
  function getBestQuestion(
    courses,
    profile
  ) {

    const questions =
      getNextQuestions(
        courses,
        profile,
        1
      );

    return questions.length
      ? questions[0]
      : null;
  }


  /*
   * Format the reason shown in the UI.
   */
  function getReason(item) {

    if (!item) {
      return "";
    }

    const changes =
      item.scenarios
        .reduce(
          (sum, scenario) =>
            sum + scenario.membershipChange,
          0
        );

    const averageChanges =
      item.scenarios.length
        ? changes /
          item.scenarios.length
        : 0;

    if (averageChanges >= 2) {

      return "This answer could significantly change the Top 5 recommendations.";

    }

    if (averageChanges >= 1) {

      return "This answer could change several course recommendations.";

    }

    return "This helps narrow the recommendations.";
  }


  /*
   * Public API.
   */
  window.CourseCopilotAskNext = {

    getNextQuestions,

    getBestQuestion,

    evaluateCriterion,

    scoreCourse,

    rankCourses,

    calculateTop5Impact,

    getReason,

    config: ASK_NEXT_CONFIG,

    questions: QUESTIONS

  };

})();