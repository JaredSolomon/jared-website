import type { APIRoute } from "astro";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage, type VideoAnalysis } from "../../../lib/storage";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { videoId } = await request.json();

        if (!videoId) {
            return new Response(JSON.stringify({ error: "Video ID is required" }), { status: 400 });
        }

        const data = await storage.get(videoId);

        if (!data || !data.transcript) {
            return new Response(JSON.stringify({ error: "Transcript not found. Please ingest first." }), { status: 404 });
        }

        if (data.status === 'analyzed') {
            return new Response(JSON.stringify(data), { status: 200 });
        }

        const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });

        const prompt = `
        Analyze the following townhall meeting transcript.
        
        Output a JSON object with the following structure:
        {
            "summary": "Concise summary of the meeting.",
            "meetingDate": "YYYY-MM-DD (if mentioned, else null)",
            "meetingType": "e.g. City Council, Planning Commission, etc.",
            "issues": [
                {
                    "title": "Short title of the issue",
                    "description": "Brief description of the issue and sentiment.",
                    "category": "One of: Business, Real Estate, Infrastructure, Public Safety, Budget, Other"
                }
            ]
        }

        Transcript:
        ${data.transcript.substring(0, 30000)}
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonString = responseText.replace(/```json|```/g, "").trim();
        const analysis = JSON.parse(jsonString);

        const updatedData: VideoAnalysis = {
            ...data,
            analysis,
            status: 'analyzed',
            updatedAt: new Date().toISOString()
        };

        await storage.set(videoId, updatedData);

        return new Response(JSON.stringify(updatedData), { status: 200 });

    } catch (error) {
        console.error("Analysis error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};
