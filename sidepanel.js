/* Course Copilot — Main Side Panel Controller */



/* -------------------------------------------------------

   GLOBAL STATE & CONFIGURATION

\------------------------------------------------------- */



const LLM_STATE = {

  history: [],

  loading: false

};



const COUNTRIES = [

  "USA",

  "UK",

  "Canada",

  "Germany",

  "Australia",

  "Ireland",

  "France",

  "Netherlands",

  "Sweden",

  "Singapore",

  "New Zealand"

];



const W = {

  level: 25,

  field: 35,

  budget: 20,

  pct: 15,

  ielts: 10,

  country: 12,

  intake: 8

};



const Q = {

  level: "Is the student looking for UG or PG?",

  field: "What field does the student want to study?",

  budget: "What is the student's approximate annual budget?",

  pct: "What is the student's academic percentage / score?",

  ielts: "What IELTS score does the student have?",

  country: "Which countries is the student open to?",

  intake: "Which intake is the student targeting?"

};



const P = {

  name: "",

  level: "",

  field: "",

  pct: "",

  ielts: "",

  budget: "",

  intake: "",

  preferredCountries: [],

  excludedCountries: []

};



let mode = "rec";

let shortlist = [];

let captureHistory = [];

let askedQuestions = [];

let skippedQuestions = [];

let currentSearchQuery = "";

let CURRENT_SESSION_ID = null;

let CURRENT_PROFILE_ID = null;

let profileSaveTimer = null;



/* -------------------------------------------------------

   BASIC UTILITIES

\------------------------------------------------------- */



function esc(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}



function num(value) {

  const n = Number(value);

  return Number.isFinite(n) ? n : null;

}



function known(key) {

  if (key === "country") {

    return (

      (Array.isArray(P.preferredCountries) && P.preferredCountries.length > 0) ||

      (Array.isArray(P.excludedCountries) && P.excludedCountries.length > 0)

    );

  }

  return P[key] !== undefined && P[key] !== null && String(P[key]).trim() !== "";

}



/* -------------------------------------------------------

   COURSE DATA STATUS

\------------------------------------------------------- */



function renderCourseDataStatus() {

  const status = document.getElementById("courseDataStatus");

  const details = document.getElementById("courseDataDetails");



  if (!status || !details) {

    return;

  }



  if (!window.CourseCopilotCourseData || typeof courses === "undefined") {

    status.textContent = "Unavailable";

    status.className = "warning";

    details.textContent = "Course data validation module not loaded.";

    return;

  }



  const summary = window.CourseCopilotCourseData.getSummary(courses);



  if (summary.unverified === summary.total) {

    status.textContent = "⚠ Unverified";

    status.className = "warning";

    details.textContent = `${summary.total} courses loaded · verification sources pending.`;

    return;

  }



  if (summary.stale > 0) {

    status.textContent = "⚠ Review needed";

    status.className = "warning";

  } else {

    status.textContent = "✓ Current";

    status.className = "ok";

  }



  details.textContent =

    `${summary.total} courses · ` +

    `${summary.verified} verified · ` +

    `${summary.stale} stale · ` +

    `${summary.unverified} unverified`;

}



/* -------------------------------------------------------

   SESSION MANAGEMENT & PROFILE STORAGE

\------------------------------------------------------- */



async function initializeCourseCopilotSession() {

  if (!window.CourseCopilotProfileStore) {

    console.warn("CourseCopilotProfileStore is unavailable.");

    return;

  }



  try {

    const existingSessionId = await window.CourseCopilotProfileStore.getCurrentSession();



    if (existingSessionId) {

      const session = await window.CourseCopilotProfileStore.getSession(existingSessionId);



      if (session) {

        CURRENT_SESSION_ID = session.id;

        CURRENT_PROFILE_ID = session.profileId || null;



        if (session.profileSnapshot) {

          restoreProfile(session.profileSnapshot);

        } else if (session.profileId) {

          const savedProfile = await window.CourseCopilotProfileStore.getProfile(session.profileId);

          if (savedProfile) {

            restoreProfile(savedProfile);

          }

        }



        if (Array.isArray(session.shortlistedCourses) && typeof courses !== "undefined") {

          shortlist = session.shortlistedCourses

            .map(id =>

              courses.find(c => String(c.id) === String(id) || c.name === id)

            )

            .filter(Boolean);

        } else {

          shortlist = [];

        }



        syncProfileInputs();

        chips();

        updateShortlistCount();

        updateProfileCount();

        view();

        renderAskNext();

        return;

      }

    }



    // No existing session, create a new one

    const initialProfile = getLLMProfile();

    const newSession = await window.CourseCopilotProfileStore.createSession(initialProfile);



    CURRENT_SESSION_ID = newSession.id;

    CURRENT_PROFILE_ID = newSession.profileId || null;



    await window.CourseCopilotProfileStore.setCurrentSession(newSession.id);

  } catch (error) {

    console.error("Session initialization failed:", error);

  }

}



async function saveCurrentStudentProfile() {

  if (!window.CourseCopilotProfileStore) {

    return null;

  }



  const profile = getLLMProfile();



  try {

    const saved = await window.CourseCopilotProfileStore.saveProfile({

      ...profile,

      id: CURRENT_PROFILE_ID || undefined,

      shortlistedCourses: shortlist.map(course => course.id ?? course.name)

    });



    CURRENT_PROFILE_ID = saved.id;



    if (CURRENT_SESSION_ID) {

      try {

        const existingSession = await window.CourseCopilotProfileStore.getSession(CURRENT_SESSION_ID);

        if (existingSession) {

          await window.CourseCopilotProfileStore.updateSession(CURRENT_SESSION_ID, {

            profileId: saved.id,

            profileSnapshot: saved,

            shortlistedCourses: shortlist.map(course => course.id ?? course.name)

          });

        }

      } catch (sessionErr) {

        console.warn("Could not update session snapshot:", sessionErr);

      }

    }



    return saved;

  } catch (error) {

    console.error("Unable to save profile:", error);

    return null;

  }

}



function scheduleProfileSave() {

  clearTimeout(profileSaveTimer);

  profileSaveTimer = setTimeout(async () => {

    if (!CURRENT_SESSION_ID) return;

    await saveCurrentStudentProfile();

  }, 500);

}



/* -------------------------------------------------------

   RECOMMENDATION ENGINE & EXPLANATIONS

\------------------------------------------------------- */




/* -------------------------------------------------------
   SAVED STUDENTS & SESSION HISTORY
------------------------------------------------------- */

function formatSavedDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderSavedStudents() {
  const container = document.getElementById("savedStudentsList");
  const status = document.getElementById("savedStudentsStatus");
  if (!container) return;

  if (!window.CourseCopilotProfileStore) {
    container.innerHTML = `<div class="mu">Profile storage is unavailable.</div>`;
    return;
  }

  window.CourseCopilotProfileStore.getProfiles().then(async profiles => {
    if (!profiles.length) {
      container.innerHTML = `
        <div class="saved-empty">
          <strong>No saved students yet</strong>
          <div class="mu">Start filling a student profile and it will be saved automatically.</div>
        </div>`;
      if (status) status.textContent = "0 saved";
      return;
    }

    const sessions = await window.CourseCopilotProfileStore.getSessions();

    container.innerHTML = profiles.map(profile => {
      const count = sessions.filter(s => s.profileId === profile.id).length;
      const current = profile.id === CURRENT_PROFILE_ID;

      return `
        <div class="saved-student ${current ? "current" : ""}">
          <div>
            <div class="saved-student-name">
              ${esc(profile.name || "Unnamed student")}
              ${current ? `<span class="saved-current">Current</span>` : ""}
            </div>
            <div class="mu">
              ${esc(profile.level || "Level not set")}
              ${profile.field ? ` · ${esc(profile.field)}` : ""}
            </div>
            <div class="mu">
              Updated ${esc(formatSavedDate(profile.updatedAt))}
              · ${count} session${count === 1 ? "" : "s"}
            </div>
          </div>
          <div class="saved-student-actions">
            <button class="saved-action" type="button"
              data-load-profile="${esc(profile.id)}">Load</button>
            <button class="saved-action danger" type="button"
              data-delete-profile="${esc(profile.id)}">Delete</button>
          </div>
        </div>`;
    }).join("");

    if (status) status.textContent = `${profiles.length} saved`;
  }).catch(error => {
    console.error("Unable to render saved students:", error);
    container.innerHTML = `<div class="mu">Unable to load saved students.</div>`;
  });
}

async function loadStudentProfile(profileId) {
  if (!window.CourseCopilotProfileStore || !profileId) return;

  try {
    clearTimeout(profileSaveTimer);

    const profile = await window.CourseCopilotProfileStore.getProfile(profileId);
    if (!profile) return;

    if (CURRENT_PROFILE_ID && CURRENT_PROFILE_ID !== profileId) {
      await saveCurrentStudentProfile();
    }

    const sessions = await window.CourseCopilotProfileStore.getSessions();
    const session = sessions
      .filter(item => item.profileId === profileId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
      || await window.CourseCopilotProfileStore.createSession(profile);

    CURRENT_PROFILE_ID = profile.id;
    CURRENT_SESSION_ID = session.id;

    await window.CourseCopilotProfileStore.setCurrentSession(session.id);

    restoreProfile(session.profileSnapshot || profile);

    shortlist = Array.isArray(session.shortlistedCourses)
      ? session.shortlistedCourses.map(identifier =>
          courses.find(course =>
            String(course.id) === String(identifier) ||
            course.name === identifier
          )
        ).filter(Boolean)
      : [];

    LLM_STATE.history = Array.isArray(session.questions)
      ? session.questions.map(item => ({
          question: item.question,
          answer: item.answer,
          citations: item.citations || []
        }))
      : [];

    syncProfileInputs();
    chips();
    updateShortlistCount();
    updateProfileCount();
    view();
    renderAskNext();
    renderSavedStudents();
    renderSessionHistory();
  } catch (error) {
    console.error("Unable to load student profile:", error);
  }
}

async function createNewStudent() {
  if (!window.CourseCopilotProfileStore) return;

  try {
    clearTimeout(profileSaveTimer);

    if (CURRENT_PROFILE_ID) {
      await saveCurrentStudentProfile();
    }

    Object.assign(P, {
      name: "",
      level: "",
      field: "",
      pct: "",
      ielts: "",
      budget: "",
      intake: "",
      preferredCountries: [],
      excludedCountries: []
    });

    shortlist = [];
    captureHistory = [];
    askedQuestions = [];
    skippedQuestions = [];
    LLM_STATE.history = [];

    const session = await window.CourseCopilotProfileStore.createSession(getLLMProfile());

    CURRENT_SESSION_ID = session.id;
    CURRENT_PROFILE_ID = null;

    await window.CourseCopilotProfileStore.setCurrentSession(session.id);

    syncProfileInputs();
    chips();
    updateShortlistCount();
    updateProfileCount();
    view();
    renderAskNext();
    renderSavedStudents();
    renderSessionHistory();
  } catch (error) {
    console.error("Unable to create new student:", error);
  }
}

async function deleteStudentProfile(profileId) {
  if (!window.CourseCopilotProfileStore || !profileId) return;

  try {
    const profile = await window.CourseCopilotProfileStore.getProfile(profileId);
    if (!profile) return;

    if (!window.confirm(
      `Delete saved student "${profile.name || "Unnamed student"}"? Previous counselling sessions will be kept.`
    )) return;

    if (profileId === CURRENT_PROFILE_ID) {
      await createNewStudent();
    }

    await window.CourseCopilotProfileStore.deleteProfile(profileId);
    renderSavedStudents();
    renderSessionHistory();
  } catch (error) {
    console.error("Unable to delete student profile:", error);
  }
}

async function resumeSession(sessionId) {
  if (!window.CourseCopilotProfileStore || !sessionId) return;

  try {
    clearTimeout(profileSaveTimer);

    const session = await window.CourseCopilotProfileStore.getSession(sessionId);
    if (!session) return;

    if (CURRENT_PROFILE_ID && CURRENT_PROFILE_ID !== session.profileId) {
      await saveCurrentStudentProfile();
    }

    CURRENT_SESSION_ID = session.id;
    CURRENT_PROFILE_ID = session.profileId || null;

    await window.CourseCopilotProfileStore.setCurrentSession(session.id);

    const profile = session.profileSnapshot ||
      (CURRENT_PROFILE_ID
        ? await window.CourseCopilotProfileStore.getProfile(CURRENT_PROFILE_ID)
        : null);

    restoreProfile(profile || {});

    shortlist = Array.isArray(session.shortlistedCourses)
      ? session.shortlistedCourses.map(identifier =>
          courses.find(course =>
            String(course.id) === String(identifier) ||
            course.name === identifier
          )
        ).filter(Boolean)
      : [];

    LLM_STATE.history = Array.isArray(session.questions)
      ? session.questions.map(item => ({
          question: item.question,
          answer: item.answer,
          citations: item.citations || []
        }))
      : [];

    syncProfileInputs();
    chips();
    updateShortlistCount();
    updateProfileCount();
    view();
    renderAskNext();
    renderSavedStudents();
    renderSessionHistory();
  } catch (error) {
    console.error("Unable to resume session:", error);
  }
}

async function renderSessionHistory() {
  const container = document.getElementById("sessionHistoryList");
  if (!container || !window.CourseCopilotProfileStore) return;

  try {
    const sessions = await window.CourseCopilotProfileStore.getSessions();
    const visible = sessions
      .filter(session => CURRENT_PROFILE_ID && session.profileId === CURRENT_PROFILE_ID)
      .slice(0, 8);

    if (!visible.length) {
      container.innerHTML = `<div class="mu">No saved counselling sessions for this student yet.</div>`;
      return;
    }

    container.innerHTML = visible.map(session => {
      const current = session.id === CURRENT_SESSION_ID;
      const qCount = Array.isArray(session.questions) ? session.questions.length : 0;
      const sCount = Array.isArray(session.shortlistedCourses) ? session.shortlistedCourses.length : 0;

      return `
        <div class="session-row ${current ? "current" : ""}">
          <div>
            <strong>${current ? "Current session" : "Counselling session"}</strong>
            <div class="mu">${esc(formatSavedDate(session.updatedAt))}</div>
            <div class="mu">${qCount} Q&A · ${sCount} shortlisted</div>
          </div>
          ${
            current
              ? `<span class="saved-current">Active</span>`
              : `<button class="saved-action" type="button"
                   data-resume-session="${esc(session.id)}">Resume</button>`
          }
        </div>`;
    }).join("");
  } catch (error) {
    console.error("Unable to render session history:", error);
    container.innerHTML = `<div class="mu">Unable to load session history.</div>`;
  }
}


function scoreCourse(course) {

  let score = 0;

  let possible = 0;



  // LEVEL

  if (known("level")) {

    possible += W.level;

    if (String(course.level).toUpperCase() === String(P.level).toUpperCase()) {

      score += W.level;

    }

  }



  // FIELD

  if (known("field")) {

    possible += W.field;

    if (String(course.field).toLowerCase() === String(P.field).toLowerCase()) {

      score += W.field;

    }

  }



  // BUDGET

  if (known("budget")) {

    possible += W.budget;

    const budget = num(P.budget);

    const fee = num(course.fee);

    if (budget !== null && fee !== null) {

      if (fee <= budget) {

        score += W.budget;

      } else {

        const over = (fee - budget) / Math.max(budget, 1);

        score += W.budget * Math.max(0, 1 - over);

      }

    }

  }



  // ACADEMIC SCORE

  if (known("pct")) {

    possible += W.pct;

    const pct = num(P.pct);

    const minimum = num(course.minPct);

    if (pct !== null && minimum !== null) {

      if (pct >= minimum) {

        score += W.pct;

      } else {

        const gap = (minimum - pct) / Math.max(minimum, 1);

        score += W.pct * Math.max(0, 1 - gap);

      }

    }

  }



  // IELTS

  if (known("ielts")) {

    possible += W.ielts;

    const ielts = num(P.ielts);

    const required = num(course.ielts);

    if (ielts !== null && required !== null) {

      if (ielts >= required) {

        score += W.ielts;

      } else {

        const gap = (required - ielts) / Math.max(required, 1);

        score += W.ielts * Math.max(0, 1 - gap);

      }

    }

  }



  // COUNTRY

  if (known("country")) {

    possible += W.country;

    const preferred = P.preferredCountries || [];

    const excluded = P.excludedCountries || [];



    if (excluded.includes(course.country)) {

      // Excluded: 0 points

    } else if (preferred.includes(course.country)) {

      score += W.country;

    } else if (preferred.length === 0) {

      // No preferred list specified, only exclusions: neutral

      score += W.country * 0.5;

    }

  }



  // INTAKE

  if (known("intake")) {

    possible += W.intake;

    if (Array.isArray(course.intake) && course.intake.includes(P.intake)) {

      score += W.intake;

    }

  }



  if (possible === 0) {

    return 0;

  }



  return (score / possible) * 100;

}



function rankedCourses() {

  if (typeof courses === "undefined" || !Array.isArray(courses)) {

    return [];

  }

  return courses

    .map(course => ({

      course,

      score: scoreCourse(course)

    }))

    .sort((a, b) => {
      const aUrgency = window.CourseCopilotPlanning
        ? window.CourseCopilotPlanning.urgencyBonus(a.course)
        : 0;
      const bUrgency = window.CourseCopilotPlanning
        ? window.CourseCopilotPlanning.urgencyBonus(b.course)
        : 0;
      return (b.score + bUrgency) - (a.score + aUrgency);
    });

}



function explain(course) {

  const reasons = [];

  const gaps = [];



  if (known("level")) {

    if (String(course.level).toUpperCase() === String(P.level).toUpperCase()) {

      reasons.push(`${P.level} level matches`);

    } else {

      gaps.push(`Course is ${course.level} (student seeks ${P.level})`);

    }

  }



  if (known("field")) {

    if (String(course.field).toLowerCase() === String(P.field).toLowerCase()) {

      reasons.push("Field matches");

    } else {

      gaps.push("Field does not match");

    }

  }



  if (known("budget")) {

    const budget = num(P.budget);

    const fee = num(course.fee);

    if (budget !== null && fee !== null) {

      if (fee <= budget) {

        reasons.push("Within budget");

      } else {

        gaps.push(`Fee exceeds budget by $${Math.round(fee - budget).toLocaleString()}`);

      }

    }

  }



  if (known("pct")) {

    const pct = num(P.pct);

    const minPct = num(course.minPct);

    if (pct !== null && minPct !== null) {

      if (pct >= minPct) {

        reasons.push("Academic requirement met");

      } else {

        gaps.push(`Academic score below ${minPct}%`);

      }

    }

  }



  if (known("ielts")) {

    const ielts = num(P.ielts);

    const required = num(course.ielts);

    if (ielts !== null && required !== null) {

      if (ielts >= required) {

        reasons.push("IELTS requirement met");

      } else {

        gaps.push(`IELTS ${required}+ required`);

      }

    }

  }



  if (known("country")) {

    if (P.excludedCountries.includes(course.country)) {

      gaps.push(`Country on avoid list (${course.country})`);

    } else if (P.preferredCountries.includes(course.country)) {

      reasons.push("Preferred country");

    }

  }



  if (known("intake")) {

    if (Array.isArray(course.intake) && course.intake.includes(P.intake)) {

      reasons.push(`${P.intake} intake available`);

    } else {

      gaps.push("Intake mismatch");

    }

  }



  return { reasons, gaps };

}



/* -------------------------------------------------------

   COURSE CARD COMPONENT

\------------------------------------------------------- */



function courseCard(item, index) {

  const c = item.course;

  const explanation = explain(c);

  const isShortlisted = shortlist.some(

    x => (x.id !== undefined && c.id !== undefined ? String(x.id) === String(c.id) : x.name === c.name)

  );



  const courseIdentifier = c.id !== undefined ? String(c.id) : c.name;



  return `

    <div class="card">

      <div class="row">

        <div>

          <div style="font-weight:700">

            ${index + 1}. ${esc(c.name)}

          </div>

          <div class="mu">

            ${esc(c.uni)} · ${esc(c.country)}

          </div>

        </div>

        <button

          class="star ${isShortlisted ? "on" : ""}"

          data-pin="${esc(courseIdentifier)}"

          type="button"

          title="${isShortlisted ? "Remove from shortlist" : "Add to shortlist"}"

        >

          ${isShortlisted ? "★" : "☆"}

        </button>

      </div>

      <div class="m" style="margin-top:6px">

        ${Math.round(item.score)}% match

      </div>

      <div class="bar">

        <i style="width:${Math.max(0, Math.min(100, item.score))}%"></i>

      </div>

      ${
        window.CourseCopilotPlanning
          ? (() => {
              const deadline = window.CourseCopilotPlanning.deadlineInfo(c);
              return `<div class="deadline-badge ${deadline.urgent ? "urgent" : ""}">${deadline.urgent ? "⏰ " : "📅 "}${esc(deadline.label)}</div>`;
            })()
          : ""
      }

      <div class="mu" style="margin-top:5px">

        ${esc(c.level)} · ${esc(c.field)} · $${Number(c.fee).toLocaleString()}/yr${c.duration || c.dur ? ` · ${esc(c.duration || c.dur)}` : ""}

      </div>

      ${

        explanation.reasons.length

          ? `<ul>${explanation.reasons.map(x => `<li class="ok">✓ ${esc(x)}</li>`).join("")}</ul>`

          : ""

      }

      ${

        explanation.gaps.length

          ? `<ul>${explanation.gaps.map(x => `<li class="bad">✕ ${esc(x)}</li>`).join("")}</ul>`

          : ""

      }

      ${

        c.note

          ? `<div class="mu" style="margin-top:5px;font-style:italic">${esc(c.note)}</div>`

          : ""

      }

      ${

        c.verification_status === "verified"

          ? `<div class="mu" style="margin-top:5px">✓ Verified${c.verification_age_days !== null ? ` · ${c.verification_age_days}d ago` : ""}</div>`

          : `<div class="wn" style="margin-top:5px;font-size:11px">⚠ Course data not verified</div>`

      }

      ${window.CourseCopilotScholarshipCareer ? (() => { const s = window.CourseCopilotScholarshipCareer.scholarshipMatch(c, P); return s.eligible ? `<div class="ok" style="margin-top:5px;font-size:11px">🎓 Scholarship match: ${esc(s.scholarship.name)}</div>` : ""; })() : ""}

      ${window.CourseCopilotScholarshipCareer ? (() => { const career = window.CourseCopilotScholarshipCareer.careerOutlook(c); return career.roles.length ? `<div class="mu" style="margin-top:5px;font-size:11px">💼 Roles: ${esc(career.roles.slice(0,3).join(" · "))}</div>` : ""; })() : ""}

    </div>

  `;

}



/* -------------------------------------------------------

   ASK NEXT COMPONENT

\------------------------------------------------------- */



function renderAskNext() {

  const container = document.getElementById("askNextContent");

  if (!container) return;



  if (!window.CourseCopilotAskNext) {

    container.innerHTML = `<div class="mu">Ask Next module not loaded.</div>`;

    return;

  }



  const questions = window.CourseCopilotAskNext.getNextQuestions(courses, P, 3);



  if (!questions.length) {

    container.innerHTML = `<div class="ok">✓ Profile details are well specified!</div>`;

    return;

  }



  const availableQuestions = questions.filter(q => !skippedQuestions.includes(q.criterion));



  if (!availableQuestions.length) {

    container.innerHTML = `<div class="mu">No additional high-impact questions right now.</div>`;

    return;

  }



  const best = availableQuestions[0];

  const reason = window.CourseCopilotAskNext.getReason(best);



  container.innerHTML = `

    <div class="ask-next-main">

      <div class="ask-next-label">🎯 Highest impact question</div>

      <div class="ask-next-question">${esc(best.question)}</div>

      <div class="ask-next-reason">${esc(reason)}</div>

      <div class="ask-next-actions">

        <button

          class="btn ask-next-ask"

          data-ask="${esc(best.criterion)}"

          type="button"

        >

          Ask this

        </button>

        <button

          class="ask-next-skip"

          data-skip="${esc(best.criterion)}"

          type="button"

        >

          Skip

        </button>

      </div>

    </div>

    ${

      availableQuestions.length > 1

        ? `

          <details style="margin-top:8px">

            <summary>Other high-impact questions (${availableQuestions.length - 1})</summary>

            <div style="margin-top:6px">

              ${availableQuestions

                .slice(1)

                .map(

                  q => `

                    <div class="ask-next-option">

                      <div>

                        <strong>${esc(q.label)}</strong>

                        <div class="mu">${esc(q.question)}</div>

                      </div>

                      <button

                        class="ask-next-use"

                        data-ask="${esc(q.criterion)}"

                        type="button"

                      >

                        Use

                      </button>

                    </div>

                  `

                )

                .join("")}

            </div>

          </details>

        `

        : ""

    }

  `;

}



function focusAskQuestion(criterion) {

  const input = document.getElementById("qc");

  if (!input) return;



  const question =

    window.CourseCopilotAskNext?.questions?.[criterion]?.question ||

    Q[criterion] ||

    "";



  if (!question) return;



  input.placeholder = question;

  input.focus();

}



function handleAskNextAction(criterion) {

  if (!criterion) return;

  if (!askedQuestions.includes(criterion)) {

    askedQuestions.push(criterion);

  }

  focusAskQuestion(criterion);

}



function skipAskNext(criterion) {

  if (!criterion) return;

  if (!skippedQuestions.includes(criterion)) {

    skippedQuestions.push(criterion);

  }

  renderAskNext();

}



/* -------------------------------------------------------

   AI GROUNDED Q&A (LLM)

\------------------------------------------------------- */



function getLLMProfile() {

  return {

    name: P.name || document.getElementById("name")?.value || "",

    level: P.level || document.getElementById("level")?.value || "",

    field: P.field || document.getElementById("field")?.value || "",

    pct: P.pct || document.getElementById("pct")?.value || "",

    ielts: P.ielts || document.getElementById("ielts")?.value || "",

    budget: P.budget || document.getElementById("budget")?.value || "",

    intake: P.intake || document.getElementById("intake")?.value || "",

    preferredCountries: Array.isArray(P.preferredCountries) ? [...P.preferredCountries] : [],

    excludedCountries: Array.isArray(P.excludedCountries) ? [...P.excludedCountries] : []

  };

}



function getLLMConversation() {

  return document.getElementById("llmConversation");

}



function scrollLLMToBottom() {

  const container = getLLMConversation();

  if (!container) return;

  container.scrollTop = container.scrollHeight;

}



function escapeHTML(value) {

  return esc(value);

}



function renderUserQuestion(question) {

  const container = getLLMConversation();

  if (!container) return;



  const empty = container.querySelector(".llm-empty");

  if (empty) empty.remove();



  const message = document.createElement("div");

  message.className = "llm-message user";

  message.innerHTML = `<div class="llm-answer">${escapeHTML(question)}</div>`;

  container.appendChild(message);

  scrollLLMToBottom();

}



function renderLLMLoading() {

  const container = getLLMConversation();

  if (!container) return;



  removeLLMLoading();



  const loading = document.createElement("div");

  loading.id = "llmLoading";

  loading.className = "llm-message assistant";

  loading.innerHTML = `

    <div class="llm-loading">

      <span>Thinking</span>

      <span class="llm-dot"></span>

      <span class="llm-dot"></span>

      <span class="llm-dot"></span>

    </div>

  `;

  container.appendChild(loading);

  scrollLLMToBottom();

}



function removeLLMLoading() {

  const loading = document.getElementById("llmLoading");

  if (loading) loading.remove();

}



function renderCitations(citations) {

  if (!Array.isArray(citations) || !citations.length) {

    return "";

  }



  const validCitations = citations.filter(c => c && (c.course_name || c.university));

  if (!validCitations.length) return "";



  const items = validCitations

    .map(c => {

      const course = escapeHTML(c.course_name || "Course");

      const university = escapeHTML(c.university || "");

      const status = c.verification_status;



      let source = "";

      if (c.source_url) {

        source = `

          <div class="llm-citation-source">

            <a href="${escapeHTML(c.source_url)}" target="_blank" rel="noopener noreferrer">

              View official source

            </a>

          </div>

        `;

      } else {

        source = `<div class="llm-citation-source mu">No source URL supplied</div>`;

      }



      let verification = "";

      if (status === "stale") {

        verification = `<span class="wn"> · stale</span>`;

      } else if (status === "unverified") {

        verification = `<span class="mu"> · unverified</span>`;

      }



      return `

        <div class="llm-citation">

          <div class="llm-citation-course">

            ${course}${university ? ` — ${university}` : ""}${verification}

          </div>

          ${source}

        </div>

      `;

    })

    .join("");



  return `

    <div class="llm-citations">

      <div class="llm-citation-title">Sources</div>

      ${items}

    </div>

  `;

}



function renderLLMAnswer(result) {

  const container = getLLMConversation();

  if (!container) return;



  removeLLMLoading();



  const message = document.createElement("div");

  message.className = "llm-message assistant";



  let warning = "";

  if (result.grounded === false) {

    warning = `

      <div class="llm-warning">

        This answer could not be fully grounded in the available course records.

      </div>

    `;

  }



  message.innerHTML = `

    <div class="llm-answer">${escapeHTML(result.answer)}</div>

    ${warning}

    ${renderCitations(result.citations)}

  `;



  container.appendChild(message);

  scrollLLMToBottom();

}



function renderLLMError(error) {

  const container = getLLMConversation();

  if (!container) return;



  removeLLMLoading();



  const message = document.createElement("div");

  message.className = "llm-message assistant";

  message.innerHTML = `

    <div class="llm-error">

      ${escapeHTML(error?.message || "Unable to answer the question.")}

    </div>

  `;



  container.appendChild(message);

  scrollLLMToBottom();

}



async function askCourseCopilot() {

  if (LLM_STATE.loading) return;



  const input = document.getElementById("llmQuestion");

  const button = document.getElementById("llmAskBtn");

  const status = document.getElementById("llmStatus");



  if (!input) return;



  const question = input.value.trim();

  if (!question) {

    input.focus();

    return;

  }



  if (question.length > 500) return;



  LLM_STATE.loading = true;

  if (button) {

    button.disabled = true;

    button.textContent = "Thinking...";

  }

  if (status) {

    status.textContent = "Searching course data...";

  }



  renderUserQuestion(question);

  renderLLMLoading();

  input.value = "";



  try {

    const profile = getLLMProfile();

    const result = await window.CourseCopilotLLMClient.ask(question, courses, profile);



    LLM_STATE.history.push({ role: "user", content: question });

    LLM_STATE.history.push({ role: "assistant", content: result.answer, citations: result.citations });



    if (CURRENT_SESSION_ID && window.CourseCopilotProfileStore) {

      await window.CourseCopilotProfileStore.addQuestionAnswer(

        CURRENT_SESSION_ID,

        question,

        result.answer,

        result.citations

      );

    }



    renderLLMAnswer(result);

    if (status) status.textContent = "Grounded in course data";

  } catch (error) {

    console.error("Course Copilot AI error:", error);

    renderLLMError(error);

    if (status) status.textContent = "Unable to reach AI service";

  } finally {

    LLM_STATE.loading = false;

    if (button) {

      button.disabled = false;

      button.textContent = "Ask";

    }

  }

}



function bindLLM() {

  const button = document.getElementById("llmAskBtn");

  const input = document.getElementById("llmQuestion");



  if (button) {

    button.addEventListener("click", askCourseCopilot);

  }



  if (input) {

    input.addEventListener("keydown", event => {

      if (event.key === "Enter" && !event.shiftKey) {

        event.preventDefault();

        askCourseCopilot();

      }

    });

  }

}



/* -------------------------------------------------------

   PROFILE UI & CHIPS

\------------------------------------------------------- */



function chips() {

  const cc = document.getElementById("cc");

  const avoid = document.getElementById("avoidcc");



  if (!cc || !avoid) return;



  cc.innerHTML = COUNTRIES.map(country => {

    const active = P.preferredCountries.includes(country);

    return `

      <button

        class="chip ${active ? "on" : ""}"

        data-country="${esc(country)}"

        type="button"

      >

        ${esc(country)}

      </button>

    `;

  }).join("");



  avoid.innerHTML = COUNTRIES.map(country => {

    const active = P.excludedCountries.includes(country);

    return `

      <button

        class="chip ${active ? "on" : ""}"

        data-avoid="${esc(country)}"

        type="button"

      >

        ${esc(country)}

      </button>

    `;

  }).join("");

}



function snapshotProfile() {

  return JSON.parse(JSON.stringify(P));

}



function restoreProfile(snapshot) {

  if (!snapshot || typeof snapshot !== "object") return;



  P.name = snapshot.name || "";

  P.level = snapshot.level || "";

  P.field = snapshot.field || "";

  P.pct = snapshot.pct || "";

  P.ielts = snapshot.ielts || "";

  P.budget = snapshot.budget || "";

  P.intake = snapshot.intake || "";

  P.preferredCountries = Array.isArray(snapshot.preferredCountries) ? [...snapshot.preferredCountries] : [];

  P.excludedCountries = Array.isArray(snapshot.excludedCountries) ? [...snapshot.excludedCountries] : [];



  syncProfileInputs();

}



function syncProfileInputs() {

  const fields = ["name", "level", "field", "pct", "ielts", "budget", "intake"];

  fields.forEach(id => {

    const element = document.getElementById(id);

    if (!element) return;

    element.value = P[id] || "";

  });

}



function bindProfileInputs() {

  const fields = ["name", "level", "field", "pct", "ielts", "budget", "intake"];



  fields.forEach(id => {

    const element = document.getElementById(id);

    if (!element) return;



    const handler = () => {

      P[id] = element.value;

      view();

      renderAskNext();

      updateProfileCount();

      scheduleProfileSave();

    };



    element.addEventListener("input", handler);

    element.addEventListener("change", handler);

  });

}



function updateProfileCount() {

  const keys = ["level", "field", "pct", "ielts", "budget", "country", "intake"];

  const count = keys.filter(key => known(key)).length;

  const total = keys.length;



  const pc = document.getElementById("pc");

  const pcb = document.getElementById("pcb");



  if (pc) {

    pc.textContent = ` · ${count}/${total}`;

  }

  if (pcb) {

    pcb.style.width = `${(count / total) * 100}%`;

  }

}



/* -------------------------------------------------------

   QUICK CAPTURE

\------------------------------------------------------- */



function showCaptureResult(parsed) {

  const box = document.getElementById("captureResult");

  if (!box) return;



  if (!parsed || !parsed.count) {

    box.innerHTML = `

      <div class="title">Nothing detected</div>

      <div class="mu">

        Try stating level, field, score (e.g. 75%), budget ($25k), IELTS, country, or intake.

      </div>

    `;

    box.classList.add("show");

    return;

  }



  const detected = [

    ...(parsed.detected || []),

    ...(parsed.negativeCountries || [])

  ];



  box.innerHTML = `

    <div class="title">

      <span>✓ Captured ${parsed.count} field${parsed.count > 1 ? "s" : ""}</span>

      <button class="undo" id="undoCapture" type="button">Undo</button>

    </div>

    <div class="mu">

      ${detected.map(x => `<div>${esc(x)}</div>`).join("")}

    </div>

  `;

  box.classList.add("show");

}



function capture() {

  const input = document.getElementById("qc");

  if (!input) return;



  const text = input.value.trim();

  if (!text) return;



  if (!window.CourseCopilotQuickCapture) {

    console.error("quickCapture.js is not loaded.");

    return;

  }



  captureHistory.push(snapshotProfile());

  if (captureHistory.length > 10) captureHistory.shift();



  const parsed = window.CourseCopilotQuickCapture.parse(text, COUNTRIES);

  const changes = parsed.changes || {};



  ["level", "field", "pct", "ielts", "budget", "intake"].forEach(key => {

    if (changes[key] !== undefined && changes[key] !== "") {

      P[key] = changes[key];

    }

  });



  if (Array.isArray(changes.preferredCountries)) {

    changes.preferredCountries.forEach(country => {

      if (!P.preferredCountries.includes(country)) {

        P.preferredCountries.push(country);

      }

      P.excludedCountries = P.excludedCountries.filter(x => x !== country);

    });

  }



  if (Array.isArray(changes.excludedCountries)) {

    changes.excludedCountries.forEach(country => {

      if (!P.excludedCountries.includes(country)) {

        P.excludedCountries.push(country);

      }

      P.preferredCountries = P.preferredCountries.filter(x => x !== country);

    });

  }



  input.value = "";



  // Synchronize input elements with the newly parsed values

  syncProfileInputs();

  chips();

  view();

  renderAskNext();

  updateProfileCount();

  scheduleProfileSave();

  showCaptureResult(parsed);

}



function undoCapture() {

  if (!captureHistory.length) return;



  const previous = captureHistory.pop();

  restoreProfile(previous);



  chips();

  view();

  renderAskNext();

  updateProfileCount();

  scheduleProfileSave();



  const box = document.getElementById("captureResult");

  if (box) {

    box.innerHTML = `<div class="title">↩ Capture undone</div>`;

    box.classList.add("show");

  }

}



/* -------------------------------------------------------

   SHORTLIST & CLIPBOARD EXPORT

\------------------------------------------------------- */



function toggleShortlist(identifier) {

  const index = shortlist.findIndex(

    course => String(course.id ?? course.name) === String(identifier) || course.name === identifier

  );



  if (index >= 0) {

    shortlist.splice(index, 1);

  } else {

    const course = courses.find(

      c => String(c.id ?? c.name) === String(identifier) || c.name === identifier

    );

    if (course) {

      shortlist.push(course);

    }

  }



  updateShortlistCount();

  view();

  scheduleProfileSave();

}



function updateShortlistCount() {

  const element = document.getElementById("sn");

  if (element) {

    element.textContent = shortlist.length;

  }

}



async function copyShortlistToClipboard() {

  if (!shortlist.length) return;



  const studentName = P.name ? ` for ${P.name}` : "";

  const lines = [

    `🎓 Course Copilot — Shortlisted Courses${studentName}:`,

    ""

  ];



  shortlist.forEach((course, index) => {

    lines.push(`${index + 1}. ${course.name} — ${course.uni} (${course.country})`);

    lines.push(`   • Level: ${course.level} | Field: ${course.field} | Fee: $${Number(course.fee).toLocaleString()}/yr | Duration: ${course.duration || course.dur || "N/A"}`);

    if (course.minPct) lines.push(`   • Min Score: ${course.minPct}% | IELTS: ${course.ielts || "N/A"}`);

    if (Array.isArray(course.intake)) lines.push(`   • Intakes: ${course.intake.join(", ")}`);

    if (course.note) lines.push(`   • Note: ${course.note}`);

    lines.push("");

  });



  const exportText = lines.join("\n").trim();



  try {

    await navigator.clipboard.writeText(exportText);

    const copyBtn = document.getElementById("copyShortlistBtn");

    if (copyBtn) {

      const originalText = copyBtn.textContent;

      copyBtn.textContent = "✓ Copied to clipboard!";

      setTimeout(() => {

        copyBtn.textContent = originalText;

      }, 2000);

    }

  } catch (err) {

    console.error("Clipboard write failed:", err);

  }

}



/* -------------------------------------------------------

   VIEW RENDERING & TABS

\------------------------------------------------------- */



function renderSearchResults(query) {

  const resultBox = document.getElementById("searchResults");

  if (!resultBox) return;



  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {

    resultBox.innerHTML = `

      <div class="mu" style="padding:10px;text-align:center">

        Type to search courses by name, university, country, or field.

      </div>

    `;

    return;

  }



  const matches = courses.filter(course => {

    const haystack = [

      course.name,

      course.uni,

      course.country,

      course.field,

      course.level,

      course.note

    ].join(" ").toLowerCase();

    return haystack.includes(cleanQuery);

  });



  if (!matches.length) {

    resultBox.innerHTML = `

      <div class="card">

        <div class="mu">No courses matched "${esc(cleanQuery)}".</div>

      </div>

    `;

    return;

  }



  resultBox.innerHTML = matches

    .slice(0, 15)

    .map((course, index) =>

      courseCard({ course, score: scoreCourse(course) }, index)

    )

    .join("");

}



function view() {

  const root = document.getElementById("view");

  if (!root) return;



  if (mode === "rec") {

    const ranked = rankedCourses();

    root.innerHTML = ranked.slice(0, 5).map(courseCard).join("");

    return;

  }



  if (mode === "short") {

    if (!shortlist.length) {

      root.innerHTML = `

        <div class="card">

          <div class="mu">No shortlisted courses yet. Click the ☆ on any course card to shortlist it.</div>

        </div>

      `;

      return;

    }



    root.innerHTML = `

      <div class="shortlist-header">

        <span class="mu">${shortlist.length} course${shortlist.length > 1 ? "s" : ""} pinned</span>

        <button id="copyShortlistBtn" class="copy-btn" type="button">📋 Copy</button>

      </div>

      ${
        window.CourseCopilotShortlistFeatures
          ? window.CourseCopilotShortlistFeatures.renderShortlistFeatures()
          : ""
      }

      ${shortlist

        .map((course, index) =>

          courseCard({ course, score: scoreCourse(course) }, index)

        )

        .join("")}

    `;

    return;

  }



  if (mode === "search") {

    const existingSearchInput = document.getElementById("searchInput");



    if (!existingSearchInput) {

      root.innerHTML = `

        <div class="card">

          <label for="searchInput">Search courses</label>

          <input

            id="searchInput"

            type="text"

            placeholder="e.g. Data Science Canada"

            value="${esc(currentSearchQuery)}"

          >

        </div>

        <div id="searchResults"></div>

      `;



      const input = document.getElementById("searchInput");

      input.addEventListener("input", () => {

        currentSearchQuery = input.value;

        renderSearchResults(currentSearchQuery);

      });



      renderSearchResults(currentSearchQuery);

    } else {

      // Re-render search results without destroying the input element

      renderSearchResults(currentSearchQuery);

    }

  }

}



function setMode(nextMode) {

  mode = nextMode;

  document.querySelectorAll(".tabs button").forEach(button => {

    button.classList.toggle("on", button.dataset.t === mode);

  });

  view();

}



/* -------------------------------------------------------

   GLOBAL EVENT DELEGATION

\------------------------------------------------------- */



document.addEventListener("click", async event => {

  const target = event.target;

  // Saved Students — New Student
  if (target.closest("#newStudentBtn")) {
    await createNewStudent();
    return;
  }

  // Saved Students — Load
  const loadProfile = target.closest("[data-load-profile]");
  if (loadProfile) {
    await loadStudentProfile(loadProfile.dataset.loadProfile);
    return;
  }

  // Saved Students — Delete
  const deleteProfile = target.closest("[data-delete-profile]");
  if (deleteProfile) {
    await deleteStudentProfile(deleteProfile.dataset.deleteProfile);
    return;
  }

  // Session History — Resume
  const resumeSessionButton = target.closest("[data-resume-session]");
  if (resumeSessionButton) {
    await resumeSession(resumeSessionButton.dataset.resumeSession);
    return;
  }



  // Tabs

  const tab = target.closest(".tabs button");

  if (tab) {

    setMode(tab.dataset.t);

    return;

  }



  // Shortlist Star Toggle

  const pin = target.closest("[data-pin]");

  if (pin) {

    toggleShortlist(pin.dataset.pin);

    return;

  }



  // Copy Shortlist

  if (target.closest("#copyShortlistBtn")) {

    copyShortlistToClipboard();

    return;

  }



  // Preferred country chip

  const country = target.closest("[data-country]");

  if (country) {

    const value = country.dataset.country;

    if (P.preferredCountries.includes(value)) {

      P.preferredCountries = P.preferredCountries.filter(x => x !== value);

    } else {

      P.preferredCountries.push(value);

      P.excludedCountries = P.excludedCountries.filter(x => x !== value);

    }

    chips();

    view();

    renderAskNext();

    updateProfileCount();

    scheduleProfileSave();

    return;

  }



  // Avoid country chip

  const avoid = target.closest("[data-avoid]");

  if (avoid) {

    const value = avoid.dataset.avoid;

    if (P.excludedCountries.includes(value)) {

      P.excludedCountries = P.excludedCountries.filter(x => x !== value);

    } else {

      P.excludedCountries.push(value);

      P.preferredCountries = P.preferredCountries.filter(x => x !== value);

    }

    chips();

    view();

    renderAskNext();

    updateProfileCount();

    scheduleProfileSave();

    return;

  }



  // Undo capture

  if (target.closest("#undoCapture")) {

    undoCapture();

    return;

  }



  // Ask Next — Ask this

  const ask = target.closest("[data-ask]");

  if (ask) {

    handleAskNextAction(ask.dataset.ask);

    return;

  }



  // Ask Next — Skip

  const skip = target.closest("[data-skip]");

  if (skip) {

    skipAskNext(skip.dataset.skip);

    return;

  }

});



/* -------------------------------------------------------

   INTEGRATED COURSE PLANNING
   Total-cost estimates, application deadlines, and urgency

   These are planning estimates and should be verified against
   official university/government sources before counselling use.
\------------------------------------------------------- */

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


/* -------------------------------------------------------

   INTEGRATED SHORTLIST FEATURES
   Comparison, total-cost estimator, and shareable/PDF page
\------------------------------------------------------- */

/* Course Copilot — Shortlist Comparison, Cost, Deadline & Share */
(function () {
  let showComparison = false;
  let showCostEstimator = false;

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "N/A";
  }

  function courseKey(course) {
    return String(course?.id ?? course?.name ?? "");
  }

  function selectedCourses() {
    if (typeof shortlist === "undefined") return [];
    return shortlist.slice(0, 3);
  }

  function gapText(course) {
    if (typeof explain !== "function") return [];
    return explain(course).gaps || [];
  }

  function valueClass(value, values, lowerIsBetter = false) {
    const clean = values.filter(v => Number.isFinite(Number(v))).map(Number);
    if (!clean.length || !Number.isFinite(Number(value))) return "";
    const best = lowerIsBetter ? Math.min(...clean) : Math.max(...clean);
    return Number(value) === best ? "compare-best" : "";
  }

  function renderComparison() {
    const list = selectedCourses();
    if (!showComparison) return "";
    if (list.length < 2) {
      return `<div class="feature-panel"><strong>Compare courses</strong><div class="mu" style="margin-top:5px">Pin at least 2 courses using ☆ before comparing.</div></div>`;
    }

    const rows = [
      ["University", c => c.uni, false, false],
      ["Country", c => c.country, false, false],
      ["Tuition / year", c => money(c.fee), true, true],
      ["Estimated total cost", c => money(window.CourseCopilotPlanning.estimate(c).total), true, true],
      ["Duration", c => c.duration || c.dur || "N/A", false, false],
      ["Intake", c => Array.isArray(c.intake) ? c.intake.join(", ") : "N/A", false, false],
      ["Min academic score", c => c.minPct != null ? `${c.minPct}%` : "N/A", true, true],
      ["IELTS", c => c.ielts != null ? c.ielts : "N/A", true, true],
      ["Next deadline", c => window.CourseCopilotPlanning.deadlineInfo(c).label, false, false],
      ["Student gaps", c => gapText(c).length ? gapText(c).join(" · ") : "None identified", false, false]
    ];

    return `
      <div class="feature-panel compare-panel">
        <div class="feature-header">
          <div><strong>Side-by-side comparison</strong><div class="mu">Best-value cells are highlighted.</div></div>
          <button class="saved-action" data-feature="compare-close" type="button">Hide</button>
        </div>
        <div class="compare-scroll">
          <table class="compare-table">
            <thead><tr><th>Metric</th>${list.map(c => `<th>${esc(c.name)}<div class="mu">${esc(c.uni)}</div></th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map(([label, getter, numeric, lower]) => {
                const values = numeric ? list.map(c => {
                  if (label === "Estimated total cost") return window.CourseCopilotPlanning.estimate(c).total;
                  if (label === "Min academic score") return Number(c.minPct);
                  if (label === "IELTS") return Number(c.ielts);
                  return Number(c.fee);
                }) : [];
                return `<tr><th>${esc(label)}</th>${list.map(c => `<td class="${valueClass(numeric ? (label === "Estimated total cost" ? window.CourseCopilotPlanning.estimate(c).total : label === "Min academic score" ? Number(c.minPct) : Number(c.ielts)) : null, values, lower)}">${esc(getter(c))}</td>`).join("")}</tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderCostEstimator() {
    const list = selectedCourses();
    if (!showCostEstimator) return "";
    if (!list.length) return `<div class="feature-panel"><strong>Total cost</strong><div class="mu">Pin courses first.</div></div>`;
    const estimates = list.map(course => ({ course, estimate: window.CourseCopilotPlanning.estimate(course) }));
    const cheapest = Math.min(...estimates.map(x => x.estimate.total));
    return `
      <div class="feature-panel">
        <div class="feature-header">
          <div><strong>Total cost estimator</strong><div class="mu">Illustrative USD estimates; replace planning assumptions with verified costs.</div></div>
          <button class="saved-action" data-feature="cost-close" type="button">Hide</button>
        </div>
        ${estimates.map(({course, estimate}) => `
          <div class="cost-row ${estimate.total === cheapest ? "cost-best" : ""}">
            <div><strong>${esc(course.name)}</strong><div class="mu">${esc(course.country)} · ${estimate.years} year${estimate.years === 1 ? "" : "s"}</div></div>
            <div class="cost-total">${money(estimate.total)}</div>
          </div>
          <div class="cost-breakdown">
            Tuition ${money(estimate.tuitionTotal)} · Living ${money(estimate.livingTotal)} · Insurance ${money(estimate.insuranceTotal)} · Visa ${money(estimate.visaTotal)}
          </div>
        `).join("")}
        ${estimates.length > 1 ? `<div class="cost-callout">💡 ${esc(estimates.find(x => x.estimate.total === cheapest).course.name)} is the lowest estimated overall cost among the pinned options.</div>` : ""}
      </div>`;
  }

  function featureControls() {
    const count = typeof shortlist === "undefined" ? 0 : shortlist.length;
    return `
      <div class="feature-toolbar">
        <span class="mu">${count} pinned</span>
        <div class="feature-actions">
          <button class="copy-btn" data-feature="compare" type="button">⚖ Compare 2–3</button>
          <button class="copy-btn" data-feature="cost" type="button">💰 Total cost</button>
          <button class="copy-btn" data-feature="share" type="button">↗ Share / PDF</button>
        </div>
      </div>
      ${renderComparison()}
      ${renderCostEstimator()}
      ${window.CourseCopilotScholarshipCareer ? window.CourseCopilotScholarshipCareer.renderToolbar() : ""}
      ${window.CourseCopilotScholarshipCareer ? window.CourseCopilotScholarshipCareer.renderPanels() : ""}`;
  }

  function shareHtml() {
    const list = typeof shortlist === "undefined" ? [] : shortlist;
    const student = typeof P !== "undefined" ? P : {};
    const rows = list.map(course => {
      const cost = window.CourseCopilotPlanning.estimate(course);
      const deadline = window.CourseCopilotPlanning.deadlineInfo(course);
      const gaps = gapText(course);
      return `<article><h2>${esc(course.name)}</h2><p><strong>${esc(course.uni)}</strong> · ${esc(course.country)}</p><p>Fee: ${money(course.fee)}/yr · Duration: ${esc(course.duration || course.dur || "N/A")} · Intakes: ${esc((course.intake || []).join(", "))}</p><p><strong>Estimated total cost:</strong> ${money(cost.total)} (${money(cost.tuitionTotal)} tuition + ${money(cost.livingTotal)} living + ${money(cost.insuranceTotal)} insurance + ${money(cost.visaTotal)} visa)</p><p><strong>Next deadline:</strong> ${esc(deadline.label)}</p><p><strong>Fit:</strong> ${gaps.length ? `Gaps: ${esc(gaps.join("; "))}` : "No major gaps identified from the current profile."}</p>${window.CourseCopilotScholarshipCareer ? (() => { const s = window.CourseCopilotScholarshipCareer.scholarshipMatch(course, student); return `<p><strong>Scholarship:</strong> ${esc(s.label)}</p>${s.discountKnown ? `<p><strong>Adjusted tuition:</strong> ${money(s.adjustedFee)}/yr</p>` : ""}`; })() : ""}${window.CourseCopilotScholarshipCareer ? (() => { const co = window.CourseCopilotScholarshipCareer.careerOutlook(course); return `<p><strong>Typical roles:</strong> ${esc(co.roles.join(", ") || "No job-role data stored")}</p><p><strong>Post-study work:</strong> ${esc(co.country?.workPermit || "No country rule stored")}</p><p><strong>Stay-back:</strong> ${esc(co.country?.stayBack || "No country rule stored")}${co.country?.duration ? ` · ${esc(String(co.country.duration))}` : ""}</p>`; })() : ""}<p>${esc(course.note || "")}</p></article>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Course Copilot Shortlist</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#1b1f27}h1{margin-bottom:4px}article{border:1px solid #ddd;border-radius:12px;padding:18px;margin:18px 0}small{color:#667085}.meta{color:#667085}.actions{margin:18px 0}.print{border:0;border-radius:8px;padding:9px 14px;background:#2f6df6;color:#fff;font-weight:700;cursor:pointer}@media print{article{break-inside:avoid}.actions{display:none}}</style></head><body><div class="actions"><button class="print" onclick="window.print()">Print / Save as PDF</button></div><h1>Course Copilot — Shortlist</h1><p class="meta">${esc(student.name || "Student")} · Generated ${new Date().toLocaleString()}</p>${rows || "<p>No courses pinned.</p>"}<p><small>Planning costs and deadlines are estimates and should be verified against official university/government sources.</small></p></body></html>`;
  }

  function share() {
    if (typeof shortlist === "undefined" || !shortlist.length) {
      alert("Pin at least one course before sharing.");
      return;
    }
    const html = shareHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "course-copilot-shortlist.html";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (typeof CURRENT_SESSION_ID !== "undefined" && window.CourseCopilotProfileStore) {
      window.CourseCopilotProfileStore.updateSession(CURRENT_SESSION_ID, { shortlistExportedAt: new Date().toISOString() }).catch(() => {});
    }
  }

  function toggleFeature(feature) {
    if (feature === "compare") {
      if (typeof shortlist === "undefined" || shortlist.length < 2) {
        alert("Pin at least 2 courses to compare.");
        return;
      }
      if (shortlist.length > 3) {
        alert("Keep 2 or 3 pinned courses for a clean comparison.");
        return;
      }
      showComparison = !showComparison;
    }
    if (feature === "cost") showCostEstimator = !showCostEstimator;
    if (feature === "share") share();
    if (feature === "compare-close") showComparison = false;
    if (feature === "cost-close") showCostEstimator = false;
    if (typeof view === "function") view();
  }

  function renderShortlistFeatures() {
    if (typeof mode === "undefined" || mode !== "short") return "";
    return featureControls();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-feature]");
    if (button) toggleFeature(button.dataset.feature);
  });

  window.CourseCopilotShortlistFeatures = {
    renderShortlistFeatures,
    share
  };
})();


/* -------------------------------------------------------
   SCHOLARSHIP MATCHER + POST-STUDY WORK / CAREER OUTLOOK
   Data-driven: only displays scholarship / immigration facts when
   they are explicitly present in the course/country data layer.
------------------------------------------------------- */
(function () {
  const SCHOLARSHIP_DATA = {
    /* Existing dataset signal: courses.js notes that University of Arizona
       offers scholarships for students with 80%+. No award amount is
       asserted here because the source dataset does not provide one. */
    "BSc Computer Science|University of Arizona": [
      {
        name: "University of Arizona merit scholarship signal",
        minPct: 80,
        amountType: "unknown",
        amount: 0,
        note: "Dataset note indicates scholarships for 80%+; award value must be verified.",
        verificationStatus: "dataset-signal"
      }
    ]
  };

  /* Typical role labels are career-planning labels, not employment guarantees. */
  const COURSE_JOB_ROLES = {
    "MSc Computer Science|TU Munich": ["Software Engineer", "Machine Learning Engineer", "Research Engineer"],
    "MSc Data Science|University of Toronto": ["Data Scientist", "Data Analyst", "Machine Learning Engineer"],
    "MSc Artificial Intelligence|University of Edinburgh": ["AI Engineer", "Machine Learning Engineer", "Data Scientist"],
    "MS Computer Science|Arizona State University": ["Software Engineer", "Cloud Engineer", "Machine Learning Engineer"],
    "MSc Computer Science|University of Melbourne": ["Software Engineer", "Data Engineer", "Systems Engineer"],
    "MSc Data Analytics|University College Dublin": ["Data Analyst", "Business Intelligence Analyst", "Data Scientist"],
    "MBA|ESSEC Business School": ["Management Consultant", "Product Manager", "Business Development Manager"],
    "MSc International Management|University of Mannheim": ["Business Analyst", "Management Consultant", "Product Manager"],
    "MEng Mechanical Engineering|TU Delft": ["Mechanical Engineer", "Design Engineer", "Manufacturing Engineer"],
    "MS Mechanical Engineering|Purdue University": ["Mechanical Engineer", "Product Development Engineer", "Manufacturing Engineer"],
    "MPH Public Health|University of Sydney": ["Public Health Analyst", "Health Program Manager", "Epidemiology Analyst"],
    "MSc Health Informatics|University of Manchester": ["Health Informatics Analyst", "Clinical Data Analyst", "Healthcare Data Scientist"],
    "MDes Interaction Design|Politecnico di Milano": ["UX Designer", "Product Designer", "Interaction Designer"],
    "BSc Computer Science|University of Waterloo": ["Software Engineer", "Data Engineer", "Systems Developer"],
    "BSc Data Science|University of Glasgow": ["Data Analyst", "Data Scientist", "Business Intelligence Analyst"],
    "BBA Business Admin|Monash University": ["Business Analyst", "Marketing Analyst", "Operations Analyst"],
    "BEng Mechanical Engineering|TU Berlin": ["Mechanical Engineer", "Design Engineer", "Manufacturing Engineer"],
    "BSc Computer Science|University of Arizona": ["Software Engineer", "Systems Developer", "Data Analyst"],
    "BDes Communication Design|Parsons (The New School)": ["Communication Designer", "Brand Designer", "UX Designer"],
    "BSc Nursing|University of Limerick": ["Registered Nurse", "Clinical Nurse", "Community Health Nurse"]
  };

  /* Country-level work/visa records are intentionally structured so verified
     values can be inserted later. Do not infer a legal entitlement from this
     empty/default record. */
  const COUNTRY_WORK_DATA = {
    USA: { stayBack: "Up to 12 months post-completion OPT; eligible STEM graduates may qualify for a 24-month STEM OPT extension", workPermit: "F-1 OPT / STEM OPT", duration: "Up to 36 months for eligible STEM graduates", sourceUrl: "https://www.uscis.gov/sites/default/files/document/policy-manual-updates/20240827-STEMOPT.pdf", verificationStatus: "verified", lastVerified: "2026-10" },
    UK: { stayBack: "18 months for Graduate visa applications made on/after 1 Jan 2027; doctoral graduates get 3 years", workPermit: "Graduate Route", duration: "18 months for most applications from 1 Jan 2027", sourceUrl: "https://www.gov.uk/graduate-visa/overview", verificationStatus: "verified", lastVerified: "2026-10" },
    Canada: { stayBack: "PGWP can be valid from 8 months up to 3 years, depending on eligibility and program", workPermit: "Post-Graduation Work Permit (PGWP)", duration: "8 months–3 years", sourceUrl: "https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=509&top=15+", verificationStatus: "verified", lastVerified: "2026-10" },
    Germany: { stayBack: "Up to 18 months to look for qualified employment after graduation", workPermit: "Post-study residence permit / qualified employment route", duration: "Up to 18 months", sourceUrl: "https://www.make-it-in-germany.com/en/study-training/study-in-germany/after-graduation", verificationStatus: "verified", lastVerified: "2026-10" },
    Australia: { stayBack: "Post-Higher Education Work stream: usually 2–3 years; Indian nationals may receive 3 years for eligible master's degrees under AI-ECTA", workPermit: "Temporary Graduate visa (subclass 485), Post-Higher Education Work stream", duration: "Usually 2–3 years; eligible Indian master's: 3 years", sourceUrl: "https://immi.homeaffairs.gov.au/Visa-subsite/Pages/work/485-post-study-work.aspx", verificationStatus: "verified", lastVerified: "2026-10" },
    Ireland: { stayBack: "Level 9 or above graduates can receive up to 24 months, initially 12 months with possible renewal", workPermit: "Third Level Graduate Programme / Stamp 1G", duration: "Up to 24 months for Level 9+", sourceUrl: "https://www.irishimmigration.ie/my-situation-has-changed-since-i-arrived-in-ireland/third-level-graduate-programme/", verificationStatus: "verified", lastVerified: "2026-10" },
    France: { stayBack: "Data required", workPermit: "Post-study work rules require verification", duration: null, sourceUrl: "", verificationStatus: "unverified" },
    Netherlands: { stayBack: "Orientation year residence permit is valid for 1 year", workPermit: "Orientation Year residence permit; can switch to another work residence permit after finding qualifying work", duration: "1 year", sourceUrl: "https://ind.nl/en/residence-permits/work/residence-permit-for-orientation-year", verificationStatus: "verified", lastVerified: "2026-10" },
    Sweden: { stayBack: "Data required", workPermit: "Post-study permit rules require verification", duration: null, sourceUrl: "", verificationStatus: "unverified" },
    Singapore: { stayBack: "Data required", workPermit: "Post-study work eligibility requires verification", duration: null, sourceUrl: "", verificationStatus: "unverified" },
    "New Zealand": { stayBack: "Data required", workPermit: "Post-study work visa rules require verification", duration: null, sourceUrl: "", verificationStatus: "unverified" }
  };

  function moneyLocal(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "—";
  }

  function courseKey(course) {
    return `${course.name || ""}|${course.uni || ""}`;
  }

  function scholarshipRecords(course) {
    const direct = Array.isArray(course.scholarships) ? course.scholarships : [];
    return direct.length ? direct : (SCHOLARSHIP_DATA[courseKey(course)] || []);
  }

  function matchesScholarship(scholarship, profile) {
    const pct = Number(profile?.pct);
    const ielts = Number(profile?.ielts);
    if (scholarship.minPct != null && Number.isFinite(pct) && pct < Number(scholarship.minPct)) return false;
    if (scholarship.maxPct != null && Number.isFinite(pct) && pct > Number(scholarship.maxPct)) return false;
    if (scholarship.minIELTS != null && Number.isFinite(ielts) && ielts < Number(scholarship.minIELTS)) return false;
    if (Array.isArray(scholarship.levels) && scholarship.levels.length && !scholarship.levels.includes(profile?.level)) return false;
    if (Array.isArray(scholarship.fields) && scholarship.fields.length && !scholarship.fields.includes(profile?.field)) return false;
    return true;
  }

  function scholarshipMatch(course, profile = P) {
    const records = scholarshipRecords(course);
    const eligible = records.filter(item => matchesScholarship(item, profile));
    const best = eligible[0] || null;
    let adjustedFee = Number(course.fee) || 0;
    let discount = 0;
    let discountKnown = false;

    if (best) {
      if (best.amountType === "percent" && Number.isFinite(Number(best.amount))) {
        discount = adjustedFee * (Number(best.amount) / 100);
        adjustedFee = Math.max(0, adjustedFee - discount);
        discountKnown = true;
      } else if (best.amountType === "fixed" && Number.isFinite(Number(best.amount))) {
        discount = Math.min(adjustedFee, Number(best.amount));
        adjustedFee = Math.max(0, adjustedFee - discount);
        discountKnown = true;
      }
    }

    return {
      records,
      eligible: Boolean(best),
      scholarship: best,
      adjustedFee,
      discount,
      discountKnown,
      label: !records.length
        ? "No scholarship data stored"
        : !best
          ? "No matching scholarship"
          : discountKnown
            ? `${best.name} · adjusted tuition ${moneyLocal(adjustedFee)}/yr`
            : `${best.name} · eligibility signal matched; award amount unverified`
    };
  }

  function careerOutlook(course) {
    const directRoles = Array.isArray(course.jobRoles) ? course.jobRoles : [];
    const roles = directRoles.length ? directRoles : (COURSE_JOB_ROLES[courseKey(course)] || []);
    const country = COUNTRY_WORK_DATA[course.country] || null;
    return { roles, country };
  }

  function enrichCareerData() {
    if (typeof courses === "undefined" || !Array.isArray(courses)) return;
    courses.forEach(course => {
      if (!Array.isArray(course.scholarships) && SCHOLARSHIP_DATA[courseKey(course)]) {
        course.scholarships = SCHOLARSHIP_DATA[courseKey(course)];
      }
      if (!Array.isArray(course.jobRoles) && COURSE_JOB_ROLES[courseKey(course)]) {
        course.jobRoles = COURSE_JOB_ROLES[courseKey(course)];
      }
      course.countryWorkData = COUNTRY_WORK_DATA[course.country] || null;
    });
  }

  function renderScholarshipPanel() {
    const list = typeof shortlist === "undefined" ? [] : shortlist;
    if (!list.length) return `<div class="feature-panel"><strong>🎓 Scholarship matcher</strong><div class="mu">Pin courses first.</div></div>`;
    return `<div class="feature-panel">
      <div class="feature-header"><div><strong>🎓 Scholarship matcher</strong><div class="mu">Matches stored scholarship eligibility against the student's profile.</div></div><button class="saved-action" data-feature="scholarship-close" type="button">Hide</button></div>
      ${list.map(course => {
        const match = scholarshipMatch(course, P);
        return `<div class="career-card">
          <div><strong>${esc(course.name)}</strong><div class="mu">${esc(course.uni)} · ${esc(course.country)}</div></div>
          <div class="${match.eligible ? "ok" : "mu"}" style="margin-top:5px">${esc(match.label)}</div>
          ${match.eligible && match.discountKnown ? `<div style="margin-top:5px"><strong>Adjusted tuition:</strong> ${moneyLocal(match.adjustedFee)}/yr · <span class="ok">Save ${moneyLocal(match.discount)}/yr</span></div>` : ""}
          ${match.scholarship?.note ? `<div class="mu" style="margin-top:5px">${esc(match.scholarship.note)}</div>` : ""}
        </div>`;
      }).join("")}
    </div>`;
  }

  function renderCareerPanel() {
    const list = typeof shortlist === "undefined" ? [] : shortlist;
    if (!list.length) return `<div class="feature-panel"><strong>🌍 Post-study & careers</strong><div class="mu">Pin courses first.</div></div>`;
    return `<div class="feature-panel">
      <div class="feature-header"><div><strong>🌍 Post-study work & career outlook</strong><div class="mu">Career roles are typical role labels; visa/work-permit information must be verified before advising.</div></div><button class="saved-action" data-feature="career-close" type="button">Hide</button></div>
      ${list.map(course => {
        const data = careerOutlook(course);
        const country = data.country;
        return `<div class="career-card">
          <div><strong>${esc(course.name)}</strong><div class="mu">${esc(course.country)}</div></div>
          <div style="margin-top:6px"><strong>Typical roles</strong><div class="mu">${data.roles.length ? data.roles.map(esc).join(" · ") : "No job-role data stored"}</div></div>
          <div style="margin-top:6px"><strong>Post-study work</strong><div class="mu">${esc(country?.workPermit || "No country rule stored")}</div></div>
          <div style="margin-top:4px"><strong>Stay-back</strong><div class="mu">${esc(country?.stayBack || "No country rule stored")}${country?.duration ? ` · ${esc(String(country.duration))}` : ""}</div></div>
          ${country?.sourceUrl ? `<div style="margin-top:5px"><a href="${esc(country.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official source</a></div>` : ""}
          <div class="wn" style="margin-top:5px;font-size:11px">${country?.verificationStatus === "verified" ? "✓ Verified country rule" : "⚠ Immigration/work-permit data requires verification"}</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function renderToolbar() {
    const count = typeof shortlist === "undefined" ? 0 : shortlist.length;
    return `<div class="feature-toolbar">
      <span class="mu">${count} pinned</span>
      <div class="feature-actions">
        <button class="copy-btn" data-feature="scholarship" type="button">🎓 Scholarships</button>
        <button class="copy-btn" data-feature="career" type="button">🌍 Post-study & careers</button>
      </div>
    </div>`;
  }

  let showScholarship = false;
  let showCareer = false;

  function renderPanels() {
    return `${showScholarship ? renderScholarshipPanel() : ""}${showCareer ? renderCareerPanel() : ""}`;
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-feature]");
    if (!button) return;
    const feature = button.dataset.feature;
    if (feature === "scholarship") showScholarship = !showScholarship;
    if (feature === "career") showCareer = !showCareer;
    if (feature === "scholarship-close") showScholarship = false;
    if (feature === "career-close") showCareer = false;
    if (typeof view === "function") view();
  });

  enrichCareerData();
  window.CourseCopilotScholarshipCareer = {
    scholarshipMatch,
    careerOutlook,
    renderToolbar,
    renderPanels,
    enrichCareerData
  };
})();


/* -------------------------------------------------------

   INITIALIZATION

\------------------------------------------------------- */



document.getElementById("qcb")?.addEventListener("click", capture);

document.getElementById("qc")?.addEventListener("keydown", event => {

  if (event.key === "Enter") {

    event.preventDefault();

    capture();

  }

});



bindProfileInputs();

window.CourseCopilotScholarshipCareer?.enrichCareerData();

chips();

updateShortlistCount();

updateProfileCount();

view();

renderAskNext();

renderCourseDataStatus();

bindLLM();

initializeCourseCopilotSession();