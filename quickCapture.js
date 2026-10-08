/* Course Copilot — Quick Capture Module */

(function () {

  const FIELD_PATTERNS = {
    cs: /computer|software|coding|\bcs\b|\bit\b/,
    data: /data|\bai\b|machine learning|analytics/,
    business: /business|mba|management|finance|marketing/,
    eng: /engineer|mechanical|civil|electrical/,
    health: /health|nurs|medic|pharma/,
    design: /design|ux|fashion|art/
  };

  const FIELD_NAMES = {
    cs: "Computer Science",
    data: "Data / AI",
    business: "Business",
    eng: "Engineering",
    health: "Health",
    design: "Design"
  };

  const COUNTRY_ALIASES = {
    usa: "USA",
    america: "USA",
    us: "USA",
    "u.s.": "USA",
    "u.s.a.": "USA",
    uk: "UK",
    britain: "UK",
    england: "UK"
  };

  const NEGATIVE_PATTERNS = [
    /\bnot\s+(?:the\s+)?$/i,
    /\bavoid\s+(?:the\s+)?$/i,
    /\bexcluding\s+(?:the\s+)?$/i,
    /\bexclude\s+(?:the\s+)?$/i,
    /\bwithout\s+(?:the\s+)?$/i,
    /\bdon't\s+want\s+(?:the\s+)?$/i,
    /\bdo\s+not\s+want\s+(?:the\s+)?$/i
  ];

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function isNegativeContext(text, matchIndex) {
    const before = text.slice(
      Math.max(0, matchIndex - 60),
      matchIndex
    );

    return NEGATIVE_PATTERNS.some(pattern => pattern.test(before));
  }

  function addCountry(list, country) {
    if (country && !list.includes(country)) {
      list.push(country);
    }
  }

  function extractCountries(text, countries) {

    const preferred = [];
    const excluded = [];

    /*
     * First detect explicitly known countries.
     */
    for (const country of countries) {

      const regex = new RegExp(
        "\\b" + escapeRegExp(country.toLowerCase()) + "\\b",
        "gi"
      );

      let match;

      while ((match = regex.exec(text)) !== null) {

        if (isNegativeContext(text, match.index)) {
          addCountry(excluded, country);
        } else {
          addCountry(preferred, country);
        }
      }
    }

    /*
     * Then detect aliases such as:
     * US -> USA
     * America -> USA
     * UK -> UK
     * Britain -> UK
     */
    for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {

      const regex = new RegExp(
        "\\b" + escapeRegExp(alias) + "\\b",
        "gi"
      );

      let match;

      while ((match = regex.exec(text)) !== null) {

        if (isNegativeContext(text, match.index)) {
          addCountry(excluded, country);
        } else {
          addCountry(preferred, country);
        }
      }
    }

    /*
     * Explicit negative expressions.
     * This catches cases such as:
     * "not Germany"
     * "avoid Germany"
     * "don't want Germany"
     * "do not want Germany"
     */
    const negativePrefixes =
      "not|avoid|excluding|exclude|without|don't\\s+want|do\\s+not\\s+want";

    for (const country of countries) {

      const regex = new RegExp(
        "\\b(?:" +
          negativePrefixes +
        ")\\s+(?:the\\s+)?" +
        escapeRegExp(country.toLowerCase()) +
        "\\b",
        "gi"
      );

      if (regex.test(text)) {

        addCountry(excluded, country);

        while (preferred.includes(country)) {
          preferred.splice(preferred.indexOf(country), 1);
        }
      }
    }

    /*
     * Same negative-expression handling for aliases.
     */
    for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {

      const regex = new RegExp(
        "\\b(?:" +
          negativePrefixes +
        ")\\s+(?:the\\s+)?" +
        escapeRegExp(alias) +
        "\\b",
        "gi"
      );

      if (regex.test(text)) {

        addCountry(excluded, country);

        while (preferred.includes(country)) {
          preferred.splice(preferred.indexOf(country), 1);
        }
      }
    }

    /*
     * An excluded country should never remain in preferred countries.
     */
    const finalPreferred = preferred.filter(
      country => !excluded.includes(country)
    );

    return {
      preferred: unique(finalPreferred),
      excluded: unique(excluded)
    };
  }

  function parse(input, countries) {

    const text = String(input || "").trim();
    const lower = text.toLowerCase();

    const changes = {};
    const detected = [];
    const negativeCountries = [];

    if (!text) {
      return {
        input: "",
        changes,
        detected,
        negativeCountries,
        count: 0
      };
    }

    /*
     * LEVEL
     */
    if (
      /\b(master|masters|ms|msc|postgrad|postgraduate|pg|mba)\b/
        .test(lower)
    ) {

      changes.level = "PG";
      detected.push("Level: PG");

    } else if (
      /\b(bachelor|bachelors|undergrad|undergraduate|ug|bsc|btech)\b/
        .test(lower)
    ) {

      changes.level = "UG";
      detected.push("Level: UG");
    }

    /*
     * FIELD
     */
    for (const [field, pattern] of Object.entries(FIELD_PATTERNS)) {

      if (pattern.test(lower)) {

        changes.field = field;
        detected.push("Field: " + FIELD_NAMES[field]);

        break;
      }
    }

    /*
     * SCORE / PERCENTAGE
     *
     * Examples:
     * 72%
     * score 72%
     * percentage 82%
     */
    let match = lower.match(
      /(?:score|percentage|marks|grade)?\s*(\d{2,3}(?:\.\d+)?)\s*%/
    );

    if (match) {

      changes.pct = match[1];

      detected.push(
        "Score: " + match[1] + "%"
      );
    }

    /*
     * IELTS
     *
     * Examples:
     * IELTS 6.5
     * IELTS: 7
     * IELTS is 7.5
     */
    match = lower.match(
      /\bielts\b\s*(?:of|is|score|:)?\s*(\d(?:\.\d)?)/i
    );

    if (match) {

      changes.ielts = match[1];

      detected.push(
        "IELTS: " + match[1]
      );
    }

    /*
     * BUDGET
     *
     * Examples:
     * budget 25k
     * budget $25k
     * budget 25000
     * $25,000
     * USD 25k
     */
    match = lower.match(
      /(?:budget|usd|\$)\s*(?:of|is|around|about|up\s+to)?\s*\$?\s*(\d[\d,.]*)\s*(k)?/
    );

    if (match) {

      let value = parseFloat(
        match[1].replace(/,/g, "")
      );

      if (match[2] || value < 1000) {
        value *= 1000;
      }

      changes.budget = String(value);

      detected.push(
        "Budget: $" +
        Number(value).toLocaleString() +
        "/yr"
      );
    }

    /*
     * INTAKE
     */
    const intakes = [
      ["Sep", /\bsep(?:tember)?\b|\bfall\b|\bautumn\b/],
      ["Jan", /\bjan(?:uary)?\b|\bspring\b|\bwinter\b/],
      ["May", /\bmay\b|\bsummer\b/]
    ];

    for (const [value, pattern] of intakes) {

      if (pattern.test(lower)) {

        changes.intake = value;

        detected.push(
          "Intake: " + value
        );

        break;
      }
    }

    /*
     * COUNTRIES
     */
    const countryResult = extractCountries(
      lower,
      Array.isArray(countries) ? countries : []
    );

    /*
     * Always return both arrays.
     * This makes the sidepanel integration predictable.
     */
    changes.preferredCountries =
      countryResult.preferred;

    changes.excludedCountries =
      countryResult.excluded;

    /*
     * Display preferred countries.
     */
    countryResult.preferred.forEach(country => {

      detected.push(
        "Preferred: " + country
      );
    });

    /*
     * Display avoided countries.
     */
    countryResult.excluded.forEach(country => {

      negativeCountries.push(
        "Avoid: " + country
      );
    });

    /*
     * Count all detected changes.
     */
    const normalFields =
      Object.keys(changes).filter(
        key =>
          key !== "preferredCountries" &&
          key !== "excludedCountries"
      ).length;

    const count =
      normalFields +
      countryResult.preferred.length +
      countryResult.excluded.length;

    return {
      input: text,
      changes,
      detected,
      negativeCountries,
      count
    };
  }

  /*
   * Public API used by sidepanel.js.
   */
  window.CourseCopilotQuickCapture = {
    parse,
    extractCountries
  };

})();