import type { APIRoute } from "astro";
import { Innertube } from "youtubei.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { url } = await request.json();

        if (!url) {
            return new Response(JSON.stringify({ error: "URL is required" }), {
                status: 400,
            });
        }

        // 1. Extract Video ID
        const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        if (!videoId) {
            return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
                status: 400,
            });
        }

        // 2. Fetch Transcript
        let transcriptText = "";
        try {
            const youtube = await Innertube.create({
                lang: 'en',
                location: 'US',
                retrieve_player: false
            });
            const info = await youtube.getInfo(videoId);
            const transcriptData = await info.getTranscript();

            if (transcriptData?.transcript?.content?.body?.initial_segments) {
                const segments = transcriptData.transcript.content.body.initial_segments;
                transcriptText = segments.map((s) => s.snippet.text).join(" ");
            } else {
                throw new Error("No transcript data found");
            }
        } catch (error) {
            console.error("Transcript fetch error:", error);
            return new Response(
                JSON.stringify({
                    error: "No captions found for this video.",
                    code: "NO_CAPTIONS"
                }),
                { status: 422 }
            );
        }

        // 3. Analyze with Gemini
        const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    error: "Server configuration error: Missing GEMINI_API_KEY.",
                }),
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });

        const prompt = `
        You are an expert policy analyst. Analyze the following townhall meeting transcript.
        
        Output a JSON object with the following structure:
        {
            "summary": "A concise executive summary of the meeting (HTML format allowed, e.g. <p>, <strong>).",
            "issues": [
                {
                    "title": "Short title of the issue",
                    "description": "Brief description of the issue and the sentiment/outcome."
                }
            ]
        }

        Transcript:
        ${transcriptText.substring(0, 30000)} 
        `;
        // Note: Truncating to ~30k chars to be safe, though 1.5 Flash has a large context window.

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean up markdown code blocks if present
        const jsonString = responseText.replace(/```json|```/g, "").trim();
        const data = JSON.parse(jsonString);

        return new Response(
            JSON.stringify(data),
            { status: 200 }
        );

    } catch (error) {
        console.error("Analysis error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error", stack: error instanceof Error ? error.stack : undefined }),
            { status: 500 }
        );
    }
};
