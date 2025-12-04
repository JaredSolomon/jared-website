import fs from 'node:fs/promises';
import path from 'node:path';
import { getStore } from '@netlify/blobs';

const IS_NETLIFY = !!process.env.NETLIFY || !!process.env.NETLIFY_DEV;
const DATA_DIR = path.join(process.cwd(), '.data');

export interface VideoAnalysis {
    videoId: string;
    url: string;
    title?: string;
    transcript?: string;
    analysis?: {
        summary: string;
        issues: Array<{
            title: string;
            description: string;
            category?: string;
        }>;
        meetingDate?: string;
        meetingType?: string;
        location?: {
            city?: string;
            county?: string;
            state?: string;
        };
    };
    status: 'queued' | 'fetched' | 'analyzed' | 'error';
    error?: string;
    updatedAt: string;
}

export const storage = {
    async get(key: string): Promise<VideoAnalysis | null> {
        if (IS_NETLIFY) {
            const store = getStore('video-analysis');
            const data = await store.get(key);
            return data ? JSON.parse(data) : null;
        } else {
            try {
                const filePath = path.join(DATA_DIR, `${key}.json`);
                const data = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(data as string);
            } catch (e) {
                return null;
            }
        }
    },

    async set(key: string, data: VideoAnalysis): Promise<void> {
        if (IS_NETLIFY) {
            const store = getStore('video-analysis');
            await store.set(key, JSON.stringify(data));
        } else {
            await fs.mkdir(DATA_DIR, { recursive: true });
            const filePath = path.join(DATA_DIR, `${key}.json`);
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        }
    },

    async list(): Promise<VideoAnalysis[]> {
        if (IS_NETLIFY) {
            const store = getStore('video-analysis');
            const { blobs } = await store.list();
            const results = await Promise.all(blobs.map(b => this.get(b.key)));
            return results.filter((r): r is VideoAnalysis => r !== null);
        } else {
            try {
                await fs.mkdir(DATA_DIR, { recursive: true });
                const files = await fs.readdir(DATA_DIR);
                const results = await Promise.all(
                    files.filter(f => f.endsWith('.json')).map(f => this.get(f.replace('.json', '')))
                );
                return results.filter((r): r is VideoAnalysis => r !== null);
            } catch (e) {
                return [];
            }
        }
    }
};
