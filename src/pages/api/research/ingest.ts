import type { APIRoute } from "astro";
import { Innertube } from "youtubei.js";
import { storage, type VideoAnalysis } from "../../../lib/storage";

export const POST: APIRoute = async ({ request }) => {
    try {
        const { urls } = await request.json();

        if (!urls || !Array.isArray(urls)) {
            return new Response(JSON.stringify({ error: "Invalid input: 'urls' must be an array" }), {
                status: 400,
            });
        }

        const results = [];
        const youtube = await Innertube.create({
            lang: 'en',
            location: 'US',
            retrieve_player: false
        });

        for (const url of urls) {
            const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
            const videoId = videoIdMatch ? videoIdMatch[1] : null;

            if (!videoId) {
                results.push({ url, status: 'error', error: 'Invalid URL' });
                continue;
            }

            // Check cache
            const existing = await storage.get(videoId);
            if (existing && existing.status === 'analyzed') {
                results.push({ ...existing, cached: true });
                continue;
            }

            try {
                const info = await youtube.getInfo(videoId);
                const transcriptData = await info.getTranscript();
                let transcriptText = "";

                if (transcriptData?.transcript?.content?.body?.initial_segments) {
                    const segments = transcriptData.transcript.content.body.initial_segments;
                    transcriptText = segments.map((s) => s.snippet.text).join(" ");
                }

                const data: VideoAnalysis = {
                    videoId,
                    url,
                    title: info.basic_info.title,
                    transcript: transcriptText,
                    status: transcriptText ? 'fetched' : 'error',
                    error: transcriptText ? undefined : 'No transcript found',
                    updatedAt: new Date().toISOString()
                };

                await storage.set(videoId, data);
                results.push(data);

            } catch (e) {
                console.error(`Error processing ${videoId}:`, e);
                const errorData: VideoAnalysis = {
                    videoId,
                    url,
                    status: 'error',
                    error: e instanceof Error ? e.message : 'Unknown error',
                    updatedAt: new Date().toISOString()
                };
                await storage.set(videoId, errorData);
                results.push(errorData);
            }
        }

        return new Response(JSON.stringify({ results }), { status: 200 });

    } catch (error) {
        console.error("Ingest error:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};
