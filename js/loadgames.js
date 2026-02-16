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

async function loadGames() {
    const res = await fetch("games/games.json");
    const games = await res.json();

    fillGrid("grid-topPicks", games.topPicks);
    fillGrid("grid-classic", games.classic);
    fillGrid("grid-skill", games.skill);
    fillGrid("grid-strategy", games.strategy);
}

function fillGrid(id, list) {
    const c = document.getElementById(id);
    if (!c) return;

    c.innerHTML = list.map(g => `
    <div class="game-card"
         data-id="${g.id}"
         data-title="${g.title}"
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
                alt="${g.title}"
            >
            <h3>${g.title}</h3>
        </a>

    </div>
`).join("");
}


document.addEventListener("DOMContentLoaded", loadGames);
