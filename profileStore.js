/* Course Copilot — Saved Profiles & Session History */

(function () {

  const STORAGE_KEY = "courseCopilotData";

  const CURRENT_VERSION = 1;


  /* --------------------------------------------------
     DEFAULT STORAGE
  -------------------------------------------------- */

  function getDefaultData() {

    return {

      version:
        CURRENT_VERSION,

      profiles: [],

      sessions: []

    };

  }


  /* --------------------------------------------------
     STORAGE HELPERS
  -------------------------------------------------- */

  async function loadData() {

    const result =
      await chrome.storage.local.get(
        STORAGE_KEY
      );


    const data =
      result?.[STORAGE_KEY];


    if (
      !data ||
      typeof data !== "object"
    ) {

      return getDefaultData();

    }


    return {

      ...getDefaultData(),

      ...data,

      profiles:
        Array.isArray(data.profiles)
          ? data.profiles
          : [],

      sessions:
        Array.isArray(data.sessions)
          ? data.sessions
          : []

    };

  }


  async function saveData(
    data
  ) {

    await chrome.storage.local.set({

      [STORAGE_KEY]:
        data

    });

  }


  /* --------------------------------------------------
     ID GENERATION
  -------------------------------------------------- */

  function generateId(
    prefix
  ) {

    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 8)
    );

  }


  /* --------------------------------------------------
     PROFILE NORMALIZATION
  -------------------------------------------------- */

  function normalizeProfile(
    profile
  ) {

    const now =
      new Date().toISOString();


    return {

      id:
        profile.id ||
        generateId("profile"),

      name:
        String(
          profile.name || ""
        ).trim(),

      level:
        profile.level || "",

      field:
        profile.field || "",

      pct:
        profile.pct || "",

      ielts:
        profile.ielts || "",

      budget:
        profile.budget || "",

      intake:
        profile.intake || "",

      preferredCountries:
        Array.isArray(
          profile.preferredCountries
        )
          ? [
              ...new Set(
                profile.preferredCountries
              )
            ]
          : [],

      excludedCountries:
        Array.isArray(
          profile.excludedCountries
        )
          ? [
              ...new Set(
                profile.excludedCountries
              )
            ]
          : [],

      shortlistedCourses:
        Array.isArray(
          profile.shortlistedCourses
        )
          ? [
              ...new Set(
                profile.shortlistedCourses
              )
            ]
          : [],

      createdAt:
        profile.createdAt ||
        now,

      updatedAt:
        now

    };

  }


  /* --------------------------------------------------
     SAVE PROFILE
  -------------------------------------------------- */

  async function saveProfile(
    profile
  ) {

    const data =
      await loadData();


    const normalized =
      normalizeProfile(
        profile
      );


    const existingIndex =
      data.profiles.findIndex(
        item =>
          item.id ===
          normalized.id
      );


    if (
      existingIndex >= 0
    ) {

      data.profiles[
        existingIndex
      ] =
        normalized;

    } else {

      data.profiles.push(
        normalized
      );

    }


    await saveData(
      data
    );


    return normalized;

  }


  /* --------------------------------------------------
     GET PROFILES
  -------------------------------------------------- */

  async function getProfiles() {

    const data =
      await loadData();


    return [
      ...data.profiles
    ]
      .sort(
        (a, b) =>
          new Date(
            b.updatedAt
          ) -
          new Date(
            a.updatedAt
          )
      );

  }


  /* --------------------------------------------------
     GET PROFILE
  -------------------------------------------------- */

  async function getProfile(
    profileId
  ) {

    const data =
      await loadData();


    return (
      data.profiles.find(
        profile =>
          profile.id ===
          profileId
      ) ||
      null
    );

  }


  /* --------------------------------------------------
     DELETE PROFILE
  -------------------------------------------------- */

  async function deleteProfile(
    profileId
  ) {

    const data =
      await loadData();


    data.profiles =
      data.profiles.filter(
        profile =>
          profile.id !==
          profileId
      );


    /*
     * Keep sessions intact.
     *
     * A counselling session should remain
     * available even if the profile is deleted.
     */

    await saveData(
      data
    );


    return true;

  }


  /* --------------------------------------------------
     SESSION CREATION
  -------------------------------------------------- */

  async function createSession(
    profile
  ) {

    const data =
      await loadData();


    const now =
      new Date().toISOString();


    const session = {

      id:
        generateId("session"),

      profileId:
        profile?.id || null,

      startedAt:
        now,

      updatedAt:
        now,

      profileSnapshot:
        normalizeProfile(
          profile || {}
        ),

      questions: [],

      answers: [],

      shortlistedCourses: [],

      recommendedCourses: []

    };


    data.sessions.push(
      session
    );


    await saveData(
      data
    );


    return session;

  }


  /* --------------------------------------------------
     UPDATE SESSION
  -------------------------------------------------- */

  async function updateSession(
    sessionId,
    changes
  ) {

    const data =
      await loadData();


    const index =
      data.sessions.findIndex(
        session =>
          session.id ===
          sessionId
      );


    if (
      index === -1
    ) {

      throw new Error(
        "Session not found."
      );

    }


    data.sessions[index] = {

      ...data.sessions[index],

      ...changes,

      updatedAt:
        new Date().toISOString()

    };


    await saveData(
      data
    );


    return data.sessions[index];

  }


  /* --------------------------------------------------
     ADD Q&A TO SESSION
  -------------------------------------------------- */

  async function addQuestionAnswer(
    sessionId,
    question,
    answer,
    citations = []
  ) {

    const data =
      await loadData();


    const session =
      data.sessions.find(
        item =>
          item.id ===
          sessionId
      );


    if (!session) {

      throw new Error(
        "Session not found."
      );

    }


    session.questions.push({

      id:
        generateId("qa"),

      question:
        String(
          question || ""
        ).trim(),

      answer:
        String(
          answer || ""
        ).trim(),

      citations:
        Array.isArray(citations)
          ? citations
          : [],

      timestamp:
        new Date().toISOString()

    });


    /*
     * `answers` is retained as a simple
     * backwards-compatible answer history.
     */

    session.answers.push({

      answer:
        String(
          answer || ""
        ).trim(),

      timestamp:
        new Date().toISOString()

    });


    session.updatedAt =
      new Date().toISOString();


    await saveData(
      data
    );


    return session;

  }


  /* --------------------------------------------------
     UPDATE SHORTLIST
  -------------------------------------------------- */

  async function updateSessionShortlist(
    sessionId,
    shortlistedCourses
  ) {

    return updateSession(

      sessionId,

      {

        shortlistedCourses:
          Array.isArray(
            shortlistedCourses
          )
            ? [
                ...new Set(
                  shortlistedCourses
                )
              ]
            : []

      }

    );

  }


  /* --------------------------------------------------
     SAVE RECOMMENDATIONS
  -------------------------------------------------- */

  async function saveRecommendations(
    sessionId,
    recommendedCourses
  ) {

    return updateSession(

      sessionId,

      {

        recommendedCourses:
          Array.isArray(
            recommendedCourses
          )
            ? recommendedCourses
            : []

      }

    );

  }


  /* --------------------------------------------------
     GET SESSIONS
  -------------------------------------------------- */

  async function getSessions() {

    const data =
      await loadData();


    return [
      ...data.sessions
    ]
      .sort(
        (a, b) =>
          new Date(
            b.updatedAt
          ) -
          new Date(
            a.updatedAt
          )
      );

  }


  /* --------------------------------------------------
     GET SESSION
  -------------------------------------------------- */

  async function getSession(
    sessionId
  ) {

    const data =
      await loadData();


    return (
      data.sessions.find(
        session =>
          session.id ===
          sessionId
      ) ||
      null
    );

  }


  /* --------------------------------------------------
     DELETE SESSION
  -------------------------------------------------- */

  async function deleteSession(
    sessionId
  ) {

    const data =
      await loadData();


    data.sessions =
      data.sessions.filter(
        session =>
          session.id !==
          sessionId
      );


    await saveData(
      data
    );


    return true;

  }


  /* --------------------------------------------------
     CURRENT SESSION
  -------------------------------------------------- */

  async function setCurrentSession(
    sessionId
  ) {

    await chrome.storage.local.set({

      courseCopilotCurrentSession:
        sessionId

    });

  }


  async function getCurrentSession() {

    const result =
      await chrome.storage.local.get(
        "courseCopilotCurrentSession"
      );


    return (
      result.courseCopilotCurrentSession ||
      null
    );

  }


  async function clearCurrentSession() {

    await chrome.storage.local.remove(
      "courseCopilotCurrentSession"
    );

  }


  /* --------------------------------------------------
     STORAGE SUMMARY
  -------------------------------------------------- */

  async function getSummary() {

    const data =
      await loadData();


    return {

      profiles:
        data.profiles.length,

      sessions:
        data.sessions.length,

      version:
        data.version

    };

  }


  /* --------------------------------------------------
     PUBLIC API
  -------------------------------------------------- */

  window.CourseCopilotProfileStore = {

    loadData,

    saveProfile,

    getProfiles,

    getProfile,

    deleteProfile,

    createSession,

    updateSession,

    addQuestionAnswer,

    updateSessionShortlist,

    saveRecommendations,

    getSessions,

    getSession,

    deleteSession,

    setCurrentSession,

    getCurrentSession,

    clearCurrentSession,

    getSummary

  };

})();