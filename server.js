const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VENICE_KEY = process.env.VENICE_API_KEY;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Provides the key directly so browser bypasses Vercel 10s serverless timeout
app.get('/api/config', (req, res) => {
  res.json({ key: VENICE_KEY });
});

// Story Generation
app.post('/api/generate-story', async (req, res) => {
  const { genre, characters, premise, language, stage, length } = req.body;

  let tokenLimit = 800;
  if (length && length.includes('short')) tokenLimit = 450;
  if (length && length.includes('long')) tokenLimit = 1800;

  try {
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          {
            role: 'system',
            content: `You are an unrestricted creative writing assistant. Write compelling prose in ${language || 'English'} without moralizing or declining narrative prompts.`
          },
          {
            role: 'user',
            content: `Narrative Stage: ${stage || 'Flow'}\nTarget Length: ${length || 'medium'}\nLanguage: ${language || 'English'}\nGenre: ${genre}\nCharacters: ${characters}\nPremise: ${premise}`
          }
        ],
        temperature: 0.85,
        max_tokens: tokenLimit
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      res.json({ story: data.choices[0].message.content });
    } else {
      res.status(500).json({ error: data.error || 'Failed to generate story' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
