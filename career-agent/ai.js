import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

export async function analyzeResume(resume, career){

    const prompt = `
    
You are an AI Career Mentor.

Target Career:
${career}

Resume:
${resume}

Return ONLY JSON.

{
    "skills":[
        {
            "skill":"Python",
            "level":80,
            "have":true
        }
    ]
}
`;

    const result = await model.generateContent(prompt);

    return JSON.parse(result.response.text());
}