import type { APIRoute } from "astro";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../../../lib/storage";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { filters } = await request.json(); // e.g., { category: 'Real Estate' }

        const allVideos = await storage.list();
        console.log(`Found ${allVideos.length} total videos.`);

        const analyzedVideos = allVideos.filter(v => v.status === 'analyzed' && v.analysis);
        console.log(`Found ${analyzedVideos.length} analyzed videos.`);

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
        console.log(`Found ${relevantVideos.length} relevant videos after filtering.`);

        // Sort by Location (State > City) then Date
        relevantVideos.sort((a, b) => {
            const locA = `${a.analysis?.location?.state || ''}${a.analysis?.location?.city || ''}`;
            const locB = `${b.analysis?.location?.state || ''}${b.analysis?.location?.city || ''}`;
            if (locA !== locB) return locA.localeCompare(locB);
            return (b.analysis?.meetingDate || '').localeCompare(a.analysis?.meetingDate || '');
        });

        const summaries = relevantVideos.map(v => {
            const loc = v.analysis?.location;
            const locationStr = loc ? `${loc.city || ''}, ${loc.state || ''}` : 'Unknown Location';

            // Filter issues if category filter is present
            let issues = v.analysis?.issues || [];
            if (filters?.category) {
                issues = issues.filter(i => i.category === filters.category);
            }

            return `
            Meeting: ${v.title}
            Date: ${v.analysis?.meetingDate || 'Unknown Date'}
            Location: ${locationStr}
            Type: ${v.analysis?.meetingType}
            Issues:
            ${issues.map(i => `- [${i.category}] ${i.title}: ${i.description}`).join('\n')}
            `;
        }).join('\n\n');

        console.log(`Summaries length: ${summaries.length}`);

        const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });

        const prompt = `
        You are a strategic analyst creating a high-impact "Executive Dashboard" from these meeting summaries.
        ${filters?.category ? `**FOCUS**: The user is specifically interested in **${filters.category}** issues. Only include analysis related to this category.` : ''}
        
        **Goal**: Provide a highly visual, easy-to-scan summary of what is happening in local government.
        
        **CRITICAL INSTRUCTION**: You must analyze ALL provided meeting summaries. Do not skip any location or meeting.
        
        **Format Requirements**:
        
        # 🚨 Critical Alerts
        *   List the top 3-5 most urgent or high-impact issues across ALL meetings.
        *   Use bolding for the **Issue Title**.
        *   Briefly explain *why* it is critical.

        # 📍 Location Breakdown
        *   Group the analysis by **City/State**.
        *   For each location, create a subsection (e.g., "## Tupelo, MS").
        *   List the meetings analyzed for that location.
        *   **Issues Table**: Create a Markdown table for that location with columns:
            *   **Category** (Real Estate, Business, etc.)
            *   **Issue** (Brief Title)
            *   **Impact** (High/Med/Low)
            *   **Details** (1 sentence summary)
        *   *Ensure EVERY significant issue from the transcripts is included in these tables.*

        # 📊 Trend Analysis
        *   Identify 2-3 recurring themes or patterns appearing across multiple locations (if any).

        # ℹ️ Data Coverage
        *   State the total number of meetings analyzed in this report.
        *   List the unique locations covered.

        **Input Summaries**:
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
