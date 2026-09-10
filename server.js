const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Suno Downloader Backend is Running!");
});

app.get('/api/download', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Step 1: Real Browser User-Agent to bypass Cloudflare
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://suno.com/'
        };

        // Step 2: Fetch Public Page HTML
        const response = await fetch(url, { headers, redirect: 'follow' });
        const htmlText = await response.text();

        // Step 3: Extract Next.js embedded JSON metadata
        const jsonMatch = htmlText.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        
        let audioUrl = null;
        let title = null;

        if (jsonMatch && jsonMatch[1]) {
            try {
                const pageData = JSON.parse(jsonMatch[1]);
                const props = pageData?.props?.pageProps;
                const clip = props?.clip || (props?.clips && props?.clips[0]);

                if (clip) {
                    audioUrl = clip.audio_url;
                    title = clip.title || 'Suno_Track';
                }
            } catch (e) {
                // Ignore JSON parse error
            }
        }

        // Fallback: Regex extraction for MP3 link if JSON path moved
        if (!audioUrl) {
            const mp3Match = htmlText.match(/https:\/\/[^\s"<]+\.mp3[^\s"<]*/i);
            if (mp3Match) {
                audioUrl = mp3Match[0];
                title = 'Suno_Track';
            }
        }

        // Fallback: UUID extraction to direct CDN URL
        if (!audioUrl) {
            const uuidMatch = response.url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i) ||
                              url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
            if (uuidMatch) {
                audioUrl = `https://cdn1.suno.ai/${uuidMatch[1]}.mp3`;
                title = `Suno_Track_${uuidMatch[1].substring(0, 8)}`;
            }
        }

        if (audioUrl) {
            return res.json({ title, audio_url: audioUrl });
        } else {
            return res.status(404).json({ error: 'Song details or audio link could not be extracted from page.' });
        }

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
