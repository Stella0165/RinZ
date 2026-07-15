import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const CAREER_SKILLS = {
  "data scientist": ["python", "sql", "statistics", "machine learning", "data visualization", "communication"],
  "product manager": ["roadmapping", "stakeholder management", "user research", "data analysis", "prioritization", "communication"],
  "software engineer": ["data structures", "algorithms", "system design", "git", "testing", "debugging"],
  "ux designer": ["user research", "wireframing", "prototyping", "figma", "usability testing", "visual design"],
  default: ["communication", "problem solving", "project management", "critical thinking", "collaboration"],
};

const INTERVIEW_QUESTIONS = {
  "data scientist": [
    { cat: "Technical", q: "Walk me through how you'd handle a dataset with a lot of missing values." },
    { cat: "Technical", q: "Explain the difference between supervised and unsupervised learning." },
    { cat: "Behavioral", q: "Tell me about a time you had to explain a technical result to a non-technical stakeholder." },
  ],
  "product manager": [
    { cat: "Case", q: "How would you prioritize a backlog with three competing high-value features?" },
    { cat: "Behavioral", q: "Describe a time you had to say no to a stakeholder. How did you handle it?" },
    { cat: "Strategy", q: "How do you decide when a feature is ready to ship?" },
  ],
  "software engineer": [
    { cat: "Technical", q: "How would you design a rate limiter for a public API?" },
    { cat: "Behavioral", q: "Tell me about a bug that was especially hard to track down." },
    { cat: "Technical", q: "What's your approach to writing tests for a new feature?" },
  ],
  "ux designer": [
    { cat: "Process", q: "Walk me through your process from research to a shipped design." },
    { cat: "Behavioral", q: "Tell me about a time user research changed your design direction." },
    { cat: "Critique", q: "How do you handle disagreement with engineering on feasibility?" },
  ],
  default: [
    { cat: "Behavioral", q: "Tell me about a project you're proud of and why." },
    { cat: "Behavioral", q: "Describe a time you had to learn something quickly to get a job done." },
    { cat: "Motivation", q: "Why are you moving toward this role now?" },
  ],
};

function normalizeCareer(input) {
  const key = (input || "").trim().toLowerCase();
  return CAREER_SKILLS[key] ? key : "default";
}

function parseJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function callGemini(systemInstruction, userMessage) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userMessage,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });
  return response.text;
}

export async function analyzeResumeSkills(resumeText, careerInput) {
  const careerKey = normalizeCareer(careerInput);
  const required = CAREER_SKILLS[careerKey];

  const system = `You are a technical recruiter assessing a resume against a fixed skill list for a target role.
For each skill in the list, judge the candidate's real, demonstrated proficiency based ONLY on the resume text.
Return a JSON array of objects:
[{ "skill": string, "level": number (0-100), "have": boolean, "evidence": string (max 15 words, quote nothing, just summarize) }]
"have" should be true only if level >= 55. Be honest — do not inflate scores for skills only vaguely implied.`;

  const userMessage = `Target role: ${careerInput || careerKey}
Required skills: ${required.join(", ")}

Resume:
"""
${resumeText || "(empty resume)"}
"""`;

  const raw = await callGemini(system, userMessage);
  const parsed = parseJSON(raw);
  return { careerKey, skills: parsed };
}

export async function generateRoadmap(skills, careerInput) {
  const gaps = skills.filter((s) => !s.have).map((s) => s.skill);
  const solid = skills.filter((s) => s.have).map((s) => s.skill);

  const system = `You are a career coach building a learning roadmap. Given skill gaps (and any skills already solid),
produce an ORDERED list of 4-6 waypoints prioritizing skills that unlock the most other skills or have the
highest hiring impact first. Always end with an "interview" waypoint and a "capstone" waypoint.
Return a JSON array:
[{ "type": "skill" | "interview" | "capstone", "skill": string | null, "title": string (short, action-oriented), "why": string (max 20 words, reasoning for this priority) }]`;

  const userMessage = `Target role: ${careerInput}
Skill gaps to close: ${gaps.join(", ") || "none — candidate is strong, focus on depth"}
Skills already solid: ${solid.join(", ") || "none"}`;

  const raw = await callGemini(system, userMessage);
  const parsed = parseJSON(raw);
  return parsed.map((n, i) => ({ ...n, id: i, status: i === 0 ? "current" : "locked" }));
}

export async function evaluateProject(waypointTitle, skill, submissionText) {
  const system = `You are a strict but fair technical reviewer grading a learner's project submission against a
target skill for a career roadmap. The submission may be a code snippet, a description of what they built, or a link
description. Judge realistically — do not pass weak or vague submissions.
Return JSON:
{ "pass": boolean, "score": number (0-100), "feedback": string (2-3 sentences, specific and actionable), "levelGain": number (0-35, how much this should raise their skill level meter, 0 if it fails) }`;

  const userMessage = `Waypoint: ${waypointTitle}
Target skill: ${skill}

Learner's submission:
"""
${submissionText || "(nothing submitted)"}
"""`;

  const raw = await callGemini(system, userMessage);
  return parseJSON(raw);
}

export async function scoreInterviewAnswer(question, category, answer, careerInput) {
  const system = `You are an experienced interviewer for the role of ${careerInput}. Score the candidate's answer
to an interview question the way a real panel would: reward concrete examples, measurable results, and structure
(e.g. STAR format for behavioral questions). Penalize vague, generic, or overly short answers.
Return JSON:
{ "score": number (0-10, one decimal allowed), "note": string (2-3 sentences of direct, specific feedback) }`;

  const userMessage = `Question category: ${category}
Question: ${question}

Candidate's answer:
"""
${answer || "(no answer given)"}
"""`;

  const raw = await callGemini(system, userMessage);
  return parseJSON(raw);
}

export async function generateNextWeekPlan(state) {
  const system = `You are a career coach writing a short weekly plan for a learner based on their current progress.
Be specific and motivating but realistic about what's achievable in one week.
Return JSON:
{ "summary": string (2 sentences on where they stand), "focus": string[] (1-3 skill/topic names to prioritize this week), "tasks": string[] (3-5 concrete, doable tasks for the week) }`;

  const userMessage = `Target role: ${state.careerLabel}
Skill levels: ${JSON.stringify(state.skills)}
Roadmap status: ${JSON.stringify(state.roadmap?.map((n) => ({ title: n.title, status: n.status })))}
Recent interview scores: ${JSON.stringify(Object.values(state.interviewAnswers || {}).map((a) => a.score))}`;

  const raw = await callGemini(system, userMessage);
  return parseJSON(raw);
}

export function getInterviewQuestions(careerInput) {
  const careerKey = normalizeCareer(careerInput);
  return INTERVIEW_QUESTIONS[careerKey];
}

export { CAREER_SKILLS, INTERVIEW_QUESTIONS, normalizeCareer };