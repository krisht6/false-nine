const app = document.getElementById('app');
const searchTemplate = document.getElementById('search-template');
const themeToggle = document.getElementById('themeToggle');

const state = {
  index: null,
  seasons: [],
  seasonCache: new Map(),
  searchIndex: [],
  seasonSort: localStorage.getItem('falseNineSeasonSort') || 'oldest',
  playerSort: localStorage.getItem('falseNinePlayerSort') || 'newest',
  clubSort: localStorage.getItem('falseNineClubSort') || 'newest',
  seasonExpandAll: false,
  current: { view: 'home', id: null },
  viewStack: [],
  loadingAll: null
};

async function loadJSON(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

async function init() {
  try {
    initTheme();
    state.index = await loadJSON('data/index.json');
    state.seasons = state.index.seasons;
    buildSearchIndexFromSummaries();
    bindNav();
    state.current = readHash();
    render();
    // Warm the cache after the homepage appears. This keeps the UI quick now and ready for global search.
    loadAllSeasons().then(() => { buildFullSearchIndex(); validate(); }).catch(console.warn);
  } catch (error) {
    renderLoadError(error);
  }
}

function renderLoadError(error) {
  app.innerHTML = `<section class="chapter-hero"><div class="kicker">Setup note</div><h1>Data did not load</h1><p>This refactor uses separate JSON files. Open it with VS Code Live Server or any small local server instead of double-clicking index.html.</p></section><section class="section"><div class="card source-note"><p><strong>Error:</strong> ${escapeHTML(error.message)}</p><p>In VS Code: right-click <code>index.html</code> → <strong>Open with Live Server</strong>.</p></div></section>`;
}

function bindNav() {
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.addEventListener('click', () => nav(button.dataset.nav));
  });
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
}

function initTheme() {
  const saved = localStorage.getItem('falseNineTheme') || 'dark';
  document.documentElement.dataset.theme = saved;
  updateThemeToggle(saved);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('falseNineTheme', next);
  updateThemeToggle(next);
}

function updateThemeToggle(theme) {
  if (!themeToggle) return;
  themeToggle.textContent = theme === 'light' ? 'Dark' : 'Light';
}

function routeHash(view, id = null) {
  return `#${view}${id ? '/' + encodeURIComponent(id) : ''}`;
}

function nav(view, id = null, options = {}) {
  const next = { view, id };
  const isSame = state.current.view === next.view && state.current.id === next.id;
  if (!isSame && !options.skipStack) state.viewStack.push({ ...state.current });
  state.current = next;
  const method = options.replace ? 'replaceState' : 'pushState';
  history[method](null, '', routeHash(view, id));
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  const previous = state.viewStack.pop();
  if (previous) {
    state.current = previous;
    history.replaceState(null, '', routeHash(previous.view, previous.id));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  nav('home', null, { replace: true, skipStack: true });
}

function readHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return { view: 'home', id: null };
  const [view, ...rest] = raw.split('/');
  return { view, id: rest.length ? decodeURIComponent(rest.join('/')) : null };
}

async function getSeason(id) {
  if (state.seasonCache.has(id)) return state.seasonCache.get(id);
  const season = await loadJSON(`data/seasons/${id}.json`);
  state.seasonCache.set(id, season);
  return season;
}

function loadAllSeasons() {
  if (!state.loadingAll) {
    state.loadingAll = Promise.all(state.seasons.map(summary => getSeason(summary.id))).then(seasons => {
      state.seasonsFull = seasons;
      return seasons;
    });
  }
  return state.loadingAll;
}

function render() {
  const fromHash = readHash();
  if (location.hash && (fromHash.view !== state.current.view || fromHash.id !== state.current.id)) {
    state.current = fromHash;
  }

  const { view, id } = state.current;
  if (view === 'home') return renderHome();
  if (view === 'seasons') return renderSeasons();
  if (view === 'season') return renderSeason(id);
  if (view === 'clubs') return renderClubs();
  if (view === 'club') return renderClub(id);
  if (view === 'players') return renderPlayers();
  if (view === 'player') return renderPlayer(id);
  if (view === 'about') return renderHome();
  if (view === 'sources') return renderSources();
  renderHome();
}

function searchHTML() {
  return searchTemplate.innerHTML;
}

function backBar(label = 'Back') {
  return `<div class="backbar"><button class="back-button" data-back>← ${escapeHTML(label)}</button></div>`;
}

function topUtilityBar() {
  return `<div class="page-utility">${backBar()}<div class="utility-search">${searchHTML()}</div></div>`;
}

function bindBackbar() {
  app.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', goBack));
}

function renderHome() {
  app.innerHTML = `<section class="hero home-hero"><div><h1 class="title">False<br>Nine</h1><p class="subtitle">Season chapters, core players, club timelines, and the moments that shaped the game from 2005 onward.</p></div><div class="home-search">${searchHTML()}</div><div class="hub-grid"><button class="hub-card" data-go="seasons"><h3>Seasons</h3><p>Poster-style chapters before you dive into each year.</p></button><button class="hub-card" data-go="players"><h3>Players</h3><p>Find the figures who defined each era.</p></button><button class="hub-card" data-go="clubs"><h3>Clubs</h3><p>Trace clubs through top-four finishes and European runs.</p></button><button class="hub-card" data-go="sources"><h3>Notes</h3><p>Methodology, routing, sources, and future season rules.</p></button></div></section>`;
  bindBackbar();
  bindSearch();
  app.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => nav(button.dataset.go)));
}

function renderSeasons() {
  const seasons = sortedSeasonSummaries();
  app.innerHTML = `${backBar()}<div class="toolbar"><div><h1 class="section-title">Seasons</h1></div><div class="toolbar-actions">${seasonSortToggle()}${searchHTML()}</div></div><div class="season-grid">${seasons.map(s => `<button class="season-tile" data-season="${s.id}"><strong>${s.id}</strong><span>${posterWords(s)}</span><em>${escapeHTML(s.title)}</em></button>`).join('')}</div>`;
  bindBackbar();
  bindSearch();
  bindSeasonSort();
  app.querySelectorAll('[data-season]').forEach(button => button.addEventListener('click', () => nav('season', button.dataset.season)));
}

function sortedSeasonSummaries() {
  const seasons = [...state.seasons];
  seasons.sort((a, b) => state.seasonSort === 'newest' ? b.year - a.year : a.year - b.year);
  return seasons;
}

function seasonSortToggle() {
  const label = state.seasonSort === 'newest' ? 'Newest first' : 'Oldest first';
  return `<button class="sort-toggle" data-sort-toggle type="button">${label}</button>`;
}

function seasonJumpHTML(activeId) {
  const options = sortedSeasonSummaries().map(s => `<option value="${escapeAttr(s.id)}" ${s.id === activeId ? 'selected' : ''}>${s.id}</option>`).join('');
  return `<label class="season-jump"><span>Season</span><select data-season-select>${options}</select></label>`;
}

function collapseToggleHTML() {
  return `<button class="collapse-toggle" data-collapse-toggle type="button">${state.seasonExpandAll ? 'Collapse all' : 'Expand all'}</button>`;
}

function bindSeasonControls() {
  app.querySelectorAll('[data-season-select]').forEach(select => {
    select.addEventListener('change', () => nav('season', select.value));
  });
  app.querySelectorAll('[data-collapse-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      state.seasonExpandAll = !state.seasonExpandAll;
      app.querySelectorAll('details.collapse, details.league-collapse').forEach(details => {
        details.open = state.seasonExpandAll;
      });
      button.textContent = state.seasonExpandAll ? 'Collapse all' : 'Expand all';
    });
  });
}

function collapseOpen(defaultOpen = false) {
  return state.seasonExpandAll || defaultOpen ? ' open' : '';
}

function renderCollapse(title, body, defaultOpen = false, meta = '') {
  return `<details class="collapse"${collapseOpen(defaultOpen)}><summary><span>${escapeHTML(title)}</span>${meta ? `<em>${meta}</em>` : ''}</summary><div class="collapse-body">${body}</div></details>`;
}

function bindSeasonSort() {
  app.querySelectorAll('[data-sort-toggle]').forEach(button => button.addEventListener('click', () => {
    state.seasonSort = state.seasonSort === 'newest' ? 'oldest' : 'newest';
    localStorage.setItem('falseNineSeasonSort', state.seasonSort);
    renderSeasons();
  }));
}

function timelineSortToggle(kind) {
  const key = kind === 'club' ? 'clubSort' : 'playerSort';
  const label = state[key] === 'newest' ? 'Newest first' : 'Oldest first';
  return `<button class="sort-toggle timeline-sort" data-timeline-sort="${kind}" type="button">${label}</button>`;
}

function bindTimelineSort(kind) {
  app.querySelectorAll('[data-timeline-sort]').forEach(button => button.addEventListener('click', () => {
    const key = kind === 'club' ? 'clubSort' : 'playerSort';
    state[key] = state[key] === 'newest' ? 'oldest' : 'newest';
    localStorage.setItem(kind === 'club' ? 'falseNineClubSort' : 'falseNinePlayerSort', state[key]);
    if (kind === 'club') renderClub(state.current.id);
    else renderPlayer(state.current.id);
  }));
}

function sortTimelineRows(rows, kind) {
  const key = kind === 'club' ? state.clubSort : state.playerSort;
  const sorted = [...rows];
  sorted.sort((a, b) => key === 'newest' ? b.season.localeCompare(a.season) : a.season.localeCompare(b.season));
  return sorted;
}

function posterWords(summary) {
  const words = Array.isArray(summary.posterWords) && summary.posterWords.length
    ? summary.posterWords.slice(0, 3)
    : (summary.tags || []).slice(0, 3).map(tag => String(tag).split(/\s+/)[0]);
  return words.map(x => escapeHTML(String(x).toUpperCase())).join('\n');
}

function plainScore(score) {
  return String(score || '').replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 - $2');
}

function formatScore(score) {
  return escapeHTML(plainScore(score));
}

async function renderSeason(id) {
  const summaryId = id || state.seasons[0]?.id;
  app.innerHTML = backBar() + loadingCard('Loading season chapter…');
  try {
    const s = await getSeason(summaryId);
    app.innerHTML = `${backBar()}<section class="chapter-hero"><h1>${s.id}</h1><p class="season-dek">${escapeHTML(s.dek)}</p><div class="meta-row">${s.tags.map(x => `<span class="meta">${escapeHTML(x)}</span>`).join('')}</div></section><div class="season-controls"><div class="season-control-left">${seasonJumpHTML(s.id)}${collapseToggleHTML()}</div><div class="season-control-search">${searchHTML()}</div></div>${s.international ? renderInternational(s.international) : ''}${renderUCL(s.ucl)}${renderStorylines(s)}${renderAwards(s)}${renderTransfers(s)}${renderLeagues(s)}`;
    bindBackbar();
    bindSearch();
    bindSeasonControls();
    bindChips();
  } catch (error) {
    app.innerHTML = `<div class="empty">Could not load ${escapeHTML(summaryId)}. ${escapeHTML(error.message)}</div>`;
  }
}

function renderInternational(i) {
  if (i.status || !i.winner || !i.runnerUp) {
    const body = `<div class="card source-note pending-tournament"><p><strong>${escapeHTML(i.status || 'Coming soon')}</strong></p><p>${escapeHTML(i.note || 'This tournament has not finished yet.')}</p></div>`;
    return `<section class="section">${renderCollapse(`${i.year} ${i.type}`, body, false)}</section>`;
  }
  const body = `<div class="card final-card"><div><div class="muted">Winner</div><button class="final-team team-link team-colored"${teamStyle(i.winner)} data-club="${escapeAttr(i.winner)}">${escapeHTML(i.winner)}</button></div><div class="score">${formatScore(i.score)}</div><div><div class="muted">Runner-up</div><button class="final-team team-link team-colored"${teamStyle(i.runnerUp)} data-club="${escapeAttr(i.runnerUp)}">${escapeHTML(i.runnerUp)}</button></div></div><div class="two-col section compact-section"><div class="card"><h3>${teamRef(i.winner)} core</h3>${tiers(i.winnerCore)}</div><div class="card"><h3>${teamRef(i.runnerUp)} core</h3>${tiers(i.runnerCore)}</div></div>`;
  return `<section class="section">${renderCollapse(`${i.year} ${i.type}`, body, false)}</section>`;
}

function renderUCL(u) {
  const body = `<div class="card final-card"><div><div class="muted">Winner</div><button class="final-team team-link team-colored"${teamStyle(u.winner)} data-club="${escapeAttr(u.winner)}">${escapeHTML(u.winner)}</button></div><div><div class="score">${formatScore(u.score)}</div><div class="muted">${escapeHTML(u.venue)}</div></div><div><div class="muted">Runner-up</div><button class="final-team team-link team-colored"${teamStyle(u.runnerUp)} data-club="${escapeAttr(u.runnerUp)}">${escapeHTML(u.runnerUp)}</button></div></div><div class="two-col section compact-section"><div class="card"><h3>${teamRef(u.winner)} core</h3>${tiers(u.winnerCore)}</div><div class="card"><h3>${teamRef(u.runnerUp)} core</h3>${tiers(u.runnerCore)}</div></div>`;
  return `<section class="section">${renderCollapse('Champions League', body, false)}</section>`;
}

function renderStorylines(s) {
  const body = `<div class="card list">${s.storylines.map(x => `<div class="story">${escapeHTML(x)}</div>`).join('')}</div>`;
  return `<section class="section">${renderCollapse('Major Storylines', body, false)}</section>`;
}

function renderAwards(s) {
  const ballonRows = (s.ballonDor || []).map(x => `<div class="rank-row"><span class="rank">${x.rank}</span><button class="chip" data-player="${escapeAttr(x.player)}">${escapeHTML(x.player)}</button>${teamRef(x.club, 'muted')}</div>`).join('');
  const ballonNote = s.ballonDorNote ? `<p class="source-note award-note">${escapeHTML(s.ballonDorNote)}</p>` : '';
  const ballonBody = ballonRows || ballonNote || '<p class="source-note award-note">No Ballon d’Or entry for this chapter yet.</p>';
  const body = `<div class="two-col"><div class="card"><h3>Ballon d’Or Top 3</h3>${ballonBody}</div><div class="card"><h3>Golden Boots</h3>${(s.goldenBoots || []).map(x => `<div class="rank-row"><span class="rank">•</span><button class="chip" data-player="${escapeAttr(x.winner)}">${escapeHTML(x.winner)}</button><span class="muted">${escapeHTML(x.comp)} · ${teamRef(x.detail)}</span></div>`).join('')}</div></div>`;
  return `<section class="section">${renderCollapse('Ballon d’Or + Golden Boots', body, false)}</section>`;
}

function renderTransfers(s) {
  const body = `<div class="card">${s.transfers.map((x, i) => `<div class="transfer-row"><span class="rank">${String(i + 1).padStart(2, '0')}</span><button class="chip" data-player="${escapeAttr(x[0])}">${escapeHTML(x[0])}</button><span class="muted">${teamRef(x[1])} → ${teamRef(x[2])}</span></div>`).join('')}</div>`;
  return `<section class="section">${renderCollapse('Major Transfers', body, false)}</section>`;
}

function renderLeagues(s) {
  const leagueBlocks = Object.entries(s.leagues).map(([league, teams]) => {
    const body = teams.map(team => `<div class="team-block"><div class="team-head"><button class="chip team-name team-colored"${teamStyle(team.name)} data-club="${escapeAttr(team.name)}"><span class="team-position">#${team.position}</span> ${escapeHTML(team.name)}</button></div>${tiers(team.tiers)}</div>`).join('');
    return `<details class="league-collapse"${collapseOpen(false)}><summary><span>${escapeHTML(league)}</span><em>Top four</em></summary><div class="league-body">${body}</div></details>`;
  }).join('');
  return `<section class="section"><h2 class="section-title">Big 5 Top Four</h2><div class="league-accordion">${leagueBlocks}</div></section>`;
}

function tiers(obj) {
  return `<div class="tiers"><div class="tier"><div class="tier-label">S Tier</div><div class="chips">${obj.s.map(p => `<button class="chip" data-player="${escapeAttr(p)}">${escapeHTML(p)}</button>`).join('')}</div></div><div class="tier"><div class="tier-label">A Tier</div><div class="chips">${obj.a.map(p => `<button class="chip" data-player="${escapeAttr(p)}">${escapeHTML(p)}</button>`).join('')}</div></div></div>`;
}

function teamRef(name, extraClass = '') {
  if (!name) return '';
  const label = String(name);
  const cls = extraClass ? ` ${extraClass}` : '';
  return `<button class="inline-team team-colored${cls}"${teamStyle(label)} data-club="${escapeAttr(label)}">${escapeHTML(label)}</button>`;
}

function knownTeamNames() {
  const names = new Set();
  (state.seasonsFull || []).forEach(s => {
    if (s.ucl) [s.ucl.winner, s.ucl.runnerUp].forEach(x => x && names.add(x));
    if (s.international) [s.international.winner, s.international.runnerUp].forEach(x => x && names.add(x));
    Object.values(s.leagues || {}).flat().forEach(t => names.add(t.name));
    (s.ballonDor || []).forEach(x => x.club && names.add(x.club));
    (s.goldenBoots || []).forEach(x => x.detail && names.add(x.detail));
    (s.transfers || []).forEach(x => { if (x[1]) names.add(x[1]); if (x[2]) names.add(x[2]); });
  });
  return [...names].sort((a, b) => b.length - a.length);
}

function linkTeamsInText(text) {
  let html = escapeHTML(text);
  const replacements = [];
  knownTeamNames().forEach(team => {
    const escapedTeam = escapeHTML(team);
    const re = new RegExp(`(^|[^A-Za-z0-9])(${escapedTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^A-Za-z0-9])`, 'g');
    html = html.replace(re, (match, prefix) => {
      const token = `%%TEAM_REF_${replacements.length}%%`;
      replacements.push(team);
      return `${prefix}${token}`;
    });
  });
  replacements.forEach((team, index) => {
    html = html.replaceAll(`%%TEAM_REF_${index}%%`, teamRef(team));
  });
  return html;
}

function bindChips() {
  app.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => nav('player', button.dataset.player)));
  app.querySelectorAll('[data-club]').forEach(button => button.addEventListener('click', () => nav('club', button.dataset.club)));
}

async function renderClubs() {
  app.innerHTML = backBar() + loadingCard('Loading club index…');
  const seasons = await loadAllSeasons();
  const clubs = allClubs(seasons);
  app.innerHTML = `${backBar()}<div class="toolbar"><div><h1 class="section-title">Clubs</h1></div>${searchHTML()}</div><div class="club-list">${clubs.map(c => `<button data-club="${escapeAttr(c)}">${escapeHTML(c)}</button>`).join('')}</div>`;
  bindBackbar();
  bindSearch();
  app.querySelectorAll('[data-club]').forEach(button => button.addEventListener('click', () => nav('club', button.dataset.club)));
}

async function renderClub(name) {
  app.innerHTML = backBar() + loadingCard('Loading club page…');
  const seasons = await loadAllSeasons();
  const appearances = sortTimelineRows(clubSeasonRows(name, seasons), 'club');
  app.innerHTML = `${topUtilityBar()}<section class="chapter-hero entity-hero"><h1 class="club-hero-name"${teamStyle(name)}>${escapeHTML(name)}</h1></section><section class="section"><div class="section-heading-row"><h2 class="section-title">Timeline</h2>${timelineSortToggle('club')}</div>${appearances.length ? appearances.map(a => `<div class="card timeline-item"><h3>${a.season}</h3>${a.entries.map(entry => `<div class="club-entry"><div><strong>${escapeHTML(entry.title)}</strong></div>${entry.meta ? `<div class="muted">${escapeHTML(entry.meta)}</div>` : ''}${entry.tiers ? tiers(entry.tiers) : ''}</div>`).join('')}</div>`).join('') : '<div class="empty">This club is not in the current dataset yet.</div>'}</section>`;
  bindBackbar();
  bindSearch();
  bindChips();
  bindTimelineSort('club');
}

async function renderPlayers() {
  app.innerHTML = backBar() + loadingCard('Loading player index…');
  const seasons = await loadAllSeasons();
  const players = allPlayers(seasons);
  app.innerHTML = `${backBar()}<div class="toolbar"><div><h1 class="section-title">Players</h1></div>${searchHTML()}</div><div class="player-list">${players.map(p => `<button data-player="${escapeAttr(p)}">${escapeHTML(p)}</button>`).join('')}</div>`;
  bindBackbar();
  bindSearch();
  app.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => nav('player', button.dataset.player)));
}

async function renderPlayer(name) {
  app.innerHTML = backBar() + loadingCard('Loading player timeline…');
  const seasons = await loadAllSeasons();
  const rawRows = playerRows(name, seasons);
  const rows = sortTimelineRows(rawRows, 'player');
  const clubNames = [...new Set(rawRows.flatMap(row => row.clubs))].filter(Boolean);
  app.innerHTML = `${topUtilityBar()}<section class="chapter-hero entity-hero"><h1>${escapeHTML(name)}</h1></section>${clubNames.length ? `<div class="related-row"><span>Clubs / nations</span>${clubNames.map(club => teamRef(club)).join('')}</div>` : ''}<section class="section"><div class="section-heading-row"><h2 class="section-title">Timeline</h2>${timelineSortToggle('player')}</div>${rows.length ? rows.map(r => `<div class="card timeline-item"><h3>${r.season}</h3>${r.clubs.length ? `<div class="chips timeline-clubs">${r.clubs.map(club => teamRef(club)).join('')}</div>` : ''}<div class="event-list">${r.events.map(e => `<div class="player-event"><strong>${escapeHTML(e.type)}</strong><span class="muted">${linkTeamsInText(e.detail)}</span></div>`).join('')}</div></div>`).join('') : '<div class="empty">No entries found.</div>'}</section>`;
  bindBackbar();
  bindSearch();
  bindChips();
  bindTimelineSort('player');
}

function renderAbout() {
  app.innerHTML = `${backBar()}<section class="chapter-hero about-hero"><h1>About False Nine</h1><p>False Nine is a curated archive of modern football.</p></section><section class="section about-copy"><div class="card source-note"><p>No ads.</p><p>No rankings algorithm.</p><p>No engagement bait.</p><p>Built to document the defining clubs, players, competitions, transfers, and storylines from 2005 onward.</p><p class="made-by">Made by Krish.</p><p><a href="https://twitter.com/orangejuicewrld" target="_blank" rel="noopener">@orangejuicewrld</a> · <a href="https://krishthakkar.com" target="_blank" rel="noopener">krishthakkar.com</a></p></div></section>`;
  bindBackbar();
}

function renderSources() {
  const notes = state.index?.sourceNotes || [];
  app.innerHTML = `${backBar()}<section class="chapter-hero"><h1>Notes</h1><p>Methodology for how False Nine is organized and how future seasons should be added.</p></section><section class="section"><h2 class="section-title">Methodology</h2><div class="card source-note"><p>Top-four clubs are determined by final domestic league tables.</p><p>Champions League, World Cup, and Euro sections use final result records and finalist core-player selections.</p><p>Core players are curated by importance to the team/season, not by a single statistic. Appearances, reputation, awards, role, and historical significance all matter.</p><p>Transfers are selected for historical impact, not just fee size.</p><p>Ballon d’Or entries are aligned to the season that primarily shaped the award. Pandemic and future-award placeholders are written as notes so they do not break player pages.</p>${notes.map(x => `<p>${escapeHTML(x)}</p>`).join('')}<p>Future releases should add one season JSON file at a time, then list it in <code>data/index.json</code>.</p><p>URL state uses hash routes like <code>#season/2008-09</code>, <code>#player/Lionel%20Messi</code>, and <code>#club/Barcelona</code>, so shared links work on static hosting.</p></div></section>`;
  bindBackbar();
}

function buildSearchIndexFromSummaries() {
  state.searchIndex = state.seasons.flatMap(s => ([
    { label: s.id, type: 'Season', detail: s.title, action: ['season', s.id] },
    { label: s.title, type: 'Season title', detail: s.id, action: ['season', s.id] }
  ]));
}

function buildFullSearchIndex() {
  const seasons = state.seasonsFull || [];
  const results = [];
  const clubs = new Map();
  const players = new Map();

  const addClub = (name, detail) => {
    if (!name) return;
    if (!clubs.has(name)) clubs.set(name, new Set());
    clubs.get(name).add(detail);
  };

  const addPlayer = (name, seasonId) => {
    if (!name) return;
    if (!players.has(name)) players.set(name, new Set());
    players.get(name).add(seasonId);
  };

  seasons.forEach(s => {
    results.push({ label: s.id, type: 'Season', detail: s.title, action: ['season', s.id] });
    results.push({ label: s.title, type: 'Season title', detail: s.id, action: ['season', s.id] });

    if (s.ucl) {
      results.push({ label: `${s.id} Champions League`, type: 'Competition', detail: `${s.ucl.winner} beat ${s.ucl.runnerUp}`, action: ['season', s.id] });
      addClub(s.ucl.winner, `${s.id} · Champions League winner`);
      addClub(s.ucl.runnerUp, `${s.id} · Champions League finalist`);
    }

    if (s.international) {
      const detail = s.international.status ? s.international.status : `${s.international.winner} beat ${s.international.runnerUp}`;
      results.push({ label: `${s.international.year} ${s.international.type}`, type: 'International', detail, action: ['season', s.id] });
      addClub(s.international.winner, `${s.international.year} ${s.international.type} winner`);
      addClub(s.international.runnerUp, `${s.international.year} ${s.international.type} finalist`);
    }

    Object.entries(s.leagues).forEach(([league, teams]) => {
      results.push({ label: `${s.id} ${league}`, type: 'League', detail: 'Big 5 top four', action: ['season', s.id] });
      teams.forEach(team => addClub(team.name, `${s.id} · ${league} · #${team.position}`));
    });

    collectSeasonPlayers(s).forEach(player => addPlayer(player, s.id));
  });

  clubs.forEach((details, club) => {
    const list = [...details];
    results.push({ label: club, type: 'Club', detail: list.slice(0, 2).join(' · ') + (list.length > 2 ? ` · +${list.length - 2} more` : ''), action: ['club', club] });
  });

  players.forEach((seasonSet, player) => {
    const ids = [...seasonSet].sort();
    results.push({ label: player, type: 'Player', detail: `${ids.length} season${ids.length === 1 ? '' : 's'} · ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? '…' : ''}`, action: ['player', player] });
  });

  const seen = new Set();
  state.searchIndex = results.filter(item => {
    const key = `${item.label}|${item.type}|${item.action.join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bindSearch() {
  const input = app.querySelector('#globalSearch');
  const box = app.querySelector('#searchResults');
  if (!input || !box) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      box.classList.remove('show');
      box.innerHTML = '';
      return;
    }
    if (!state.seasonsFull) {
      loadAllSeasons().then(() => { buildFullSearchIndex(); input.dispatchEvent(new Event('input')); });
    }
    const rawMatches = state.searchIndex
      .filter(item => `${item.label} ${item.type} ${item.detail}`.toLowerCase().includes(q));

    // Keep search useful instead of noisy: if multiple results all open the
    // same page (example: 2006-07 season, 2006-07 UCL, 2006-07 leagues),
    // show one clean result for that destination.
    const seenDestinations = new Set();
    const matches = [];
    for (const item of rawMatches) {
      const destinationKey = item.action.join('|');
      if (seenDestinations.has(destinationKey)) continue;
      seenDestinations.add(destinationKey);
      matches.push(item);
      if (matches.length >= 12) break;
    }
    box.innerHTML = matches.length ? matches.map((item, idx) => `<button class="result" data-result="${idx}"><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.type)} · ${escapeHTML(item.detail)}</small></button>`).join('') : '<div class="result"><strong>No matches yet</strong><small>Try another player, club, or season</small></div>';
    box.classList.add('show');
    box.querySelectorAll('[data-result]').forEach(button => {
      button.addEventListener('click', () => {
        const item = matches[Number(button.dataset.result)];
        nav(item.action[0], item.action[1]);
      });
    });
  });
}

function allClubs(seasons = state.seasonsFull || []) {
  return [...new Set(seasons.flatMap(s => Object.values(s.leagues).flat().map(t => t.name)))].sort((a, b) => a.localeCompare(b));
}

function allPlayers(seasons = state.seasonsFull || []) {
  return [...new Set(seasons.flatMap(collectSeasonPlayers))].sort((a, b) => a.localeCompare(b));
}

function collectSeasonPlayers(s) {
  const players = [];
  (s.ballonDor || []).forEach(x => x.player && players.push(x.player));
  s.goldenBoots?.forEach(x => players.push(x.winner));
  s.transfers?.forEach(x => players.push(x[0]));
  if (s.ucl) [s.ucl.winnerCore, s.ucl.runnerCore].forEach(core => players.push(...core.s, ...core.a));
  if (s.international && s.international.winnerCore && s.international.runnerCore) [s.international.winnerCore, s.international.runnerCore].forEach(core => players.push(...core.s, ...core.a));
  Object.values(s.leagues).flat().forEach(team => players.push(...team.tiers.s, ...team.tiers.a));
  return players;
}

function playerRows(name, seasons) {
  const bySeason = new Map();
  const ensure = season => {
    if (!bySeason.has(season)) bySeason.set(season, { season, clubs: new Set(), events: [] });
    return bySeason.get(season);
  };
  const add = (season, type, detail, club = null) => {
    const row = ensure(season);
    row.events.push({ type, detail });
    if (club) row.clubs.add(club);
  };

  seasons.forEach(s => {
    (s.ballonDor || []).filter(x => x.player === name).forEach(x => add(s.id, 'Ballon d’Or', `#${x.rank}`, x.club));
    s.goldenBoots.filter(x => x.winner === name).forEach(x => add(s.id, 'Golden Boot', `${x.comp} · ${x.detail}`));
    s.transfers.filter(x => x[0] === name).forEach(x => add(s.id, 'Transfer', `${x[1]} → ${x[2]}`, x[2]));

    if (s.ucl) {
      [['Champions League winner core', s.ucl.winner, s.ucl.winnerCore], ['Champions League finalist core', s.ucl.runnerUp, s.ucl.runnerCore]].forEach(([label, team, core]) => {
        if (core?.s?.includes(name)) add(s.id, label, `S Tier · ${team}`, team);
        if (core?.a?.includes(name)) add(s.id, label, `A Tier · ${team}`, team);
      });
    }

    if (s.international) {
      [[`${s.international.type} winner core`, s.international.winner, s.international.winnerCore], [`${s.international.type} finalist core`, s.international.runnerUp, s.international.runnerCore]].forEach(([label, team, core]) => {
        if (core?.s?.includes(name)) add(s.id, label, `S Tier · ${team}`, team);
        if (core?.a?.includes(name)) add(s.id, label, `A Tier · ${team}`, team);
      });
    }

    Object.entries(s.leagues).forEach(([league, teams]) => teams.forEach(team => {
      if (team.tiers?.s?.includes(name)) add(s.id, `${league} top-four core`, `S Tier · ${team.name} #${team.position}`, team.name);
      if (team.tiers?.a?.includes(name)) add(s.id, `${league} top-four core`, `A Tier · ${team.name} #${team.position}`, team.name);
    }));
  });

  return [...bySeason.values()].map(row => ({
    season: row.season,
    clubs: [...row.clubs].sort((a, b) => a.localeCompare(b)),
    events: row.events
  })).sort((a, b) => a.season.localeCompare(b.season));
}

function clubSeasonRows(name, seasons) {
  const bySeason = new Map();
  const ensure = season => {
    if (!bySeason.has(season)) bySeason.set(season, { season, entries: [] });
    return bySeason.get(season);
  };
  seasons.forEach(s => {
    Object.entries(s.leagues).forEach(([league, teams]) => {
      teams.filter(t => t.name === name).forEach(team => ensure(s.id).entries.push({
        title: `${league} · #${team.position}`,
        meta: 'Big 5 top-four finish',
        tiers: team.tiers
      }));
    });

    if (s.ucl) {
      if (s.ucl.winner === name) ensure(s.id).entries.push({ title: 'Champions League winner', meta: `${plainScore(s.ucl.score)} vs ${s.ucl.runnerUp}`, tiers: s.ucl.winnerCore });
      if (s.ucl.runnerUp === name) ensure(s.id).entries.push({ title: 'Champions League finalist', meta: `${plainScore(s.ucl.score)} vs ${s.ucl.winner}`, tiers: s.ucl.runnerCore });
    }

    if (s.international && s.international.winner && s.international.runnerUp) {
      if (s.international.winner === name) ensure(s.id).entries.push({ title: `${s.international.type} winner`, meta: `${plainScore(s.international.score)} vs ${s.international.runnerUp}`, tiers: s.international.winnerCore });
      if (s.international.runnerUp === name) ensure(s.id).entries.push({ title: `${s.international.type} finalist`, meta: `${plainScore(s.international.score)} vs ${s.international.winner}`, tiers: s.international.runnerCore });
    }
  });
  return [...bySeason.values()].sort((a, b) => a.season.localeCompare(b.season));
}


function teamStyle(name) {
  const value = teamColorVar(name);
  return value ? ` style="--team-color:${value}"` : '';
}

function teamColorVar(name) {
  const key = normalizeTeamKey(name);
  const map = {
    'real-madrid': 'var(--team-real-madrid)',
    'barcelona': 'var(--team-barcelona)',
    'arsenal': 'var(--team-arsenal)',
    'chelsea': 'var(--team-chelsea)',
    'manchester-united': 'var(--team-manchester-united)',
    'manchester-city': 'var(--team-manchester-city)',
    'liverpool': 'var(--team-liverpool)',
    'ac-milan': 'var(--team-ac-milan)',
    'milan': 'var(--team-ac-milan)',
    'inter': 'var(--team-inter)',
    'juventus': 'var(--team-juventus)',
    'bayern-munich': 'var(--team-bayern-munich)',
    'borussia-dortmund': 'var(--team-borussia-dortmund)',
    'paris-saint-germain': 'var(--team-psg)',
    'psg': 'var(--team-psg)',
    'lyon': 'var(--team-lyon)',
    'atletico-madrid': 'var(--team-atletico-madrid)',
    'sevilla': 'var(--team-sevilla)',
    'valencia': 'var(--team-valencia)',
    'villarreal': 'var(--team-villarreal)',
    'tottenham': 'var(--team-tottenham)',
    'tottenham-hotspur': 'var(--team-tottenham)',
    'roma': 'var(--team-roma)',
    'lazio': 'var(--team-lazio)',
    'fiorentina': 'var(--team-fiorentina)',
    'udinese': 'var(--team-udinese)',
    'sampdoria': 'var(--team-sampdoria)',
    'werder-bremen': 'var(--team-werder-bremen)',
    'schalke-04': 'var(--team-schalke-04)',
    'stuttgart': 'var(--team-stuttgart)',
    'hamburger-sv': 'var(--team-hamburger-sv)',
    'wolfsburg': 'var(--team-wolfsburg)',
    'bayer-leverkusen': 'var(--team-bayer-leverkusen)',
    'bochum': 'var(--team-bochum)',
    'hertha-bsc': 'var(--team-hertha-bsc)',
    'bordeaux': 'var(--team-bordeaux)',
    'lille': 'var(--team-lille)',
    'marseille': 'var(--team-marseille)',
    'rennes': 'var(--team-rennes)',
    'toulouse': 'var(--team-toulouse)',
    'lens': 'var(--team-lens)',
    'nancy': 'var(--team-nancy)',
    'auxerre': 'var(--team-auxerre)',
    'mallorca': 'var(--team-mallorca)',
    'osasuna': 'var(--team-osasuna)',
    'chievo': 'var(--team-chievo)',
    'ajax': 'var(--team-ajax)',
    'psv': 'var(--team-psv)',
    'internacional': 'var(--team-internacional)',
    'santos': 'var(--team-santos)',
    'fulham': 'var(--team-fulham)',
    'west-ham': 'var(--team-west-ham)',
    'italy': 'var(--team-italy)',
    'france': 'var(--team-france)',
    'spain': 'var(--team-spain)',
    'germany': 'var(--team-germany)',
    'england': 'var(--team-england)',
    'portugal': 'var(--team-portugal)',
    'netherlands': 'var(--team-netherlands)',
    'argentina': 'var(--team-argentina)',
    'brazil': 'var(--team-brazil)',
    'croatia': 'var(--team-croatia)',
    'aston-villa': 'var(--team-aston-villa)',
    'atalanta': 'var(--team-atalanta)',
    'athletic-club': 'var(--team-athletic-club)',
    'benfica': 'var(--team-benfica)',
    'bologna': 'var(--team-bologna)',
    'borussia-monchengladbach': 'var(--team-borussia-monchengladbach)',
    'brest': 'var(--team-brest)',
    'caen': 'var(--team-caen)',
    'eintracht-frankfurt': 'var(--team-eintracht-frankfurt)',
    'girona': 'var(--team-girona)',
    'hannover-96': 'var(--team-hannover-96)',
    'hellas-verona': 'var(--team-hellas-verona)',
    'hoffenheim': 'var(--team-hoffenheim)',
    'leicester-city': 'var(--team-leicester-city)',
    'monaco': 'var(--team-monaco)',
    'montpellier': 'var(--team-montpellier)',
    'malaga': 'var(--team-malaga)',
    'napoli': 'var(--team-napoli)',
    'newcastle-united': 'var(--team-newcastle-united)',
    'nice': 'var(--team-nice)',
    'palermo': 'var(--team-palermo)',
    'porto': 'var(--team-porto)',
    'rb-leipzig': 'var(--team-rb-leipzig)',
    'real-sociedad': 'var(--team-real-sociedad)',
    'saint-etienne': 'var(--team-saint-etienne)',
    'shakhtar-donetsk': 'var(--team-shakhtar-donetsk)',
    'torino': 'var(--team-torino)',
    'union-berlin': 'var(--team-union-berlin)',
    'bournemouth': 'var(--team-bournemouth)',
    'brentford': 'var(--team-brentford)',
    'como': 'var(--team-como)',
    'lens': 'var(--team-lens)',
    'strasbourg': 'var(--team-strasbourg)',
    'sporting-cp': 'var(--team-sporting-cp)',
  };
  return map[key] || '';
}

function normalizeTeamKey(name) {
  return String(name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadingCard(text) {
  return `<section class="chapter-hero"><h1>One sec</h1><p>${escapeHTML(text)}</p></section>`;
}

function validate() {
  const issues = [];
  (state.seasonsFull || []).forEach(s => {
    if (Object.keys(s.leagues).length !== 5) issues.push(`${s.id}: missing one of Big 5 leagues`);
    Object.entries(s.leagues).forEach(([league, teams]) => {
      if (teams.length !== 4) issues.push(`${s.id} ${league}: top four length is ${teams.length}`);
      teams.forEach(team => {
        if (!team.tiers.s.length && !team.tiers.a.length) issues.push(`${s.id} ${team.name}: no core players`);
        team.tiers.s.concat(team.tiers.a).forEach(player => {
          if (player.includes('?')) issues.push(`${s.id} ${team.name}: uncertain player marker ${player}`);
        });
      });
    });
    if (!s.ucl?.winner || !s.ucl?.runnerUp) issues.push(`${s.id}: missing UCL final`);
  });
  if (issues.length) console.warn('Era Index validation warnings:', issues);
  else console.info('Era Index validation passed.');
  return issues;
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function escapeAttr(value = '') {
  return escapeHTML(value);
}

window.addEventListener('popstate', () => { state.current = readHash(); render(); });
window.addEventListener('hashchange', () => { state.current = readHash(); render(); });
init();
