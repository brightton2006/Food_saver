const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

async function searchUnsplash(query) {
  if (!query) return null;
  const encodedQuery = encodeURIComponent(query);

  if (UNSPLASH_ACCESS_KEY) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodedQuery}&per_page=8&orientation=landscape`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      });
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body.results) && body.results.length > 0) {
          const candidates = body.results
            .map((item) => {
              const url = item.urls?.regular || item.urls?.small;
              if (!url) return null;
              const desc = String(item.alt_description || item.description || "").toLowerCase();
              return {
                url,
                title: desc,
                description: desc,
                width: item.width || 1000,
                height: item.height || 750,
                provider: "Unsplash Food Photography",
              };
            })
            .filter(Boolean);

          if (candidates.length > 0) {
            return { candidates, provider: "unsplash" };
          }
        }
      }
    } catch (e) {
      console.warn("Unsplash API fetch failed:", e.message);
    }
  }

  // Fallback API: Wikimedia Commons API search
  try {
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodedQuery}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&format=json&origin=*`;
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages ? Object.values(data.query.pages) : [];
      const candidates = pages
        .map((p) => {
          const info = p.imageinfo?.[0];
          const url = info?.url;
          if (!url || !/\.(jpg|jpeg|png|webp)$/i.test(url)) return null;
          const title = String(p.title || "").toLowerCase();
          const desc = String(info.extmetadata?.ObjectName?.value || info.extmetadata?.ImageDescription?.value || "").toLowerCase();
          return {
            url,
            title,
            description: `${title} ${desc}`,
            width: info.width || 1000,
            height: info.height || 750,
            provider: "Wikimedia Commons",
          };
        })
        .filter(Boolean);

      if (candidates.length > 0) {
        return { candidates, provider: "wikimedia" };
      }
    }
  } catch (err) {
    // ignore wikimedia error
  }

  return null;
}

module.exports = { searchUnsplash };

