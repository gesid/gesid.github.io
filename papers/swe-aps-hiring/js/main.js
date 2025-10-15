// js/main.js (Versão para o projeto de Anti-padrões)

const appState = {
  playbookStructure: null, allPatterns: null, quotesMap: null,
  patternsMap: null, themesMap: null,
};

document.addEventListener('DOMContentLoaded', main);

async function main() {
  const data = await fetchData();
  if (!data) return;

  appState.playbookStructure = data.playbookStructure;
  appState.allPatterns = data.allPatterns;
  appState.quotesMap = data.quotesMap;
  appState.patternsMap = new Map(data.allPatterns.map(p => [p.id, p]));
  appState.themesMap = data.themesMap;

  setupSearchListener();
  createModalElements();
  renderPlaybook(appState.playbookStructure, '');
  renderSummaryList(appState.allPatterns);
}

async function fetchData() {
  try {
    const [structureRes, patternsRes, quotesRes, themesRes] = await Promise.all([
      fetch('data/structure.json'), fetch('data/patterns.json'),
      fetch('data/quotes.json'), fetch('data/themes.json')
    ]);
    return {
      playbookStructure: await structureRes.json(), allPatterns: await patternsRes.json(),
      quotesMap: await quotesRes.json(), themesMap: await themesRes.json(),
    };
  } catch (error) { console.error("Failed to fetch data:", error); return null; }
}

function setupSearchListener() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    renderPlaybook(filterPlaybook(searchTerm), searchTerm);
  });
}

function filterPlaybook(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return appState.playbookStructure;

  const newStructure = {};
  for (const phaseName in appState.playbookStructure) {
    const themes = appState.playbookStructure[phaseName];
    const filteredThemes = {};
    let phaseHasResults = false;
    for (const themeName in themes) {
      const filteredApIds = themes[themeName].filter(apId => {
        const pattern = appState.patternsMap.get(apId);
        if (!pattern) return false;
        const content = `${pattern.id} ${pattern.name} ${pattern.description}`.toLowerCase();
        if (content.includes(term)) return true;
        const quotes = appState.quotesMap[apId] || {};
        return Object.values(quotes).flat().some(quote => quote.toLowerCase().includes(term));
      });
      if (filteredApIds.length > 0) {
        filteredThemes[themeName] = filteredApIds;
        phaseHasResults = true;
      }
    }
    if (phaseHasResults) newStructure[phaseName] = filteredThemes;
  }
  return newStructure;
}

function renderPlaybook(structure, searchTerm) {
  const container = document.getElementById('playbook-container');
  container.innerHTML = '';

  if (Object.keys(structure).length === 0) {
    container.innerHTML = `<div class="text-center py-16"><h2 class="text-2xl font-semibold text-slate-300">No results found for &quot;${searchTerm}&quot;</h2><p class="text-slate-500 mt-2">Try searching for another keyword.</p></div>`;
    return;
  }

  for (const [phase, themes] of Object.entries(structure)) {
    const phaseSection = document.createElement('section');
    phaseSection.innerHTML = `<h2 class="text-3xl font-semibold text-red-500 mb-8 border-b-2 border-red-500/20 pb-2">${phase}</h2>`;
    const themesContainer = document.createElement('div');
    themesContainer.className = 'space-y-12';

    for (const [themeFullName, apIds] of Object.entries(themes)) {
      const themeContainer = document.createElement('div');
      const [themeCode, themeName] = themeFullName.split('. ');
      const themeDescription = appState.themesMap[themeCode] || '';
      themeContainer.innerHTML = `<h3 class="text-xl font-medium text-slate-300 mb-2">${themeName}</h3><p class="text-slate-400 max-w-4xl mb-6 text-base italic">${themeDescription}</p>`;
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
      apIds.forEach(apId => grid.appendChild(createCardElement(apId, themeCode, searchTerm)));
      themeContainer.appendChild(grid);
      themesContainer.appendChild(themeContainer);
    }
    phaseSection.appendChild(themesContainer);
    container.appendChild(phaseSection);
  }
}

function createCardElement(apId, themeCode, searchTerm) {
  const pattern = appState.patternsMap.get(apId);
  const card = document.createElement('div');
  card.className = "bg-zinc-900 border border-zinc-800 rounded-lg p-5 cursor-pointer hover:bg-zinc-800 hover:border-red-500/50 transition-all duration-200 h-full flex flex-col";
  
  const nameHtml = highlightText(pattern.name, searchTerm);
  const descriptionHtml = highlightText(pattern.description || '', searchTerm);

  card.innerHTML = `
    <p class="text-sm font-semibold text-red-500">${pattern.id}</p>
    <h4 class="text-lg font-bold text-slate-100 mt-2">${nameHtml}</h4>
    <p class="text-slate-400 mt-3 text-sm flex-grow">${descriptionHtml}</p>
  `;
  
  card.addEventListener('click', () => openModal(apId, themeCode, searchTerm));
  return card;
}

function highlightText(text, highlight) {
    if (!highlight || !highlight.trim()) return text;
    const regex = new RegExp(`(${highlight})`, 'gi');
    return text.replace(regex, `<mark class="bg-red-500/30 text-slate-100 px-1 rounded-sm">$1</mark>`);
}

function renderSummaryList(patterns) {
    const container = document.getElementById('ap-list-summary');
    container.innerHTML = patterns
        .sort((a, b) => parseInt(a.id.slice(2)) - parseInt(b.id.slice(2)))
        .map(p => `<div><h3 class="font-bold text-slate-100"><span class="text-red-500 font-semibold">${p.id}:</span> ${p.name}</h3><p class="text-slate-400 mt-1 text-sm">${p.description}</p></div>`).join('');
}

// --- Lógica do Modal ---
function createModalElements() {
    const modalHTML = `
        <div id="modal-backdrop" class="fixed inset-0 bg-black/50 z-40 hidden"></div>
        <div id="modal-content" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border-zinc-700 text-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-lg p-6 z-50 hidden">
            <button id="modal-close" class="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
            <div id="modal-header"></div><div id="modal-body" class="my-6"></div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('modal-backdrop').addEventListener('click', closeModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
}

function openModal(apId, themeCode, searchTerm) {
    const pattern = appState.patternsMap.get(apId);
    const header = document.getElementById('modal-header');
    const body = document.getElementById('modal-body');

    header.innerHTML = `
        <h2 class="text-2xl text-red-500">${pattern.id}: ${pattern.name}</h2>
        <p class="text-slate-400 pt-2 text-base">${pattern.description}</p>
    `;
    
    const allQuotesForAP = appState.quotesMap[apId] || {};
    const quotesForTheme = allQuotesForAP[themeCode] || []; 
    let quotesHTML = `<h3 class="font-bold text-lg text-slate-100 mb-4 border-b border-zinc-700 pb-2">Supporting Quotes</h3>`;

    if (quotesForTheme.length > 0) {
        quotesHTML += '<div class="space-y-6">';
        quotesForTheme.forEach(quote => { 
            const parts = quote.split(' - ');
            const text = parts.slice(0, -1).join(' - ');
            const author = parts[parts.length - 1];
            quotesHTML += `<blockquote class="border-l-4 border-red-500/50 pl-4 italic text-slate-300"><p class="mb-2">&ldquo;${highlightText(text, searchTerm)}&rdquo;</p><footer class="text-right text-sm text-slate-500 not-italic">- ${author}</footer></blockquote>`;
        });
        quotesHTML += '</div>';
    } else {
        quotesHTML += '<p class="text-slate-400">No supporting quotes found for this specific context.</p>';
    }
    body.innerHTML = quotesHTML;

    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById('modal-content').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('modal-content').classList.add('hidden');
}
