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

  const COUNTRY_ALIASES = {
    usa: "USA",
    america: "USA",
    us: "USA",
    uk: "UK",
    britain: "UK",
    england: "UK"
  };

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function extractCountries(text, countries) {

    const preferred = [];
    const excluded = [];

    /*
      Examples detected:

      Germany
      Canada

      not Germany
      avoid Germany
      excluding Germany
      without Germany
    */

    for (const country of countries) {

      const countryRegex = new RegExp(
        "\\b" + escapeRegExp(country.toLowerCase()) + "\\b",
        "gi"
      );

      let match;

      while ((match = countryRegex.exec(text)) !== null) {

        const before = text.slice(
          Math.max(0, match.index - 50),
          match.index
        );

        const isNegative =
          /\b(?:not|avoid|excluding|exclude|without)\s+(?:the\s+)?$/i
            .test(before);

        if (isNegative) {
          excluded.push(country);
        } else {
          preferred.push(country);
        }
      }
    }

    /*
      Country aliases:

      US → USA
      America → USA
      Britain → UK
      England → UK
    */

    for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {

      const regex = new RegExp(
        "\\b" + escapeRegExp(alias) + "\\b",
        "gi"
      );

      let match;

      while ((match = regex.exec(text)) !== null) {

        const before = text.slice(
          Math.max(0, match.index - 50),
          match.index
        );

        const isNegative =
          /\b(?:not|avoid|excluding|exclude|without)\s+(?:the\s+)?$/i
            .test(before);

        if (isNegative) {
          excluded.push(country);
        } else {
          preferred.push(country);
        }
      }
    }

    /*
      Extra negative-country pass.
      Handles:

      not Germany
      avoid Germany
      don't want Germany
      do not want Germany
    */

    for (const country of countries) {

      const negativeRegex = new RegExp(
        "\\b(?:not|avoid|excluding|exclude|without|don't\\s+want|do\\s+not\\s+want)\\s+" +
        "(?:the\\s+)?" +
        escapeRegExp(country.toLowerCase()) +
        "\\b",
        "i"
      );

      if (negativeRegex.test(text)) {

        excluded.push(country);

        while (preferred.includes(country)) {
          preferred.splice(preferred.indexOf(country), 1);
        }
      }
    }

    return {
      preferred: unique(preferred).filter(
        country => !excluded.includes(country)
      ),

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


    /* LEVEL */

    if (
      /\b(master|masters|ms|msc|postgrad|pg|mba)\b/
        .test(lower)
    ) {

      changes.level = "PG";

      detected.push("Level: PG");

    }

    else if (
      /\b(bachelor|bachelors|undergrad|ug|bsc|btech)\b/
        .test(lower)
    ) {

      changes.level = "UG";

      detected.push("Level: UG");

    }


    /* FIELD */

    for (const [field, pattern] of Object.entries(FIELD_PATTERNS)) {

      if (pattern.test(lower)) {

        changes.field = field;

        const names = {
          cs: "Computer Science",
          data: "Data / AI",
          business: "Business",
          eng: "Engineering",
          health: "Health",
          design: "Design"
        };

        detected.push(
          "Field: " + names[field]
        );

        break;
      }
    }


    /* SCORE */

    let match = lower.match(
      /(\d{2,3}(?:\.\d+)?)\s*%/
    );

    if (match) {

      changes.pct = match[1];

      detected.push(
        "Score: " + match[1] + "%"
      );

    }


    /* IELTS */

    match = lower.match(
      /ielts\s*(?:of|is|:)?\s*(\d(?:\.\d)?)/
    );

    if (match) {

      changes.ielts = match[1];

      detected.push(
        "IELTS: " + match[1]
      );

    }


    /* BUDGET */

    match = lower.match(
      /(?:budget|\$|usd)\s*(?:of|is|around|about)?\s*\$?\s*(\d[\d,.]*)\s*(k)?/
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


    /* INTAKE */

    const intakes = [
      ["Sep", /sep|september|fall|autumn/],
      ["Jan", /jan|january|spring|winter/],
      ["May", /\bmay\b|summer/]
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


    /* COUNTRIES */

    const countryResult =
      extractCountries(lower, countries);


    changes.preferredCountries =
      countryResult.preferred;

    changes.excludedCountries =
      countryResult.excluded;


    countryResult.preferred.forEach(country => {

      detected.push(
        "Preferred: " + country
      );

    });


    countryResult.excluded.forEach(country => {

      negativeCountries.push(
        "Avoid: " + country
      );

    });


    /*
      Number of things captured.
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



  window.CourseCopilotQuickCapture = {

    parse,

    extractCountries

  };

})();