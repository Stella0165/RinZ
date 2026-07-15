import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  analyzeResumeSkills,
  generateRoadmap,
  evaluateProject,
  scoreInterviewAnswer,
  generateNextWeekPlan,
  getInterviewQuestions,
} from "./ai.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function route(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Something went wrong." });
    }
  };
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post(
  "/api/analyze-skills",
  route(async (req) => {
    const { resume, careerLabel } = req.body;
    if (!careerLabel) throw new Error("careerLabel is required");
    return analyzeResumeSkills(resume, careerLabel);
  })
);

app.post(
  "/api/build-roadmap",
  route(async (req) => {
    const { skills, careerLabel } = req.body;
    if (!Array.isArray(skills)) throw new Error("skills array is required");
    return generateRoadmap(skills, careerLabel);
  })
);

app.post(
  "/api/evaluate-project",
  route(async (req) => {
    const { waypointTitle, skill, submission } = req.body;
    if (!waypointTitle || !skill) throw new Error("waypointTitle and skill are required");
    return evaluateProject(waypointTitle, skill, submission);
  })
);

app.get("/api/interview-questions", (req, res) => {
  const { careerLabel } = req.query;
  res.json({ questions: getInterviewQuestions(careerLabel) });
});

app.post(
  "/api/score-answer",
  route(async (req) => {
    const { question, category, answer, careerLabel } = req.body;
    if (!question) throw new Error("question is required");
    return scoreInterviewAnswer(question, category, answer, careerLabel);
  })
);

app.post(
  "/api/next-week-plan",
  route(async (req) => {
    return generateNextWeekPlan(req.body);
  })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Waypoint backend running on http://localhost:${PORT}`);
});