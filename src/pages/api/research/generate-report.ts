import type { APIRoute } from "astro";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../../../lib/storage";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { filters } = await request.json(); // e.g., { category: 'Real Estate' }

        const allVideos = await storage.list();
        const analyzedVideos = allVideos.filter(v => v.status === 'analyzed' && v.analysis);

        if (analyzedVideos.length === 0) {
            return new Response(JSON.stringify({ error: "No analyzed videos found." }), { status: 404 });
        }

        // Filter locally
        let relevantVideos = analyzedVideos;
        if (filters?.category) {
            relevantVideos = analyzedVideos.filter(v =>
                v.analysis?.issues.some(i => i.category === filters.category)
            );
        }

        const summaries = relevantVideos.map(v => `
            Meeting: ${v.title} (${v.analysis?.meetingDate || 'Unknown Date'})
            Type: ${v.analysis?.meetingType}
            Issues:
            ${v.analysis?.issues.map(i => `- [${i.category}] ${i.title}: ${i.description}`).join('\n')}
        `).join('\n\n');

        const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });

        const prompt = `
        You are an expert policy researcher. Write a comprehensive white paper based on the following summaries of townhall meetings.
        
        Focus on trends, recurring issues, and significant outcomes.
        
        Format the output in Markdown.

        Summaries:
        ${summaries}
        `;

        const result = await model.generateContent(prompt);
        const report = result.response.text();

        return new Response(JSON.stringify({ report }), { status: 200 });

    } catch (error) {
        console.error("Report generation error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};
