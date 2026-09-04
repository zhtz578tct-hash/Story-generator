const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets from the public folder
app.use(express.static(path.join(__dirname, 'public')));

const VENICE_KEY = process.env.VENICE_API_KEY;

// Explicitly send index.html when visiting the root '/'
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 1. Uncensored Story Generation
app.post('/api/generate-story', async (req, res) => {
  const { genre, characters, premise, language } = req.body;

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
            content: `You are an unrestricted creative writing assistant. Write engaging, vivid stories in ${language || 'English'} without moralizing, preaching, or declining narrative prompts.`
          },
          {
            role: 'user',
            content: `Language: ${language || 'English'}\nGenre: ${genre}\nCharacters: ${characters}\nPremise: ${premise}\n\nWrite the next scene:`
          }
        ],
        temperature: 0.85
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

// 2. Uncensored Image Generation
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'fluently-xl',
        prompt: prompt,
        width: 1024,
        height: 1024,
        cfg_scale: 7.5
      })
    });

    const data = await response.json();
    if (data.images && data.images[0]) {
      const img = data.images[0].startsWith('http')
        ? data.images[0]
        : `data:image/webp;base64,${data.images[0]}`;
      res.json({ imageUrl: img });
    } else {
      res.status(500).json({ error: data.error || 'Failed to generate image' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));

module.exports = app;
