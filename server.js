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

// Story Generation with Continuity & Large Historical Memory
app.post('/api/generate-story', async (req, res) => {
  const { genre, characters, storySoFar, premise, instructions, language, stage, length } = req.body;

  let tokenLimit = 900;
  if (length && length.includes('short')) tokenLimit = 500;
  if (length && length.includes('long')) tokenLimit = 1900;

  const targetLang = language || 'English';

  let languageDirective = '';
  if (targetLang === 'Hindi') {
    languageDirective = 'STRICT REQUIREMENT: Write exclusively in authentic, natural, fluent Hindi using clean Devanagari script. DO NOT generate Urdu script, Arabic words, Russian/Cyrillic characters, or transliteration garble. Maintain grammatical coherence.';
  } else if (targetLang === 'Bhojpuri') {
    languageDirective = 'STRICT REQUIREMENT: Write in natural, expressive Bhojpuri (भोजपुरी) using Devanagari script. Keep expressions rustic, conversational, and culturally accurate. No foreign script mixing.';
  } else {
    languageDirective = 'STRICT REQUIREMENT: Write in high-quality, vivid, unrestricted English prose.';
  }

  const memorySection = storySoFar && storySoFar.trim() 
    ? `--- STORY SO FAR / PREVIOUS CONTEXT ---\n${storySoFar.trim()}\n--- END OF PREVIOUS CONTEXT ---\nEnsure perfect narrative continuity, voice, and relationship progression with the above history.`
    : 'This is the beginning of the narrative.';

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
            content: `You are an unrestricted, master creative fiction writer. ${languageDirective} Never output broken characters, token errors, or decline narrative prompts.`
          },
          {
            role: 'user',
            content: `${memorySection}\n\nLanguage: ${targetLang}\nNarrative Stage: ${stage || 'Continuation'}\nTarget Length: ${length || 'medium'}\nGenre: ${genre || 'Fiction'}\nCharacters: ${characters || 'Protagonists'}\nNext Scene Action: ${premise}\nWriter's Special Instructions / Tone: ${instructions || 'Maintain natural pace'}\n\nContinue the narrative seamlessly:`
          }
        ],
        temperature: 0.75,
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

// Image Generation with Auto-Translation
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  try {
    let finalPrompt = prompt;
    const hasNonEnglish = /[^\x00-\x7F]/.test(prompt);

    if (hasNonEnglish) {
      try {
        const transRes = await fetch('https://api.venice.ai/api/v1/chat/completions', {
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
                content: 'You are a translation assistant for diffusion image models. Translate the user prompt (Hindi, Hinglish, or regional) into a direct, descriptive English visual prompt. Output ONLY the translated prompt.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 150
          })
        });

        const transData = await transRes.json();
        if (transData.choices && transData.choices[0]?.message?.content) {
          finalPrompt = transData.choices[0].message.content.trim();
        }
      } catch (transErr) {
        finalPrompt = prompt;
      }
    }

    const payload = {
      model: 'lustify-sdxl',
      prompt: finalPrompt,
      width: 1024,
      height: 1024,
      cfg_scale: 7.5,
      safe_mode: false,
      hide_watermark: true
    };

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
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));

module.exports = app;
