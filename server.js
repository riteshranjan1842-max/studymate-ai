const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['https://studymates-aii.netlify.app', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3001'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Multer for PDF uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'meta-llama/llama-3.1-8b-instruct';

// ── Health check ──
app.get('/', (req, res) => res.json({ status: '✅ StudyMate AI backend running!' }));

// ── PDF Upload & Text Extraction ──
app.post('/api/extract-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const data = await pdfParse(req.file.buffer);
    const text = data.text.trim();
    if (!text) return res.status(400).json({ error: 'Could not extract text from PDF. Try a text-based PDF.' });
    res.json({ text, pages: data.numpages });
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'Failed to read PDF: ' + err.message });
  }
});

// ── Main AI endpoint ──
app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, systemMsg, history } = req.body;
    if (!prompt && !history) return res.status(400).json({ error: 'prompt or history is required' });

    let messages = [];
    if (history && Array.isArray(history)) {
      messages = [
        { role: 'system', content: 'You are StudyMate AI, a helpful study assistant. Answer any question the student asks clearly and educationally.' },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      ];
    } else {
      const sys = systemMsg || 'You are StudyMate AI, an expert educational assistant. Respond clearly and helpfully for students.';
      messages = [
        { role: 'system', content: sys },
        { role: 'user', content: prompt }
      ];
    }

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://studymates-aii.netlify.app',
        'X-Title': 'StudyMate AI'
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 1500, temperature: 0.7 })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response from AI' });
    res.json({ result: text });

  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── Keep alive ──
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
setInterval(async () => {
  try { await fetch(SELF_URL); console.log('✅ Keep-alive ping'); }
  catch(e) { console.log('Keep-alive failed:', e.message); }
}, 14 * 60 * 1000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ StudyMate backend running on http://localhost:${PORT}`));