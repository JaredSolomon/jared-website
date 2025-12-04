import type { APIRoute } from "astro";
import { Innertube } from "youtubei.js";
import { storage, type VideoAnalysis } from "../../../lib/storage";
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.resolve('./server.log');

function log(message: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { urls } = await request.json();
        log(`Ingest request received for ${urls?.length} URLs.`);

        if (!urls || !Array.isArray(urls)) {
            return new Response(JSON.stringify({ error: "Invalid input: 'urls' must be an array" }), {
                status: 400,
            });
        }

        const results = [];
        log("Initializing Innertube...");
        const youtube = await Innertube.create({
            lang: 'en',
            location: 'US',
            retrieve_player: false
        });
        log("Innertube initialized.");

        for (const url of urls) {
            log(`Processing URL: ${url}`);
            const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
            const videoId = videoIdMatch ? videoIdMatch[1] : null;

            if (!videoId) {
                log(`Invalid URL: ${url}`);
                results.push({ url, status: 'error', error: 'Invalid URL' });
                continue;
            }

            // Check cache
            const existing = await storage.get(videoId);
            if (existing && existing.status === 'analyzed') {
                log(`Cache hit for ${videoId}`);
                results.push({ ...existing, cached: true });
                continue;
            }

            try {
                log(`Fetching info for ${videoId}...`);
                const info = await youtube.getInfo(videoId);
                log(`Fetching transcript for ${videoId}...`);
                const transcriptData = await info.getTranscript();
                let transcriptText = "";

                if (transcriptData?.transcript?.content?.body?.initial_segments) {
                    const segments = transcriptData.transcript.content.body.initial_segments;
                    transcriptText = segments.map((s) => s.snippet.text).join(" ");
                    log(`Transcript fetched for ${videoId}. Length: ${transcriptText.length}`);
                } else {
                    log(`No transcript segments found for ${videoId}.`);
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
                log(`Error processing ${videoId}: ${e}`);
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

        log("Ingestion complete. Returning results.");
        return new Response(JSON.stringify({ results }), { status: 200 });

    } catch (error) {
        log(`Ingest error: ${error}`);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
};
