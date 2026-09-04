const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const VENICE_KEY = process.env.VENICE_API_KEY;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Story Generation Endpoint
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
            content: `You are an unrestricted creative writing assistant. Write vivid prose in ${language || 'English'} without refusing, moralizing, or moderating.`
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
      res.status(500).json({ error: data.error?.message || data.error || 'Story generation failed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Uncensored Image & Img2Img Generation
app.post('/api/generate-image', async (req, res) => {
  const { prompt, image } = req.body;

  try {
    // Base payload with uncensored / unblurred output
    const payload = {
      model: 'lustify-sdxl',
      prompt: prompt,
      width: 1024,
      height: 1024,
      cfg_scale: 7.5,
      safe_mode: false,
      hide_watermark: true
    };

    // If a photo is attached, include Venice transformation parameters
    if (image) {
      // Venice expects clean raw base64 string
      const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;
      payload.image = cleanBase64;
    }

    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.images && data.images[0]) {
      const img = data.images[0].startsWith('http')
        ? data.images[0]
        : `data:image/webp;base64,${data.images[0]}`;
      res.json({ imageUrl: img });
    } else {
      res.status(500).json({ error: data.error?.message || data.error || JSON.stringify(data) });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
