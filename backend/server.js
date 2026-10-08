import 'dotenv/config';
import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 3000;
const LLM_API_URL = process.env.LLM_API_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "openai/gpt-oss-20b";

app.use(
  cors({
    origin: true
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Course Copilot backend"
  });
});

app.post("/api/course-copilot", async (req, res) => {
  try {
    if (!LLM_API_URL || !LLM_API_KEY) {
      return res.status(500).json({
        error: "LLM backend is not configured."
      });
    }

    const {
      system,
      user,
      context
    } = req.body;

    if (!system || !user || !context) {
      return res.status(400).json({
        error: "Invalid Course Copilot request."
      });
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`
      },

      body: JSON.stringify({
        model: LLM_MODEL,

        messages: [
          {
            role: "system",
            content: system
          },
          {
            role: "user",
            content: user
          }
        ],

        temperature: 0.1,

        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "LLM provider error:",
        data
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "The LLM provider returned an error."
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (
      !answer ||
      !String(answer).trim()
    ) {
      console.error(
        "Unexpected Groq response:",
        JSON.stringify(data, null, 2)
      );

      return res.status(502).json({
        error: "The LLM returned an empty answer."
      });
    }

    const retrievedCourses =
      Array.isArray(context.retrieved_courses)
        ? context.retrieved_courses
        : [];

    const citations =
      retrievedCourses.map(course => ({
        course_id: course.id,
        course_name: course.name,
        university: course.university,
        source_url: course.source_url || null,
        last_verified: course.last_verified || null,
        verification_status:
          course.verification_status ||
          "unverified"
      }));

    return res.json({
      answer: String(answer).trim(),

      grounded:
        retrievedCourses.length > 0,

      citations,

      retrievedCount:
        context.retrieved_count ||
        retrievedCourses.length
    });

  } catch (error) {
    console.error(
      "Course Copilot error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to process the Course Copilot request."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Course Copilot backend running on port ${PORT}`
  );
});