const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Suno Downloader Backend is Running!");
});

// Endpoint 1: Extract Track Info
app.get('/api/download', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://suno.com/'
        };

        const response = await fetch(url, { headers, redirect: 'follow' });
        const htmlText = await response.text();

        let audioUrl = null;
        let title = null;

        // Extract Next.js embedded JSON metadata
        const jsonMatch = htmlText.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const pageData = JSON.parse(jsonMatch[1]);
                const props = pageData?.props?.pageProps;
                const clip = props?.clip || (props?.clips && props?.clips[0]);
                if (clip) {
                    audioUrl = clip.audio_url;
                    title = clip.title || 'Suno_Track';
                }
            } catch (e) {}
        }

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
            return res.status(404).json({ error: 'Could not extract audio link.' });
        }

    } catch (err) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Endpoint 2: Proxy Stream Endpoint to prevent 0-second downloads
app.get('/api/stream', async (req, res) => {
    try {
        const { audio_url, title } = req.query;
        if (!audio_url) return res.status(400).send('Audio URL missing');

        const audioRes = await fetch(audio_url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!audioRes.ok) return res.status(500).send('Failed to fetch audio stream');

        const cleanTitle = (title || 'Suno_Track').replace(/[^a-zA-Z0-9_-]/g, '_');

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.mp3"`);

        // Stream complete MP3 binary directly to user browser
        audioRes.body.pipe(res);

    } catch (err) {
        res.status(500).send('Stream Proxy Error: ' + err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
