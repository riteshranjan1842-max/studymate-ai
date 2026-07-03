const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'meta-llama/llama-3.1-8b-instruct'; // 100% free model on OpenRouter

// ── Health check ──
app.get('/', (req, res) => res.json({ status: '✅ StudyMate AI backend running!' }));

// ── Main AI endpoint ──
app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, systemMsg, history } = req.body;

    if (!prompt && !history) {
      return res.status(400).json({ error: 'prompt or history is required' });
    }

    let messages = [];

    if (history && Array.isArray(history)) {
      // Chat mode — include system message + full history
      messages = [
        { role: 'system', content: 'You are StudyMate AI, a helpful study assistant. Answer any question the student asks clearly and educationally — CS, science, history, or any topic. If they share study text, help them understand it deeply.' },
        ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      ];
    } else {
      // Single prompt mode (summary, notes, mcq, flashcards)
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
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'StudyMate AI'
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response from AI' });

    res.json({ result: text });

  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ StudyMate backend running on http://localhost:${PORT}`));