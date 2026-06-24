const createImageService = ({
  HttpsError,
  SlideObjects,
  compactText,
  logger,
}) => {
  const searchUnsplashImages = async ({ query, count = 6, orientation = 'landscape', page = 1, requireKey = true }) => {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashKey) {
      if (requireKey) throw new HttpsError('internal', 'Unsplash key not configured');
      return { images: [], refinedQuery: String(query || '').trim() };
    }

    let searchQuery = String(query).trim();
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Convert this into 3 short stock-photo search keywords. Return ONLY the keywords as a comma-separated list, nothing else.\n\n"${compactText(query, 200)}"`,
                }],
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 30 },
            }),
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          const kw = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (kw) searchQuery = kw;
        }
      } catch (err) {
        logger.warn('searchImages Gemini refinement skipped', { message: err.message });
      }
    }

    const perPage = Math.max(1, Math.min(parseInt(count, 10) || 6, 30));
    const imageOrientation = ['landscape', 'portrait', 'squarish'].includes(orientation)
      ? orientation
      : 'landscape';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);

    let rawPhotos;
    if (pageNum > 1) {
      const params = new URLSearchParams({
        query: searchQuery,
        orientation: imageOrientation,
        count: String(perPage),
        client_id: unsplashKey,
      });
      const uRes = await fetch(`https://api.unsplash.com/photos/random?${params.toString()}`);
      if (!uRes.ok) throw new HttpsError('internal', `Unsplash error: ${uRes.status}`);
      const uData = await uRes.json();
      rawPhotos = Array.isArray(uData) ? uData : [];
    } else {
      const params = new URLSearchParams({
        query: searchQuery,
        orientation: imageOrientation,
        per_page: String(perPage),
        page: '1',
        client_id: unsplashKey,
      });
      const uRes = await fetch(`https://api.unsplash.com/search/photos?${params.toString()}`);
      if (!uRes.ok) throw new HttpsError('internal', `Unsplash error: ${uRes.status}`);
      const uData = await uRes.json();
      rawPhotos = uData.results || [];
    }

    const images = rawPhotos.map((p, i) => ({
      id: p.id || i,
      src: p.urls?.full || p.urls?.regular || p.urls?.small || '',
      thumb: p.urls?.small || p.urls?.thumb || p.urls?.regular || '',
      alt: p.alt_description || p.description || searchQuery,
      credit: p.user?.name || '',
      creditUrl: p.user?.links?.html || '',
    })).filter((image) => image.src && image.thumb);

    return { images, refinedQuery: searchQuery };
  };

  const hydrateGeneratedSlideImages = async (slides = []) => {
    const hydrated = [];
    for (const slide of slides) {
      let next = SlideObjects.ensureSlideObjects(slide, hydrated.length, slides.length);
      if (SlideObjects.shouldHaveImage(next)) {
        const imageObjects = (next.objects || []).filter((obj) => obj.type === 'image');
        const hasImage = imageObjects.some((obj) => obj.src);
        if (!hasImage) {
          const prompt = next.imagePrompt || imageObjects[0]?.prompt || next.title || '';
          if (prompt) {
            try {
              const { images } = await searchUnsplashImages({ query: prompt, count: 1, orientation: 'landscape', page: 1, requireKey: false });
              const image = images[0];
              if (image) {
                next = {
                  ...next,
                  image: {
                    src: image.src,
                    alt: image.alt,
                    credit: image.credit,
                    creditUrl: image.creditUrl,
                    prompt,
                  },
                  objects: next.objects.map((obj) => obj.type === 'image'
                    ? { ...obj, src: image.src, alt: image.alt, credit: image.credit, creditUrl: image.creditUrl, prompt: obj.prompt || prompt }
                    : obj),
                };
              }
            } catch (err) {
              logger.warn('generateDeck image hydration skipped', { message: err.message, title: next.title });
            }
          }
        }
      }
      hydrated.push(SlideObjects.ensureSlideObjects(next, hydrated.length, slides.length));
    }
    return hydrated;
  };

  const geminiGenerateImage = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { prompt } = request.data;
    if (!prompt || !String(prompt).trim()) throw new HttpsError('invalid-argument', 'Prompt is required');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new HttpsError('internal', 'Gemini API key not configured. Set it with: firebase functions:secrets:set GEMINI_API_KEY');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: compactText(prompt, 500) }],
          parameters: { sampleCount: 4, aspectRatio: '16:9' },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new HttpsError('internal', 'Imagen API error: ' + errText.slice(0, 300));
    }

    const body = await response.json();
    const images = (body.predictions || [])
      .map((p) => p.bytesBase64Encoded)
      .filter(Boolean)
      .map((b64) => `data:image/png;base64,${b64}`);

    if (!images.length) throw new HttpsError('internal', 'No images were generated — try a different prompt');

    return { images };
  };

  const searchImages = async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

    const { query, count = 6, orientation = 'landscape', page = 1 } = request.data || {};
    if (!query || !String(query).trim()) throw new HttpsError('invalid-argument', 'query is required');

    return searchUnsplashImages({ query, count, orientation, page, requireKey: true });
  };

  return {
    geminiGenerateImage,
    hydrateGeneratedSlideImages,
    searchImages,
    searchUnsplashImages,
  };
};

module.exports = {
  createImageService,
};
