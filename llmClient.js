/* Course Copilot — Secure LLM Client */

(function () {

  const CONFIG = {
      "API_URL": "https://course-recommendor-extension.onrender.com/api/course-copilot",

    REQUEST_TIMEOUT: 30000
  };


  async function ask(
    question,
    courses,
    profile
  ) {

    if (
      !question ||
      !String(question).trim()
    ) {

      throw new Error(
        "Please enter a question."
      );
    }


    if (
      !window.CourseCopilotLLM
    ) {

      throw new Error(
        "LLM module is not loaded."
      );
    }


    const request =
      window.CourseCopilotLLM.buildRequest(
        question,
        courses,
        profile
      );


    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        CONFIG.REQUEST_TIMEOUT
      );


    try {

      const response =
        await fetch(
          CONFIG.API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(request),

            signal:
              controller.signal
          }
        );


      let data = null;


      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "The backend returned an invalid response."
        );
      }


      if (!response.ok) {

        throw new Error(
          data?.error ||
          `Backend error (${response.status})`
        );
      }


      const validation =
        window.CourseCopilotLLM
          .validateResponse(data);


      if (!validation.valid) {

        throw new Error(
          validation.error
        );
      }


      return {

        answer:
          validation.answer,

        citations:
          Array.isArray(
            data.citations
          )
            ? data.citations
            : [],

        grounded:
          data.grounded !== false,

        retrievedCount:
          data.retrievedCount ??
          request.context.retrieved_count

      };

    } catch (error) {

      if (
        error.name ===
        "AbortError"
      ) {

        throw new Error(
          "The AI request timed out."
        );
      }


      throw error;

    } finally {

      clearTimeout(timeout);

    }
  }


  function setApiUrl(
    url
  ) {

    if (
      !url ||
      typeof url !== "string"
    ) {

      throw new Error(
        "Invalid API URL."
      );
    }


    CONFIG.API_URL =
      url.trim();
  }


  function getApiUrl() {

    return CONFIG.API_URL;
  }


  window.CourseCopilotLLMClient = {

    ask,

    setApiUrl,

    getApiUrl

  };

})();