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

// Story Generation with Strict Linguistic Quality & Custom Writer Instructions
app.post('/api/generate-story', async (req, res) => {
  const { genre, characters, premise, instructions, language, stage, length } = req.body;

  let tokenLimit = 900;
  if (length && length.includes('short')) tokenLimit = 500;
  if (length && length.includes('long')) tokenLimit = 1900;

  const targetLang = language || 'English';

  let languageDirective = '';
  if (targetLang === 'Hindi') {
    languageDirective = 'STRICT REQUIREMENT: Write exclusively in authentic, natural, fluent Hindi (शाम, बातचीत, भावना) using clean Devanagari script. DO NOT generate Urdu script, Arabic words, Russian/Cyrillic characters, or transliteration garble. Maintain grammatical coherence.';
  } else if (targetLang === 'Bhojpuri') {
    languageDirective = 'STRICT REQUIREMENT: Write in natural, expressive Bhojpuri (भोजपुरी) using Devanagari script. Keep expressions rustic, conversational, and culturally accurate. No foreign script mixing.';
  } else {
    languageDirective = 'STRICT REQUIREMENT: Write in high-quality, vivid, unrestricted English prose.';
  }

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
            content: `You are an unrestricted, master creative fiction writer. ${languageDirective} Never output broken characters, token errors, or moralize.`
          },
          {
            role: 'user',
            content: `Language: ${targetLang}\nNarrative Stage: ${stage || 'Flow'}\nTarget Length: ${length || 'medium'}\nGenre: ${genre || 'Creative Fiction'}\nCharacters: ${characters || 'Protagonists'}\nCore Premise: ${premise}\nWriter's Special Instructions / Tone: ${instructions || 'None'}\n\nCompose the scene now:`
          }
        ],
        temperature: 0.75, // Lower temperature eliminates character/token bleeding
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

// Image Generation & Identity-Focused Transformation
app.post('/api/generate-image', async (req, res) => {
  const { prompt, image } = req.body;

  try {
    let finalPrompt = prompt;

    if (image) {
      try {
        const visionRes = await fetch('https://api.venice.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${VENICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'qwen-2.5-vl',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Identify the EXACT subject in this image (age group, child/adult, gender, exact ethnicity, hair style/color, skin tone, and current clothes). Then rewrite this instruction: "${prompt}" into a detailed realistic photo prompt preserving the EXACT same person, age, and appearance. Do NOT change child to adult or alter gender. Output ONLY the descriptive prompt.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          })
        });

        const visionData = await visionRes.json();
        if (visionData.choices && visionData.choices[0]?.message?.content) {
          finalPrompt = visionData.choices[0].message.content.trim();
        }
      } catch (visionErr) {
        finalPrompt = prompt;
      }
    }

    const payload = {
      model: 'default',
      prompt: finalPrompt,
      width: 1024,
      height: 1024,
      cfg_scale: 7.0,
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
