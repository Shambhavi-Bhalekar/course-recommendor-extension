/* Course Copilot — Grounded Natural Language Q&A */

(function () {

  const MAX_CONTEXT_COURSES = 8;
  const MAX_QUERY_LENGTH = 500;


  /* --------------------------------------------------
     TEXT HELPERS
  -------------------------------------------------- */

  function normalizeText(value) {

    return String(value || "")
      .toLowerCase()
      .trim();
  }


  function number(value) {

    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : null;
  }


  function includesText(
    value,
    query
  ) {

    return normalizeText(value)
      .includes(
        normalizeText(query)
      );
  }


  /* --------------------------------------------------
     COURSE SEARCH
  -------------------------------------------------- */

  function courseSearchText(course) {

    return [
      course.name,
      course.uni,
      course.country,
      course.level,
      course.field,
      course.note
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }


  /*
   * Extract useful terms from the question.
   *
   * This is deliberately simple and deterministic.
   * The LLM is NOT responsible for deciding which
   * courses exist.
   */

  function extractKeywords(query) {

    const stopWords = new Set([

      "the",
      "a",
      "an",
      "and",
      "or",
      "for",
      "to",
      "of",
      "in",
      "on",
      "at",
      "is",
      "are",
      "was",
      "were",
      "with",
      "which",
      "what",
      "where",
      "when",
      "how",
      "why",
      "can",
      "could",
      "would",
      "should",
      "does",
      "do",
      "i",
      "we",
      "this",
      "that",
      "student",
      "students",
      "course",
      "courses",
      "program",
      "programs",
      "option",
      "options"
    ]);


    return normalizeText(query)
      .replace(
        /[^a-z0-9\s]/g,
        " "
      )
      .split(/\s+/)
      .filter(
        word =>
          word.length >= 2 &&
          !stopWords.has(word)
      );
  }


  /* --------------------------------------------------
     QUERY SIGNALS
  -------------------------------------------------- */

  function detectSignals(query) {

    const text =
      normalizeText(query);


    const signals = {

      countries: [],

      fields: [],

      levels: [],

      maxBudget: null,

      minBudget: null,

      intake: null,

      minPct: null,

      maxPct: null,

      minIelts: null,

      affordable: false,

      alternatives: false,

      compare: false,

      why: false

    };


    /*
     * LEVEL
     */

    if (
      /\b(pg|postgrad|postgraduate|masters|master|msc|ms|mba)\b/
        .test(text)
    ) {

      signals.levels.push("PG");
    }


    if (
      /\b(ug|undergrad|undergraduate|bachelor|bachelors|bsc|bba|beng)\b/
        .test(text)
    ) {

      signals.levels.push("UG");
    }


    /*
     * FIELDS
     */

    const fieldPatterns = {

      cs: [
        "computer science",
        "software",
        "coding",
        "programming"
      ],

      data: [
        "data science",
        "data analytics",
        "artificial intelligence",
        "ai",
        "machine learning",
        "analytics"
      ],

      business: [
        "business",
        "mba",
        "management",
        "finance",
        "marketing"
      ],

      eng: [
        "engineering",
        "mechanical",
        "civil",
        "electrical"
      ],

      health: [
        "health",
        "healthcare",
        "public health",
        "nursing",
        "medical",
        "medicine"
      ],

      design: [
        "design",
        "ux",
        "interaction design",
        "fashion",
        "communication design"
      ]

    };


    Object.entries(
      fieldPatterns
    ).forEach(
      ([field, patterns]) => {

        if (
          patterns.some(
            pattern =>
              text.includes(pattern)
          )
        ) {

          signals.fields.push(
            field
          );
        }

      }
    );


    /*
     * COUNTRY
     */

    const countryAliases = {

      usa: "USA",
      america: "USA",
      us: "USA",

      uk: "UK",
      britain: "UK",
      england: "UK",

      canada: "Canada",

      germany: "Germany",

      australia: "Australia",

      ireland: "Ireland",

      france: "France",

      netherlands: "Netherlands",

      italy: "Italy",

      sweden: "Sweden",

      singapore: "Singapore",

      "new zealand": "New Zealand"
    };


    Object.entries(
      countryAliases
    ).forEach(
      ([alias, country]) => {

        const pattern =
          new RegExp(
            `\\b${alias.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}\\b`,
            "i"
          );

        if (
          pattern.test(text)
        ) {

          if (
            !signals.countries
              .includes(country)
          ) {

            signals.countries
              .push(country);
          }
        }

      }
    );


    /*
     * BUDGET
     *
     * Understand:
     * 25k
     * $25k
     * 25000
     * 30,000
     */

    const budgetMatches =
      [
        ...text.matchAll(
          /(?:\$|usd|budget(?:\s+of)?\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k)?/gi
        )
      ];


    const budgets = [];


    budgetMatches.forEach(
      match => {

        let value =
          parseFloat(
            match[1]
              .replace(/,/g, "")
          );


        if (
          match[2] ||
          value < 1000
        ) {

          value *= 1000;
        }


        /*
         * Ignore numbers that are very
         * unlikely to represent money.
         */

        if (
          value >= 500 &&
          value <= 200000
        ) {

          budgets.push(
            value
          );
        }

      }
    );


    if (budgets.length) {

      signals.maxBudget =
        Math.min(
          ...budgets
        );
    }


    /*
     * INTAKE
     */

    if (
      /\b(sep|september|fall|autumn)\b/
        .test(text)
    ) {

      signals.intake = "Sep";

    } else if (
      /\b(jan|january|spring|winter)\b/
        .test(text)
    ) {

      signals.intake = "Jan";

    } else if (
      /\b(may|summer)\b/
        .test(text)
    ) {

      signals.intake = "May";
    }


    /*
     * ACADEMIC PERCENTAGE
     */

    const pctMatch =
      text.match(
        /(\d{2,3}(?:\.\d+)?)\s*%/
      );


    if (pctMatch) {

      signals.minPct =
        Number(
          pctMatch[1]
        );
    }


    /*
     * IELTS
     */

    const ieltsMatch =
      text.match(
        /\bielts\b[^0-9]*(\d(?:\.\d)?)/i
      );


    if (ieltsMatch) {

      signals.minIelts =
        Number(
          ieltsMatch[1]
        );
    }


    /*
     * INTENT
     */

    signals.affordable =
      /\b(affordable|cheap|cheapest|low cost|budget|under)\b/
        .test(text);


    signals.alternatives =
      /\b(alternative|alternatives|similar|instead|other options)\b/
        .test(text);


    signals.compare =
      /\b(compare|comparison|difference|versus|vs)\b/
        .test(text);


    signals.why =
      /\b(why|reason|explain|explanation)\b/
        .test(text);


    return signals;
  }


  /* --------------------------------------------------
     COURSE RELEVANCE
  -------------------------------------------------- */

  function scoreRelevance(
    course,
    query,
    profile
  ) {

    const text =
      normalizeText(query);

    const keywords =
      extractKeywords(query);

    const signals =
      detectSignals(query);

    let score = 0;


    /*
     * Keyword matching
     */

    const courseText =
      courseSearchText(course);


    keywords.forEach(
      keyword => {

        if (
          courseText.includes(keyword)
        ) {

          score += 3;
        }

      }
    );


    /*
     * Exact country signal
     */

    if (
      signals.countries.includes(
        course.country
      )
    ) {

      score += 15;
    }


    /*
     * Field signal
     */

    if (
      signals.fields.includes(
        course.field
      )
    ) {

      score += 15;
    }


    /*
     * Level signal
     */

    if (
      signals.levels.includes(
        course.level
      )
    ) {

      score += 10;
    }


    /*
     * Budget signal
     */

    if (
      signals.maxBudget !== null
    ) {

      const fee =
        number(course.fee);


      if (
        fee !== null &&
        fee <= signals.maxBudget
      ) {

        score += 12;

      } else if (
        fee !== null
      ) {

        const difference =
          fee -
          signals.maxBudget;


        const penalty =
          Math.min(
            10,
            difference /
            Math.max(
              signals.maxBudget,
              1
            ) *
            10
          );


        score -= penalty;
      }
    }


    /*
     * Intake signal
     */

    if (
      signals.intake &&
      Array.isArray(
        course.intake
      ) &&
      course.intake.includes(
        signals.intake
      )
    ) {

      score += 8;
    }


    /*
     * Academic score signal
     */

    if (
      signals.minPct !== null
    ) {

      const requirement =
        number(
          course.minPct
        );


      if (
        requirement !== null &&
        signals.minPct >= requirement
      ) {

        score += 8;
      }
    }


    /*
     * IELTS signal
     */

    if (
      signals.minIelts !== null
    ) {

      const requirement =
        number(
          course.ielts
        );


      if (
        requirement !== null &&
        signals.minIelts >= requirement
      ) {

        score += 6;
      }
    }


    /*
     * Existing student profile.
     */

    if (profile) {

      if (
        profile.field &&
        course.field ===
        profile.field
      ) {

        score += 5;
      }


      if (
        profile.level &&
        course.level ===
        profile.level
      ) {

        score += 5;
      }


      if (
        profile.budget &&
        number(course.fee) !== null &&
        number(course.fee) <=
          number(profile.budget)
      ) {

        score += 5;
      }


      if (
        Array.isArray(
          profile.preferredCountries
        ) &&
        profile.preferredCountries
          .includes(
            course.country
          )
      ) {

        score += 6;
      }


      if (
        Array.isArray(
          profile.excludedCountries
        ) &&
        profile.excludedCountries
          .includes(
            course.country
          )
      ) {

        score -= 100;
      }
    }


    /*
     * Explicit affordability intent.
     */

    if (
      signals.affordable
    ) {

      const fee =
        number(course.fee);


      if (
        fee !== null
      ) {

        /*
         * Lower fees receive more relevance.
         */
        score +=
          Math.max(
            0,
            10 -
            fee / 10000
          );
      }
    }


    return score;
  }


  /* --------------------------------------------------
     RETRIEVE COURSES
  -------------------------------------------------- */

  function retrieveCourses(
    query,
    courses,
    profile,
    limit = MAX_CONTEXT_COURSES
  ) {

    if (
      !Array.isArray(courses)
    ) {

      return [];
    }


    const cleanQuery =
      String(query || "")
        .trim()
        .slice(
          0,
          MAX_QUERY_LENGTH
        );


    if (!cleanQuery) {
      return [];
    }


    return courses
      .map(
        course => ({

          course,

          relevance:
            scoreRelevance(
              course,
              cleanQuery,
              profile
            )

        })
      )
      .filter(
        item =>
          item.relevance > 0
      )
      .sort(
        (a, b) =>
          b.relevance -
          a.relevance
      )
      .slice(
        0,
        limit
      );
  }


  /* --------------------------------------------------
     FORMAT COURSE CONTEXT
  -------------------------------------------------- */

  function formatCourse(
    course
  ) {

    return {

      id:
        course.id,

      name:
        course.name,

      university:
        course.uni,

      country:
        course.country,

      level:
        course.level,

      field:
        course.field,

      annual_fee_usd:
        course.fee,

      intake:
        course.intake,

      minimum_percentage:
        course.minPct,

      minimum_ielts:
        course.ielts,

      duration:
        course.duration,

      note:
        course.note,

      source_url:
        course.source_url,

      last_verified:
        course.last_verified,

      stale:
        course.stale,

      verification_status:
        course.verification_status
    };
  }


  /* --------------------------------------------------
     BUILD GROUNDED CONTEXT
  -------------------------------------------------- */

  function buildContext(
    query,
    courses,
    profile
  ) {

    const retrieved =
      retrieveCourses(
        query,
        courses,
        profile
      );


    const context =
      retrieved.map(
        item =>
          formatCourse(
            item.course
          )
      );


    return {

      query:
        String(query || "")
          .trim()
          .slice(
            0,
            MAX_QUERY_LENGTH
          ),

      retrieved_courses:
        context,

      retrieved_count:
        context.length
    };
  }


  /* --------------------------------------------------
     SYSTEM PROMPT
  -------------------------------------------------- */

  function buildSystemPrompt() {

    return `
You are Course Copilot, an assistant for education counsellors.

Your job is to answer questions using ONLY the course records supplied in the context.

STRICT GROUNDING RULES:

1. Never invent a university, course, fee, intake, eligibility requirement, duration, visa detail, ranking, career outcome, scholarship, placement outcome, or other fact.

2. Only state facts that are explicitly supported by the supplied course records.

3. If the supplied course records do not contain enough information to answer the question, clearly say:
   "I don't have enough information in the course database to answer that."

4. Do not use general world knowledge to fill missing course information.

5. Do not assume that a missing source_url means a fact is verified.

6. Treat stale or unverified records as lower-confidence information. Clearly indicate when relevant information is stale or unverified.

7. When comparing courses, compare only fields present in the supplied records.

8. If the user asks "why" a course is recommended, explain using the supplied course fields only.

9. If the user asks for alternatives, select alternatives only from the supplied course records.

10. Never create a course that does not exist in the supplied records.

11. Do not alter numerical values.

12. Keep answers concise and useful for a live counselling conversation.

13. When mentioning a course, identify it by course name and university.

14. If source_url is available, include it as the source for that course.

15. If source_url is missing, say that no source URL is available for that record when source verification matters.

RESPONSE FORMAT:

- Start with the direct answer.
- Use bullets when comparing multiple courses.
- Include the relevant course name and university.
- Include important numbers exactly as supplied.
- End with a short "Sources" section when source URLs are available.

DATABASE LIMITATION:

The course database is the only factual source available to you for course-specific claims.
`;
  }


  /* --------------------------------------------------
     USER PROMPT
  -------------------------------------------------- */

  function buildUserPrompt(
    query,
    context,
    profile
  ) {

    const safeProfile = {

      level:
        profile?.level || null,

      field:
        profile?.field || null,

      percentage:
        profile?.pct || null,

      ielts:
        profile?.ielts || null,

      budget:
        profile?.budget || null,

      intake:
        profile?.intake || null,

      preferredCountries:
        profile?.preferredCountries || [],

      excludedCountries:
        profile?.excludedCountries || []

    };


    return `
COUNSELLOR QUESTION:

${String(query || "")
  .trim()
  .slice(0, MAX_QUERY_LENGTH)}


CURRENT STUDENT PROFILE:

${JSON.stringify(
  safeProfile,
  null,
  2
)}


RELEVANT COURSE DATABASE RECORDS:

${JSON.stringify(
  context.retrieved_courses,
  null,
  2
)}


Answer the counsellor's question using only the information above.
`;
  }


  /* --------------------------------------------------
     BUILD LLM REQUEST
  -------------------------------------------------- */

  function buildRequest(
    query,
    courses,
    profile
  ) {

    const context =
      buildContext(
        query,
        courses,
        profile
      );


    return {

      system:
        buildSystemPrompt(),

      user:
        buildUserPrompt(
          query,
          context,
          profile
        ),

      context,

      metadata: {

        model_role:
          "course-counselling-grounded-qa",

        retrieved_count:
          context.retrieved_count,

        max_context_courses:
          MAX_CONTEXT_COURSES

      }

    };
  }


  /* --------------------------------------------------
     VALIDATE LLM RESPONSE
  -------------------------------------------------- */

  function validateResponse(
    response
  ) {

    if (
      response === null ||
      response === undefined
    ) {

      return {

        valid: false,

        error:
          "No response received."
      };
    }


    const text =
      typeof response === "string"
        ? response
        : response.answer;


    if (
      !text ||
      !String(text).trim()
    ) {

      return {

        valid: false,

        error:
          "The assistant returned an empty response."
      };
    }


    return {

      valid: true,

      answer:
        String(text).trim()
    };
  }


  /* --------------------------------------------------
     PUBLIC API
  -------------------------------------------------- */

  window.CourseCopilotLLM = {

    retrieveCourses,

    buildContext,

    buildSystemPrompt,

    buildUserPrompt,

    buildRequest,

    validateResponse,

    detectSignals,

    extractKeywords,

    MAX_CONTEXT_COURSES,

    MAX_QUERY_LENGTH

  };

})();