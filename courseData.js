/* Course Copilot — Course Data Validation + Normalization */

(function () {

  const STALE_AFTER_DAYS = 90;

  const REQUIRED_FIELDS = [
    "name",
    "uni",
    "country",
    "level",
    "field",
    "fee",
    "intake",
    "minPct",
    "ielts",
    "duration"
  ];


  function todayISO() {

    return new Date()
      .toISOString()
      .slice(0, 10);
  }


  function parseDate(value) {

    if (!value) {
      return null;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date;
  }


  function daysSince(value) {

    const date =
      parseDate(value);

    if (!date) {
      return null;
    }

    const now =
      new Date();

    const difference =
      now.getTime() -
      date.getTime();

    return Math.floor(
      difference /
      (1000 * 60 * 60 * 24)
    );
  }


  function getVerificationStatus(
    sourceUrl,
    lastVerified
  ) {

    /*
     * No source means we cannot claim
     * that the data was verified.
     */

    if (!sourceUrl || !lastVerified) {

      return {
        status: "unverified",
        stale: true,
        ageDays: null
      };
    }


    const ageDays =
      daysSince(lastVerified);


    /*
     * Invalid date.
     */

    if (ageDays === null) {

      return {
        status: "unverified",
        stale: true,
        ageDays: null
      };
    }


    /*
     * Future verification date should not
     * be accepted.
     */

    if (ageDays < 0) {

      return {
        status: "invalid-date",
        stale: true,
        ageDays
      };
    }


    /*
     * Fresh data.
     */

    if (
      ageDays <= STALE_AFTER_DAYS
    ) {

      return {
        status: "verified",
        stale: false,
        ageDays
      };
    }


    /*
     * Old data.
     */

    return {
      status: "stale",
      stale: true,
      ageDays
    };
  }


  function validateCourse(course) {

    const errors = [];


    REQUIRED_FIELDS.forEach(
      field => {

        const value =
          course[field];

        if (
          value === undefined ||
          value === null ||
          value === ""
        ) {

          errors.push(
            `Missing ${field}`
          );
        }

      }
    );


    /*
     * Validate level.
     */

    if (
      course.level &&
      !["UG", "PG"].includes(
        course.level
      )
    ) {

      errors.push(
        "Invalid level"
      );
    }


    /*
     * Validate fee.
     */

    if (
      course.fee !== null &&
      course.fee !== undefined &&
      (
        !Number.isFinite(
          Number(course.fee)
        ) ||
        Number(course.fee) < 0
      )
    ) {

      errors.push(
        "Invalid fee"
      );
    }


    /*
     * Validate percentage.
     */

    if (
      course.minPct !== null &&
      course.minPct !== undefined &&
      (
        !Number.isFinite(
          Number(course.minPct)
        ) ||
        Number(course.minPct) < 0 ||
        Number(course.minPct) > 100
      )
    ) {

      errors.push(
        "Invalid minimum percentage"
      );
    }


    /*
     * Validate IELTS.
     */

    if (
      course.ielts !== null &&
      course.ielts !== undefined &&
      (
        !Number.isFinite(
          Number(course.ielts)
        ) ||
        Number(course.ielts) < 0 ||
        Number(course.ielts) > 9
      )
    ) {

      errors.push(
        "Invalid IELTS requirement"
      );
    }


    /*
     * Validate intake.
     */

    if (
      !Array.isArray(
        course.intake
      ) ||
      course.intake.length === 0
    ) {

      errors.push(
        "Invalid intake"
      );
    }


    /*
     * Validate source URL if supplied.
     */

    if (course.source_url) {

      try {

        const url =
          new URL(
            course.source_url
          );

        if (
          !["http:", "https:"]
            .includes(url.protocol)
        ) {

          errors.push(
            "Invalid source URL"
          );
        }

      } catch {

        errors.push(
          "Invalid source URL"
        );
      }
    }


    return errors;
  }


  function normalizeCourse(
    raw,
    index
  ) {

    const course = {

      id:
        raw.id ??
        index,

      name:
        String(
          raw.name ?? ""
        ).trim(),

      uni:
        String(
          raw.uni ?? ""
        ).trim(),

      country:
        String(
          raw.country ?? ""
        ).trim(),

      level:
        String(
          raw.level ?? ""
        ).trim(),

      field:
        String(
          raw.field ?? ""
        ).trim(),

      fee:
        raw.fee === "" ||
        raw.fee === null ||
        raw.fee === undefined
          ? null
          : Number(raw.fee),

      intake:
        Array.isArray(raw.intake)
          ? [...raw.intake]
          : [],

      /*
       * Keep both names for backwards
       * compatibility.
       */
      pct:
        raw.pct ??
        raw.minPct ??
        null,

      minPct:
        raw.minPct ??
        raw.pct ??
        null,

      ielts:
        raw.ielts ??
        null,

      /*
       * Keep both names for backwards
       * compatibility.
       */
      dur:
        raw.dur ??
        raw.duration ??
        "",

      duration:
        raw.duration ??
        raw.dur ??
        "",

      note:
        String(
          raw.note ?? ""
        ).trim(),

      /*
       * Verification metadata.
       *
       * Null is intentional. We should not
       * claim a record was verified when
       * no actual source/date has been
       * supplied.
       */
      source_url:
        raw.source_url ||
        null,

      last_verified:
        raw.last_verified ||
        null
    };


    /*
     * Verification status.
     */

    const verification =
      getVerificationStatus(
        course.source_url,
        course.last_verified
      );


    course.stale =
      verification.stale;

    course.verification_status =
      verification.status;

    course.verification_age_days =
      verification.ageDays;


    /*
     * Data validation.
     */

    course.validation_errors =
      validateCourse(course);


    course.valid =
      course.validation_errors
        .length === 0;


    return course;
  }


  function build(rawCourses) {

    if (
      !Array.isArray(
        rawCourses
      )
    ) {

      throw new Error(
        "Course data must be an array."
      );
    }


    const normalized =
      rawCourses.map(
        normalizeCourse
      );


    /*
     * Detect duplicate IDs.
     */

    const ids =
      new Set();

    normalized.forEach(
      course => {

        if (
          ids.has(course.id)
        ) {

          course.valid = false;

          course.validation_errors
            .push(
              "Duplicate course ID"
            );
        }

        ids.add(course.id);
      }
    );


    /*
     * Detect duplicate
     * course + university combinations.
     */

    const combinations =
      new Map();


    normalized.forEach(
      course => {

        const key =
          `${course.name}|${course.uni}`
            .toLowerCase();


        if (
          combinations.has(key)
        ) {

          course.validation_errors
            .push(
              "Duplicate course/university combination"
            );

          course.valid = false;
        }


        combinations.set(
          key,
          course.id
        );
      }
    );


    return normalized;
  }


  function getSummary(
    courseList
  ) {

    const total =
      courseList.length;


    const valid =
      courseList.filter(
        course => course.valid
      ).length;


    const invalid =
      total - valid;


    const verified =
      courseList.filter(
        course =>
          course.verification_status ===
          "verified"
      ).length;


    const stale =
      courseList.filter(
        course =>
          course.stale
      ).length;


    const unverified =
      courseList.filter(
        course =>
          course.verification_status ===
          "unverified"
      ).length;


    return {

      total,

      valid,

      invalid,

      verified,

      stale,

      unverified,

      verifiedPercentage:
        total
          ? Math.round(
              (verified / total) * 100
            )
          : 0,

      generatedOn:
        todayISO()
    };
  }


  function getStatusLabel(
    course
  ) {

    if (
      course.verification_status ===
      "verified"
    ) {

      return "✓ Verified";
    }


    if (
      course.verification_status ===
      "stale"
    ) {

      return "⚠ Stale";
    }


    if (
      course.verification_status ===
      "invalid-date"
    ) {

      return "⚠ Invalid date";
    }


    return "⚠ Unverified";
  }


  window.CourseCopilotCourseData = {

    build,

    normalizeCourse,

    validateCourse,

    getSummary,

    getStatusLabel,

    getVerificationStatus,

    STALE_AFTER_DAYS

  };

})();