function thumbSrcset(id) {
    return `
        images/${id}_200.webp 200w,
        images/${id}_400.webp 400w,
        images/${id}_800.webp 800w
    `;
}

function thumbFallback(id) {
    return `images/${id}_400.webp`;
}

function safeParseJSON(raw, fallback) {
    try {
        return JSON.parse(raw) || fallback;
    } catch {
        return fallback;
    }
}

function normalizeGamesList(games) {
    const list = [];
    if (Array.isArray(games?.topPicks)) list.push(...games.topPicks);
    if (Array.isArray(games?.classic)) list.push(...games.classic);
    if (Array.isArray(games?.skill)) list.push(...games.skill);
    if (Array.isArray(games?.strategy)) list.push(...games.strategy);
    return list;
}

async function loadGames() {
    const res = await fetch("games/games.json");
    const games = await res.json();

    // Existing sections
    fillGrid("grid-topPicks", games.topPicks);
    fillGrid("grid-classic", games.classic);
    fillGrid("grid-skill", games.skill);
    fillGrid("grid-strategy", games.strategy);

    // New “Top Games” sections
    const ALL_GAMES = normalizeGamesList(games);

    // Plays on this device (proxy for “most addictive”)
    const playCounts = safeParseJSON(localStorage.getItem("gamePlayCounts"), {});
    const getPlays = (id) => {
        const n = Number(playCounts?.[id] || 0);
        return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const BEST_COUNT = 12;
    const ADDICTIVE_COUNT = 12;

    // BEST games:
    // - start from curated topPicks order
    // - but lightly boost ones you already played (keeps it “personal”)
    const topPicks = Array.isArray(games.topPicks) ? games.topPicks : [];
    const bestSorted = [...topPicks].sort((a, b) => {
        // Higher play count first, then original ordering
        const aPlays = getPlays(a.id);
        const bPlays = getPlays(b.id);
        if (bPlays !== aPlays) return bPlays - aPlays;
        return topPicks.findIndex(x => x.id === a.id) - topPicks.findIndex(x => x.id === b.id);
    });

    const bestGames = bestSorted.slice(0, BEST_COUNT);

    // Most addictive:
    // - sort whole catalog by local plays
    // - if user never played anything, fall back to topPicks
    const addictiveSorted = [...ALL_GAMES].sort((a, b) => getPlays(b.id) - getPlays(a.id));
    const topPlayed = addictiveSorted.filter(g => getPlays(g.id) > 0).slice(0, ADDICTIVE_COUNT);

    const addictiveGames = topPlayed.length > 0 ? topPlayed : topPicks.slice(0, ADDICTIVE_COUNT);

    fillGrid("grid-best", bestGames);
    fillGrid("grid-addictive", addictiveGames);
}

function fillGrid(id, list) {
    const c = document.getElementById(id);
    if (!c) return;

    const safeList = Array.isArray(list) ? list : [];
    c.innerHTML = safeList.map(g => {
        const title = typeof t === "function" ? t(g.title) : g.title;

        return `
        <div class="game-card"
             data-id="${g.id}"
             data-title="${title}"
             data-desc="${g.desc || ''}"
             data-tags="${(g.tags || []).join(',')}">

            <a href="${g.url}" class="game-link">
                <img 
                    class="game-thumb"
                    src="${thumbFallback(g.id)}"
                    srcset="${thumbSrcset(g.id)}"
                    sizes="(max-width: 600px) 50vw, (max-width: 480px) 45vw, 240px"
                    loading="lazy"
                    decoding="async"
                    alt="${title}"
                >
                <h3>${title}</h3>
            </a>

        </div>
        `;
    }).join("");
}


//document.addEventListener("DOMContentLoaded", loadGames);
