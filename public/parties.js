// Political Parties Financial Accountability & Transparency Dashboard
// Pure modern JS, zero bloat, fast client-side rendering with full interactivity

let partiesData = [];
let ebSummary = null;
let ebRegistry = [];
let finSeries = [];
let sourceDocs = [];
let transparencyData = null;

let allIndiaParties = [];
let allIndiaSummary = null;
let allIndiaGeoJson = null;
let indiaMap = null;
let mapMarkersLayer = null;
let mapGeoJsonLayer = null;
let mapStatusFilter = 'ALL';
let mapStateFilter = 'ALL';
let mapSearchQuery = '';
let mapTablePage = 1;
const mapTablePageSize = 50;
let mapMarkerIndex = {};
let mapChoroplethMode = 'recognized-state'; // 'recognized-state' or 'total-parties'
let mapShowPins = true;

// TN CEO RUPPs Submissions Portal state
let tnRuppFilings = [];
let tnRuppFilterCategory = 'ALL';
let tnRuppFilterYear = 'ALL';
let tnRuppSearch = '';
let tnRuppPage = 1;
const tnRuppPageSize = 50;

let currentTab = 'overview';
let currentScope = 'all'; // 'all', 'regional', 'national'
let selectedParty = 'ALL';
let searchQuery = '';
let tablePage = 1;
const pageSize = 50;
let sortCol = 'encash_date';
let sortAsc = false;

// Format Currency in Indian numbering format (Lakhs & Crores)
function formatInr(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  const num = Number(val);
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  } else if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatCr(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Theme management
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('parties_theme') || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('parties_theme', next);
    });
  }
}

// Fetch all datasets
async function loadData() {
  try {
    const [pRes, ebSumRes, ebRegRes, finRes, docRes, transRes, allIndiaSumRes] = await Promise.all([
      fetch('/data/parties.json').then(r => r.json()),
      fetch('/data/electoral_bonds_summary.json').then(r => r.json()),
      fetch('/data/electoral_bonds_tn.json').then(r => r.json()),
      fetch('/data/financial_series.json').then(r => r.json()),
      fetch('/data/source_documents.json').then(r => r.json()),
      fetch('/data/transparency_analysis.json').then(r => r.json()),
      fetch('/data/all_india_parties_summary.json').then(r => r.json()).catch(() => null)
    ]);

    partiesData = pRes;
    ebSummary = ebSumRes;
    ebRegistry = ebRegRes;
    finSeries = finRes;
    sourceDocs = docRes;
    transparencyData = transRes;
    allIndiaSummary = allIndiaSumRes;

    renderHeroTiles();
    renderControlBar();
    renderActiveTab();
  } catch (err) {
    console.error("Error loading party data:", err);
    document.getElementById('cards').innerHTML = `
      <div class="callout-card critical" style="margin: 20px 0;">
        <h4>Failed to load political parties dataset</h4>
        <p>${err.message}</p>
      </div>`;
  }
}

// Render Top KPI Stat Tiles
function renderHeroTiles() {
  const tilesContainer = document.getElementById('tiles');
  if (!tilesContainer) return;

  const dmkEB = ebSummary?.dmk_encashed_cr || 639.00;
  const aiadmkEB = ebSummary?.aiadmk_encashed_cr || 6.05;
  const bjpReserves = partiesData.find(p => p.id === 'BJP')?.general_fund_cr || 12164.15;
  const dmkFund = partiesData.find(p => p.id === 'DMK')?.general_fund_cr || 747.52;
  const aiadmkFund = partiesData.find(p => p.id === 'AIADMK')?.general_fund_cr || 327.16;

  tilesContainer.innerHTML = `
    <div class="tile tile-party">
      <small class="sub">Total TN Electoral Bonds</small>
      <div class="num" style="color: var(--dmk-color);">₹${formatCr(dmkEB + aiadmkEB)} Cr</div>
      <small class="sub">DMK: ₹${formatCr(dmkEB)} Cr · AIADMK: ₹${formatCr(aiadmkEB)} Cr</small>
    </div>
    <div class="tile tile-party">
      <small class="sub">DMK General Reserves</small>
      <div class="num" style="color: var(--series-1);">₹${formatCr(dmkFund)} Cr</div>
      <small class="sub">₹737.5 Cr in Bank Fixed Deposits</small>
    </div>
    <div class="tile tile-party">
      <small class="sub">AIADMK General Reserves</small>
      <div class="num" style="color: var(--aiadmk-color);">₹${formatCr(aiadmkFund)} Cr</div>
      <small class="sub">₹196.6 Cr in Bank Balances</small>
    </div>
    <div class="tile tile-party">
      <small class="sub">Zero-Bond Transparency</small>
      <div class="num" style="color: var(--good);">3 Parties</div>
      <small class="sub">CPI(M), CPI, NTK (Refused Bonds)</small>
    </div>
    <div class="tile tile-party">
      <small class="sub">Official ECI Documents</small>
      <div class="num" style="color: var(--series-4);">${sourceDocs.length}+</div>
      <small class="sub">Audits, Form 24A & Disclosures</small>
    </div>
  `;
}

// Render Navigation Controls
function renderControlBar() {
  const controls = document.getElementById('controls');
  if (!controls) return;

  controls.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
      <!-- Row 1: Main Tabs -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div class="pill-group" role="tablist">
          <button class="pill-btn ${currentTab === 'overview' ? 'active' : ''}" onclick="switchTab('overview')">
            <svg class="ic-inline"><use href="#i-grid"></use></svg> Overview & Scorecards
          </button>
          <button class="pill-btn ${currentTab === 'electoral-bonds' ? 'active' : ''}" onclick="switchTab('electoral-bonds')">
            <svg class="ic-inline"><use href="#i-hash"></use></svg> Electoral Bonds Disclosures
          </button>
          <button class="pill-btn ${currentTab === 'audits' ? 'active' : ''}" onclick="switchTab('audits')">
            <svg class="ic-inline"><use href="#i-building"></use></svg> Annual Audit Reports
          </button>
          <button class="pill-btn ${currentTab === 'contributions' ? 'active' : ''}" onclick="switchTab('contributions')">
            <svg class="ic-inline"><use href="#i-users"></use></svg> Form 24A Contributions
          </button>
          <button class="pill-btn ${currentTab === 'pan-india-map' ? 'active' : ''}" onclick="switchTab('pan-india-map')">
            <svg class="ic-inline"><use href="#i-globe"></use></svg> Pan-India Map & Registry (${(allIndiaSummary?.total_parties || 3216).toLocaleString()})
          </button>
          <button class="pill-btn ${currentTab === 'tn-rupps' ? 'active' : ''}" onclick="switchTab('tn-rupps')">
            <svg class="ic-inline"><use href="#i-building"></use></svg> CEO TN RUPPs Portal (830)
          </button>
          <button class="pill-btn ${currentTab === 'accountability' ? 'active' : ''}" onclick="switchTab('accountability')">
            <svg class="ic-inline"><use href="#i-info"></use></svg> Accountability Dossier
          </button>
          <button class="pill-btn ${currentTab === 'documents' ? 'active' : ''}" onclick="switchTab('documents')">
            <svg class="ic-inline"><use href="#i-book"></use></svg> Official ECI Archive
          </button>
        </div>

        <!-- Scope Switcher -->
        <div class="pill-group">
          <button class="pill-btn ${currentScope === 'all' ? 'active' : ''}" onclick="setScope('all')">All Parties</button>
          <button class="pill-btn ${currentScope === 'regional' ? 'active' : ''}" onclick="setScope('regional')">TN Regional</button>
          <button class="pill-btn ${currentScope === 'national' ? 'active' : ''}" onclick="setScope('national')">National in TN</button>
        </div>
      </div>
    </div>
  `;
}

window.switchTab = function(tab) {
  currentTab = tab;
  renderControlBar();
  renderActiveTab();
};

window.setScope = function(scope) {
  currentScope = scope;
  renderControlBar();
  renderActiveTab();
};

window.filterParty = function(partyId) {
  selectedParty = partyId;
  renderActiveTab();
};

// Filter party list according to active scope
function getFilteredParties() {
  if (currentScope === 'regional') {
    return partiesData.filter(p => !p.type.includes('National'));
  } else if (currentScope === 'national') {
    return partiesData.filter(p => p.type.includes('National'));
  }
  return partiesData;
}

// Main View Router
function renderActiveTab() {
  const container = document.getElementById('cards');
  if (!container) return;

  switch (currentTab) {
    case 'overview':
      renderOverviewTab(container);
      break;
    case 'electoral-bonds':
      renderElectoralBondsTab(container);
      break;
    case 'audits':
      renderAuditsTab(container);
      break;
    case 'contributions':
      renderContributionsTab(container);
      break;
    case 'pan-india-map':
      renderPanIndiaMapTab(container);
      break;
    case 'tn-rupps':
      renderTnRuppsTab(container);
      break;
    case 'accountability':
      renderAccountabilityTab(container);
      break;
    case 'documents':
      renderDocumentsTab(container);
      break;
    default:
      renderOverviewTab(container);
  }
}

// TAB 1: OVERVIEW & COMPARISON SCORECARDS
function renderOverviewTab(container) {
  const parties = getFilteredParties();

  let maxFund = Math.max(...parties.map(p => p.general_fund_cr || 0), 10);
  let maxIncome = Math.max(...parties.map(p => p.latest_income_cr || 0), 10);

  let html = `
    <!-- Comparative Warchest & Income Chart -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3><svg class="ic-inline"><use href="#i-chart"></use></svg> Political Warchests: General Reserves & Annual Income (FY 2024-25)</h3>
          <p>Official figures filed with the Election Commission of India under Section 139(4B) of the Income Tax Act</p>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
  `;

  parties.forEach(p => {
    const fundPct = Math.min(100, Math.max(3, (p.general_fund_cr / maxFund) * 100));
    html += `
      <div class="bar-row">
        <div class="bar-label" title="${p.name} (${p.symbol})">
          ${p.logo_url ? `<img class="party-bar-logo" src="${p.logo_url}" alt="${p.symbol}">` : `<span style="display:inline-block; width:10px; height:10px; border-radius:3px; background:${p.color}; margin-right:6px;"></span>`}
          <strong>${p.short_name}</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${fundPct}%; background: ${p.color};"></div>
        </div>
        <div class="bar-value">₹${formatCr(p.general_fund_cr)} Cr</div>
      </div>
    `;
  });

  html += `
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:.75rem; color:var(--ink-muted); border-top:1px solid var(--grid); padding-top:8px;">
        <span>Bar width proportional to General Fund / Net Reserves</span>
        <span>Source: Annual Audit Reports 2024-25</span>
      </div>
    </div>

    <!-- Party Cards Grid -->
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <h2 style="font-size:1.15rem; font-weight:700;">Party Financial Dossiers (${parties.length} Parties)</h2>
      <span class="sub" style="font-size:.8125rem; color:var(--ink-muted);">Click any party card for in-depth balance sheet & audit review</span>
    </div>
    <div class="party-grid">
  `;

  parties.forEach(p => {
    const isZeroEb = p.eb_total_cr === 0;
    html += `
      <div class="party-card" onclick="openPartyModal('${p.id}')" style="cursor:pointer;">
        <div class="party-card-header">
          <div class="party-title-group">
            <h3>
              ${p.short_name}
              <small style="font-weight:400; font-size:.75rem; color:var(--ink-muted);">(${p.symbol})</small>
            </h3>
            <div class="sub">${p.tamil_name}</div>
          </div>
          <div class="party-badge-symbol" style="${p.logo_url ? '' : `background:${p.color};`}" title="${p.name} (${p.symbol})">
            ${p.logo_url ? `<img class="party-logo-badge-img" src="${p.logo_url}" alt="${p.symbol}">` : p.id}
          </div>
        </div>

        <div style="font-size:.75rem; color:var(--ink-2); display:flex; flex-direction:column; gap:4px;">
          <div><strong>Leader:</strong> ${p.leader}</div>
          ${p.assembly_role ? `
            <div>
              <span class="badge-tag ${p.assembly_standing === 'government' ? 'assembly-govt' : (p.assembly_standing === 'opposition' ? 'assembly-opp' : (p.assembly_standing === 'neutral' ? 'assembly-neutral' : 'assembly-support'))}" style="font-size:.68rem; padding:2px 8px;">${p.assembly_role}</span>
            </div>
          ` : ''}
        </div>

        <div class="party-stats-grid">
          <div class="party-stat-item">
            <small>General Reserves</small>
            <b style="color:${p.color};">₹${formatCr(p.general_fund_cr)} Cr</b>
          </div>
          <div class="party-stat-item">
            <small>Electoral Bonds</small>
            <b style="${isZeroEb ? 'color:var(--good);' : 'color:var(--heat-5);'}">
              ${isZeroEb ? '₹0.00 (Refused)' : `₹${formatCr(p.eb_total_cr)} Cr`}
            </b>
          </div>
          <div class="party-stat-item">
            <small>FY 24-25 Income</small>
            <b>₹${formatCr(p.latest_income_cr)} Cr</b>
          </div>
          <div class="party-stat-item">
            <small>FY 24-25 Surplus</small>
            <b style="color:${p.latest_surplus_cr >= 0 ? 'var(--good)' : 'var(--critical)'};">
              ${p.latest_surplus_cr >= 0 ? '+' : ''}₹${formatCr(p.latest_surplus_cr)} Cr
            </b>
          </div>
        </div>

        <div class="party-footer-tags">
          <span class="badge-tag regional">${p.scope}</span>
          ${isZeroEb ? '<span class="badge-tag zero-eb">Zero Electoral Bonds</span>' : `<span class="badge-tag eb-heavy">₹${formatCr(p.eb_total_cr)} Cr Bonds</span>`}
          <span class="badge-tag">Audited</span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// TAB 2: ELECTORAL BONDS DEEP DIVE
function renderElectoralBondsTab(container) {
  const dmkBonds = ebSummary?.parties?.find(p => p.party_code === 'DMK');
  const aiadmkBonds = ebSummary?.parties?.find(p => p.party_code === 'AIADMK');

  let html = `
    <!-- Top Highlights Banner -->
    <div class="callout-grid">
      <div class="callout-card critical">
        <span class="stat" style="color:var(--dmk-color);">₹639.00 Cr</span>
        <h4>Dravida Munnetra Kazhagam (DMK)</h4>
        <p>DMK is the <strong>#1 recipient of Electoral Bonds in Tamil Nadu</strong> and #6 in India. 648 bonds encashed across SBI branches.</p>
      </div>
      <div class="callout-card warning">
        <span class="stat" style="color:var(--heat-6);">₹503.00 Cr</span>
        <h4>Future Gaming & Hotel Services (Santiago Martin)</h4>
        <p>Lottery conglomerate Future Gaming alone funded <strong>78.7% of DMK's total electoral bonds</strong>, followed by Megha Engineering (₹85 Cr).</p>
      </div>
      <div class="callout-card good">
        <span class="stat" style="color:var(--aiadmk-color);">₹6.05 Cr</span>
        <h4>All India Anna Dravida Munnetra Kazhagam</h4>
        <p>AIADMK encashed only 38 bonds in April 2019 during the 17th Lok Sabha elections, taking no bonds in subsequent years.</p>
      </div>
      <div class="callout-card good">
        <span class="stat" style="color:var(--good);">₹0.00</span>
        <h4>Zero-Bond Accountability Stance</h4>
        <p><strong>CPI(M), CPI, and NTK took zero electoral bonds</strong>. CPI(M) challenged the scheme before the Supreme Court, winning a historic constitutional strike-down.</p>
      </div>
    </div>

    <!-- Top Donors to DMK Bar Chart -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3><svg class="ic-inline"><use href="#i-chart"></use></svg> Top Corporate Donors to DMK via Electoral Bonds</h3>
          <p>Matched from official SBI purchase records (April 2019 - January 2024)</p>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
  `;

  if (dmkBonds?.top_donors) {
    const maxDonor = dmkBonds.top_donors[0]?.amount_cr || 500;
    dmkBonds.top_donors.slice(0, 10).forEach(d => {
      const pct = Math.min(100, Math.max(2, (d.amount_cr / maxDonor) * 100));
      html += `
        <div class="bar-row" style="grid-template-columns: 220px 1fr 100px;">
          <div class="bar-label" title="${d.donor}">${d.donor}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:var(--dmk-color);"></div>
          </div>
          <div class="bar-value">₹${formatCr(d.amount_cr)} Cr <small style="color:var(--ink-muted); font-size:.6875rem;">(${d.share_pct}%)</small></div>
        </div>
      `;
    });
  }

  html += `
      </div>
    </div>

    <!-- Granular Bond Table with Search & Filter -->
    <div class="table-wrap">
      <div class="table-header-bar">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <h3 style="font-size:1rem; font-weight:700; margin:0;">
            Electoral Bonds Transaction Registry (Tamil Nadu Parties)
          </h3>
          <span class="badge-tag">${ebRegistry.length} Total Bonds</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div class="table-search-input">
            <svg class="ic-inline"><use href="#i-filter"></use></svg>
            <input type="text" id="eb-search" placeholder="Search donor name, bond code..." oninput="filterBondTable(this.value)">
          </div>
          <button class="btn-download" onclick="exportBondsToCsv()">
            <svg class="ic-inline"><use href="#i-download"></use></svg> Export CSV
          </button>
        </div>
      </div>

      <div class="data-table-scroll" id="eb-table-scroll">
        ${renderBondTableHtml(ebRegistry.slice(0, pageSize))}
      </div>
      <div style="padding:10px 16px; border-top:1px solid var(--grid); display:flex; justify-content:space-between; align-items:center; font-size:.75rem; color:var(--ink-muted);">
        <span id="eb-table-count">Showing 1 to ${Math.min(pageSize, ebRegistry.length)} of ${ebRegistry.length} records</span>
        <button class="pill-btn" onclick="loadMoreBonds()" id="eb-load-more" ${ebRegistry.length <= pageSize ? 'style=\"display:none;\"' : ''}>Load More Records</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderBondTableHtml(bonds) {
  if (!bonds.length) {
    return `<div style="padding:30px; text-align:center; color:var(--ink-muted);">No matching bonds found.</div>`;
  }
  let out = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Bond Code</th>
          <th>Recipient Party</th>
          <th>Purchaser / Donor Name</th>
          <th style="text-align:right;">Denomination</th>
          <th>Encash Date</th>
          <th>Purchase Date</th>
          <th>Branch Code</th>
        </tr>
      </thead>
      <tbody>
  `;
  bonds.forEach(b => {
    const isDmk = b.party_code === 'DMK';
    out += `
      <tr>
        <td><code>${b.code}</code></td>
        <td>
          <span class="badge-tag ${isDmk ? 'eb-heavy' : 'regional'}">
            ${b.party_code}
          </span>
        </td>
        <td style="font-weight:600; max-width:280px; overflow:hidden; text-overflow:ellipsis;" title="${b.purchaser}">
          ${b.purchaser_normalized || b.purchaser}
        </td>
        <td class="num" style="font-weight:700;">${formatInr(b.denomination)}</td>
        <td class="num">${b.encash_date}</td>
        <td class="num">${b.purchase_date}</td>
        <td><code>${b.branch_encash}</code></td>
      </tr>
    `;
  });
  out += `</tbody></table>`;
  return out;
}

window.filterBondTable = function(query) {
  searchQuery = query.toLowerCase().trim();
  const filtered = ebRegistry.filter(b => 
    b.code.toLowerCase().includes(searchQuery) ||
    b.purchaser.toLowerCase().includes(searchQuery) ||
    b.purchaser_normalized.toLowerCase().includes(searchQuery) ||
    b.party_code.toLowerCase().includes(searchQuery)
  );
  document.getElementById('eb-table-scroll').innerHTML = renderBondTableHtml(filtered.slice(0, pageSize));
  document.getElementById('eb-table-count').innerText = `Showing 1 to ${Math.min(pageSize, filtered.length)} of ${filtered.length} records`;
};

window.loadMoreBonds = function() {
  tablePage++;
  const count = tablePage * pageSize;
  document.getElementById('eb-table-scroll').innerHTML = renderBondTableHtml(ebRegistry.slice(0, count));
  document.getElementById('eb-table-count').innerText = `Showing 1 to ${Math.min(count, ebRegistry.length)} of ${ebRegistry.length} records`;
  if (count >= ebRegistry.length) {
    document.getElementById('eb-load-more').style.display = 'none';
  }
};

window.exportBondsToCsv = function() {
  const headers = ["Bond_Code", "Party", "Purchaser", "Denomination", "Encash_Date", "Purchase_Date", "Branch"];
  const rows = ebRegistry.map(b => [
    b.code,
    `"${b.party_code}"`,
    `"${(b.purchaser_normalized || b.purchaser).replace(/"/g, '""')}"`,
    b.denomination,
    b.encash_date,
    b.purchase_date,
    b.branch_encash
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "tamilnadu_political_parties_electoral_bonds.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// TAB 3: ANNUAL AUDIT REPORTS
function renderAuditsTab(container) {
  const parties = getFilteredParties();

  let html = `
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3><svg class="ic-inline"><use href="#i-building"></use></svg> Financial Year 2024-25 Audit Statements Comparison</h3>
          <p>Audited by independent Chartered Accountants and submitted to the Election Commission of India</p>
        </div>
      </div>
      
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>Auditor & Firm</th>
              <th>UDIN / Reg</th>
              <th style="text-align:right;">Total Income</th>
              <th style="text-align:right;">Total Expenditure</th>
              <th style="text-align:right;">Net Surplus / (Deficit)</th>
              <th style="text-align:right;">General Fund (Net Worth)</th>
              <th style="text-align:right;">Cash & Bank Deposits</th>
            </tr>
          </thead>
          <tbody>
  `;

  parties.forEach(p => {
    html += `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            ${p.logo_url ? `<img class="party-table-logo" src="${p.logo_url}" alt="${p.symbol}">` : `<span style="display:inline-block; width:26px; height:26px; border-radius:6px; background:${p.color}; color:#fff; font-size:10px; font-weight:700; text-align:center; line-height:26px; flex:none;">${p.id.slice(0,2)}</span>`}
            <div>
              <strong style="color:${p.color};">${p.short_name}</strong>
              <small style="display:block; color:var(--ink-muted);">${p.name}</small>
            </div>
          </div>
        </td>
        <td style="font-size:.75rem; max-width:200px; white-space:normal;">${p.auditor}</td>
        <td><code>${p.pan}</code></td>
        <td class="num" style="font-weight:700;">₹${formatCr(p.latest_income_cr)} Cr</td>
        <td class="num">₹${formatCr(p.latest_expenditure_cr)} Cr</td>
        <td class="num" style="font-weight:700; color:${p.latest_surplus_cr >= 0 ? 'var(--good)' : 'var(--critical)'};">
          ${p.latest_surplus_cr >= 0 ? '+' : ''}₹${formatCr(p.latest_surplus_cr)} Cr
        </td>
        <td class="num" style="font-weight:700; color:${p.color};">₹${formatCr(p.general_fund_cr)} Cr</td>
        <td class="num">₹${formatCr(p.cash_bank_cr)} Cr</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>

    <!-- Multi-year Trend Chart for Major TN Parties -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3><svg class="ic-inline"><use href="#i-line"></use></svg> Multi-Year General Fund Growth (FY 2020 to FY 2025)</h3>
          <p>Accumulation of party wealth and assets over election cycles (in ₹ Crores)</p>
        </div>
      </div>
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>FY 2019-20</th>
              <th>FY 2020-21</th>
              <th>FY 2021-22</th>
              <th>FY 2022-23</th>
              <th>FY 2023-24</th>
              <th>FY 2024-25</th>
              <th>5-Year Growth</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong style="color:var(--dmk-color);">DMK</strong></td>
              <td class="num">₹284.1 Cr</td>
              <td class="num">₹215.7 Cr</td>
              <td class="num">₹398.4 Cr</td>
              <td class="num">₹541.1 Cr</td>
              <td class="num">₹521.9 Cr</td>
              <td class="num" style="font-weight:700; color:var(--dmk-color);">₹747.5 Cr</td>
              <td class="num" style="font-weight:700; color:var(--good);">+163.1%</td>
            </tr>
            <tr>
              <td><strong style="color:var(--aiadmk-color);">AIADMK</strong></td>
              <td class="num">₹235.1 Cr</td>
              <td class="num">₹153.4 Cr</td>
              <td class="num">₹167.9 Cr</td>
              <td class="num">₹212.0 Cr</td>
              <td class="num">₹291.7 Cr</td>
              <td class="num" style="font-weight:700; color:var(--aiadmk-color);">₹327.2 Cr</td>
              <td class="num" style="font-weight:700; color:var(--good);">+39.2%</td>
            </tr>
            <tr>
              <td><strong style="color:var(--bjp-color);">BJP (Operating in TN)</strong></td>
              <td class="num">₹5,200.0 Cr</td>
              <td class="num">₹6,150.0 Cr</td>
              <td class="num">₹7,040.8 Cr</td>
              <td class="num">₹8,039.9 Cr</td>
              <td class="num">₹9,169.6 Cr</td>
              <td class="num" style="font-weight:700; color:var(--bjp-color);">₹12,164.2 Cr</td>
              <td class="num" style="font-weight:700; color:var(--good);">+133.9%</td>
            </tr>
            <tr>
              <td><strong style="color:var(--inc-color);">INC (Operating in TN)</strong></td>
              <td class="num">₹380.0 Cr</td>
              <td class="num">₹295.0 Cr</td>
              <td class="num">₹312.4 Cr</td>
              <td class="num">₹297.6 Cr</td>
              <td class="num">₹497.5 Cr</td>
              <td class="num" style="font-weight:700; color:var(--inc-color);">₹365.5 Cr</td>
              <td class="num" style="font-weight:700; color:var(--critical);">-3.8%</td>
            </tr>
            <tr>
              <td><strong style="color:var(--ntk-color);">NTK</strong></td>
              <td class="num">-</td>
              <td class="num">-</td>
              <td class="num">₹0.15 Cr</td>
              <td class="num">₹0.41 Cr</td>
              <td class="num">₹1.00 Cr</td>
              <td class="num" style="font-weight:700; color:var(--ntk-color);">₹0.56 Cr</td>
              <td class="num" style="font-weight:700; color:var(--good);">+273.3%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// TAB 4: CONTRIBUTION REPORTS (FORM 24A)
function renderContributionsTab(container) {
  let html = `
    <div class="callout-grid">
      <div class="callout-card info">
        <span class="stat">Form 24A</span>
        <h4>Section 29C Mandate</h4>
        <p>Political parties are statutorily required under the Representation of the People Act, 1951 to declare all individual and corporate donations exceeding <strong>₹20,000</strong> to the Election Commission before filing income tax returns.</p>
      </div>
      <div class="callout-card critical">
        <span class="stat">₹365.82 Cr</span>
        <h4>DMK Form 24A (FY 2024-25)</h4>
        <p>DMK declared ₹365.82 Cr in voluntary contributions, with ₹300.67 Cr for Party Development Fund, ₹60.00 Cr for Election Fund, and ₹4.42 Cr for Legal Wing.</p>
      </div>
      <div class="callout-card good">
        <span class="stat">293 Donors</span>
        <h4>NTK Crowdfunding Model</h4>
        <p>NTK declared ₹3.32 Cr in Form 24A, comprising online crowdfunding aggregations via Cashfree Payments India Pvt Ltd and cadre contributions.</p>
      </div>
      <div class="callout-card info">
        <span class="stat">₹13.30 Cr</span>
        <h4>TVK Form 24A Filings</h4>
        <p>Vijay's Tamilaga Vettri Kazhagam declared ₹13.30 Cr in FY 2025-26 (led by Aadhav Arjun ₹8.2 Cr & Ranjith Kumar ₹5 Cr via RTGS) and ₹1.22 Cr in FY 2024-25 (Vijay ₹65.825 Lakhs). <a href="/data/tvk/tvkfy2025-2026.jpg" target="_blank" style="font-weight:600; text-decoration:underline;">View FY26 Sheet</a> · <a href="/data/tvk/tvkfy2024-2025.jpg" target="_blank" style="font-weight:600; text-decoration:underline;">View FY25 Sheet</a></p>
      </div>
    </div>

    <!-- Detailed Contribution Breakdown Table -->
    <div class="table-wrap">
      <div class="table-header-bar">
        <h3 style="font-size:1rem; font-weight:700; margin:0;">
          Form 24A Contribution Declared Structures (Official Statutory Filings)
        </h3>
        <span class="badge-tag">Statutory Transparency</span>
      </div>

      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>Declared Total (Form 24A)</th>
              <th>Corporate Share</th>
              <th>Non-Corporate / Individual Share</th>
              <th>Primary Payment Mode</th>
              <th>PAN Compliance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/dmk.png" alt="Rising Sun">
                  <strong style="color:var(--dmk-color);">Dravida Munnetra Kazhagam (DMK)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹365,82,46,915</td>
              <td class="num">₹310.60 Cr (84.9%)</td>
              <td class="num">₹55.22 Cr (15.1%)</td>
              <td>Cheque / DD / RTGS</td>
              <td><span class="badge-tag good">100% Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/aiadmk.png" alt="Two Leaves">
                  <strong style="color:var(--aiadmk-color);">All India Anna Dravida Munnetra Kazhagam (AIADMK)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹66,30,74,250</td>
              <td class="num">₹45.20 Cr (68.2%)</td>
              <td class="num">₹21.11 Cr (31.8%)</td>
              <td>Banking Channels / Application Fees</td>
              <td><span class="badge-tag good">100% Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/tvk.png" alt="TVK">
                  <strong style="color:var(--tvk-color);">Tamilaga Vettri Kazhagam (TVK) — FY 2025-26</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700; color:var(--tvk-color);">₹13,30,00,000</td>
              <td class="num">₹0.00 (0%)</td>
              <td class="num">₹13.30 Cr (100% Individual)</td>
              <td>RTGS (Aadhav Arjun ₹8.2 Cr, Ranjith Kumar ₹5 Cr)</td>
              <td><span class="badge-tag good">PAN AAOAT5236A Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/tvk.png" alt="TVK">
                  <strong style="color:var(--tvk-color);">Tamilaga Vettri Kazhagam (TVK) — FY 2024-25</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700; color:var(--tvk-color);">₹1,22,00,000</td>
              <td class="num">₹0.00 (0%)</td>
              <td class="num">₹1.22 Cr (100% Individual)</td>
              <td>Cheque No. 000001 (Joseph Vijay ₹65.825L)</td>
              <td><span class="badge-tag good">PAN AAOAT5236A Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="display:inline-block; width:26px; height:26px; border-radius:6px; background:var(--ntk-color); color:#fff; font-size:10px; font-weight:700; text-align:center; line-height:26px; flex:none;">NT</span>
                  <strong style="color:var(--ntk-color);">Naam Tamilar Katchi (NTK)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹3,31,75,374</td>
              <td class="num">₹0.00 (0%)</td>
              <td class="num">₹3.32 Cr (100%)</td>
              <td>Online Cashfree Gateway & NEFT</td>
              <td><span class="badge-tag good">PAN / Cashfree Declared</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/dmdk.png" alt="Murasu">
                  <strong style="color:var(--dmdk-color);">Desiya Murpokku Dravida Kazhagam (DMDK)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹34,53,912</td>
              <td class="num">₹0.00 (0%)</td>
              <td class="num">₹0.35 Cr (100%)</td>
              <td>Membership Fees & Cheque</td>
              <td><span class="badge-tag good">Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/ammk.png" alt="Pressure Cooker">
                  <strong style="color:#993333;">Amma Makkal Munnettra Kazagam (AMMK)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹4,39,501</td>
              <td class="num">₹0.00 (0%)</td>
              <td class="num">₹0.04 Cr (100%)</td>
              <td>Bank Transfer & Cheque (CEO TN Filing)</td>
              <td><span class="badge-tag good">PAN AAATA2462J Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/bjp.png" alt="Lotus">
                  <strong style="color:var(--bjp-color);">Bharatiya Janata Party (National in TN)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹6,124,85,83,279</td>
              <td class="num">₹4,890.00 Cr (79.8%)</td>
              <td class="num">₹1,234.86 Cr (20.2%)</td>
              <td>Electoral Trusts (Prudent) & RTGS</td>
              <td><span class="badge-tag good">100% Verified</span></td>
            </tr>
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <img class="party-table-logo" src="/logos/inc.png" alt="Hand">
                  <strong style="color:var(--inc-color);">Indian National Congress (National in TN)</strong>
                </div>
              </td>
              <td class="num" style="font-weight:700;">₹522,13,11,893</td>
              <td class="num">₹345.00 Cr (66.1%)</td>
              <td class="num">₹177.13 Cr (33.9%)</td>
              <td>Electoral Trusts & Digital Coupons</td>
              <td><span class="badge-tag good">100% Verified</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// TAB 5: ACCOUNTABILITY DOSSIER
function renderAccountabilityTab(container) {
  let html = `
    <div style="margin-bottom:18px;">
      <h2 style="font-size:1.15rem; font-weight:700;">Investigative Findings: Money Power & Electoral Accountability in Tamil Nadu</h2>
      <p style="font-size:.8125rem; color:var(--ink-2); margin-top:4px;">
        Key structural patterns uncovered across Election Commission of India filings and Supreme Court mandated SBI disclosure sheets.
      </p>
    </div>

    <div class="callout-grid">
  `;

  if (transparencyData?.key_findings) {
    transparencyData.key_findings.forEach(f => {
      html += `
        <div class="callout-card ${f.type}">
          <span class="stat">${f.stat}</span>
          <h4>${f.title}</h4>
          <p>${f.detail}</p>
        </div>
      `;
    });
  }

  html += `
    </div>

    <!-- Corporate Donors in Tamil Nadu -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3><svg class="ic-inline"><use href="#i-building"></use></svg> Major Corporate Donors Active in Tamil Nadu Politics</h3>
          <p>Cross-matched entities funding regional and national parties</p>
        </div>
      </div>
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Corporate Entity / Group</th>
              <th>Recipient Party</th>
              <th>Sector / Industry</th>
              <th>Headquarters / Region</th>
              <th style="text-align:right;">Amount (₹ Cr)</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (transparencyData?.tn_corporate_donors) {
    transparencyData.tn_corporate_donors.forEach(d => {
      html += `
        <tr>
          <td><strong>${d.donor}</strong></td>
          <td><span class="badge-tag regional">${d.party}</span></td>
          <td>${d.sector}</td>
          <td>${d.hq}</td>
          <td class="num" style="font-weight:700;">₹${formatCr(d.amount_cr)} Cr</td>
        </tr>
      `;
    });
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>

    <!-- Transparency Scorecard -->
    <div class="chart-container">
      <div class="chart-header">
        <div>
          <h3><svg class="ic-inline"><use href="#i-percent"></use></svg> Political Party Transparency Scorecard</h3>
          <p>Evaluation based on: Electoral Bonds avoidance, on-time audit filing, donor PAN disclosure, and open reporting</p>
        </div>
      </div>
      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>Transparency Score</th>
              <th>EB Avoidance</th>
              <th>Audit Compliance</th>
              <th>Verdict & Basis</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (transparencyData?.party_transparency_scores) {
    transparencyData.party_transparency_scores.forEach(s => {
      const scoreColor = s.score >= 85 ? 'var(--good)' : s.score >= 70 ? 'var(--day)' : 'var(--critical)';
      const partyObj = partiesData.find(p => p.short_name === s.party || p.id === s.party || (s.party === 'CPI(M)' && p.id === 'CPIM'));
      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              ${partyObj?.logo_url ? `<img class="party-table-logo" src="${partyObj.logo_url}" alt="${partyObj.symbol}">` : (partyObj ? `<span style="display:inline-block; width:26px; height:26px; border-radius:6px; background:${partyObj.color}; color:#fff; font-size:10px; font-weight:700; text-align:center; line-height:26px; flex:none;">${partyObj.id.slice(0,2)}</span>` : '')}
              <strong>${s.party}</strong>
            </div>
          </td>
          <td class="num" style="font-weight:750; color:${scoreColor};">${s.score} / 100</td>
          <td>${!s.eb_taken ? '<span class="badge-tag zero-eb">Zero Bonds (Clean)</span>' : `<span class="badge-tag eb-heavy">Took ₹${formatCr(s.eb_cr)} Cr</span>`}</td>
          <td>${s.audited_on_time ? '<span class="status-badge status-state">On-Time</span>' : '<span class="status-badge status-delisted">Delayed</span>'}</td>
          <td style="font-size:.75rem; color:var(--ink-2);">${s.verdict}</td>
        </tr>
      `;
    });
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// TAB 6: OFFICIAL ECI DOCUMENT ARCHIVE
function renderDocumentsTab(container) {
  let html = `
    <div class="table-wrap">
      <div class="table-header-bar">
        <div>
          <h3 style="font-size:1rem; font-weight:700; margin:0;">
            Official Election Commission of India PDF Repository (${sourceDocs.length} Documents)
          </h3>
          <p style="font-size:.75rem; color:var(--ink-muted); margin:2px 0 0 0;">
            Direct signed PDF submissions from eci.gov.in and old.eci.gov.in
          </p>
        </div>
        <div class="table-search-input">
          <svg class="ic-inline"><use href="#i-filter"></use></svg>
          <input type="text" id="doc-search" placeholder="Filter documents by party, year..." oninput="filterDocList(this.value)">
        </div>
      </div>

      <div class="data-table-scroll" id="doc-list-scroll">
        ${renderDocItemsHtml(sourceDocs.slice(0, 40))}
      </div>
      <div style="padding:10px 16px; border-top:1px solid var(--grid); display:flex; justify-content:space-between; align-items:center; font-size:.75rem; color:var(--ink-muted);">
        <span id="doc-table-count">Showing 1 to ${Math.min(40, sourceDocs.length)} of ${sourceDocs.length} documents</span>
        <button class="pill-btn" onclick="loadMoreDocs()" id="doc-load-more" ${sourceDocs.length <= 40 ? 'style=\"display:none;\"' : ''}>Load More Documents</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

let docPage = 1;
const docPageSize = 40;

function renderDocItemsHtml(docs) {
  if (!docs.length) {
    return `<div style="padding:30px; text-align:center; color:var(--ink-muted);">No matching documents found.</div>`;
  }
  let out = '';
  docs.forEach(d => {
    out += `
      <div class="doc-item">
        <div class="doc-info">
          <div class="doc-title">${d.title}</div>
          <div class="doc-meta">
            <span class="badge-tag">${d.category}</span>
            <span>${d.year_group}</span>
            ${d.record_size ? `<span>· ${d.record_size}</span>` : ''}
          </div>
        </div>
        <div>
          <a class="btn-download" href="${d.pdf_url}" target="_blank" rel="noopener noreferrer">
            <svg class="ic-inline"><use href="#i-external"></use></svg> View / Download PDF
          </a>
        </div>
      </div>
    `;
  });
  return out;
}

window.filterDocList = function(query) {
  const q = query.toLowerCase().trim();
  const filtered = sourceDocs.filter(d => 
    d.title.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q) ||
    d.year_group.toLowerCase().includes(q)
  );
  document.getElementById('doc-list-scroll').innerHTML = renderDocItemsHtml(filtered.slice(0, docPageSize));
  document.getElementById('doc-table-count').innerText = `Showing 1 to ${Math.min(docPageSize, filtered.length)} of ${filtered.length} documents`;
};

window.loadMoreDocs = function() {
  docPage++;
  const count = docPage * docPageSize;
  document.getElementById('doc-list-scroll').innerHTML = renderDocItemsHtml(sourceDocs.slice(0, count));
  document.getElementById('doc-table-count').innerText = `Showing 1 to ${Math.min(count, sourceDocs.length)} of ${sourceDocs.length} documents`;
  if (count >= sourceDocs.length) {
    document.getElementById('doc-load-more').style.display = 'none';
  }
};

// PARTY DOSSIER MODAL DRAWER
window.openPartyModal = function(partyId) {
  const party = partiesData.find(p => p.id === partyId);
  if (!party) return;

  const modalOverlay = document.getElementById('party-modal');
  const modalTitle = document.getElementById('modal-party-title');
  const modalBody = document.getElementById('modal-party-body');

  modalTitle.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="party-modal-logo-badge" style="${party.logo_url ? '' : `background:${party.color}; color:#fff; font-weight:800; font-size:16px;`}">
        ${party.logo_url ? `<img src="${party.logo_url}" alt="${party.symbol}">` : party.id}
      </div>
      <div>
        <h3 style="font-size:1.15rem; font-weight:700; margin:0;">${party.name}</h3>
        <small style="color:var(--ink-muted);">${party.tamil_name} · ${party.type}</small>
      </div>
    </div>
  `;

  // Filter bonds for this party
  const partyBonds = ebRegistry.filter(b => b.party_code === party.id);
  const partySeries = finSeries.filter(s => s.party === party.id);
  const partyDocs = sourceDocs.filter(d => d.title.toLowerCase().includes(party.name.toLowerCase()) || d.title.toLowerCase().includes(party.short_name.toLowerCase()));

  let bodyHtml = `
    <!-- Registration & Key Info -->
    <div style="background:var(--surface-2); border-radius:var(--r-md); padding:14px; margin-bottom:16px; border:1px solid var(--ring);">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:.8125rem;">
        <div><strong>Leadership:</strong> ${party.leader}</div>
        <div><strong>Founded:</strong> ${party.founded_year}</div>
        <div><strong>Election Symbol:</strong> ${party.symbol}</div>
        <div><strong>PAN:</strong> <code>${party.pan}</code></div>
      </div>
      <div style="margin-top:8px; font-size:.75rem; color:var(--ink-muted);">
        <strong>Headquarters:</strong> ${party.headquarters}
      </div>
    </div>

    <!-- Assembly Standing & Political Context (from MLA Digital Twin) -->
    ${party.assembly_role ? `
      <div style="background:var(--surface-2); border-radius:var(--r-md); padding:14px; margin-bottom:16px; border:1px solid var(--ring);">
        <div style="font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-muted); margin-bottom:6px; font-weight:700;">17th Tamil Nadu Legislative Assembly Standing</div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span class="badge-tag ${party.assembly_standing === 'government' ? 'assembly-govt' : (party.assembly_standing === 'opposition' ? 'assembly-opp' : (party.assembly_standing === 'neutral' ? 'assembly-neutral' : 'assembly-support'))}">
            ${party.assembly_role}
          </span>
        </div>
        ${party.assembly_notes ? `<div style="font-size:.78rem; color:var(--ink-2); line-height:1.45;">${party.assembly_notes}</div>` : ''}
      </div>
    ` : ''}

    <!-- Financial Highlights Grid -->
    <div class="party-stats-grid" style="margin-bottom:16px;">
      <div class="party-stat-item">
        <small>General Reserves</small>
        <b style="color:${party.color}; font-size:1.15rem;">₹${formatCr(party.general_fund_cr)} Cr</b>
      </div>
      <div class="party-stat-item">
        <small>Total Electoral Bonds</small>
        <b style="font-size:1.15rem;">₹${formatCr(party.eb_total_cr)} Cr</b>
      </div>
      <div class="party-stat-item">
        <small>Latest FY Income</small>
        <b>₹${formatCr(party.latest_income_cr)} Cr</b>
      </div>
      <div class="party-stat-item">
        <small>Latest FY Expenditure</small>
        <b>₹${formatCr(party.latest_expenditure_cr)} Cr</b>
      </div>
    </div>

    <!-- Statutory Auditor Note -->
    <div style="border:1px solid var(--ring); border-radius:var(--r-md); padding:10px 14px; background:var(--surface-2); margin-bottom:18px; font-size:.78rem;">
      <strong>Statutory Auditor:</strong> ${party.auditor}
    </div>

    <!-- Multi-Year Financial History -->
    ${partySeries.length ? `
      <h4 style="font-size:.9rem; font-weight:700; margin-bottom:8px;">Multi-Year Financial Trajectory</h4>
      <table class="data-table" style="margin-bottom:18px;">
        <thead>
          <tr>
            <th>FY</th>
            <th style="text-align:right;">Income</th>
            <th style="text-align:right;">Expenditure</th>
            <th style="text-align:right;">Surplus/(Deficit)</th>
            <th style="text-align:right;">Reserves</th>
          </tr>
        </thead>
        <tbody>
          ${partySeries.map(s => `
            <tr>
              <td><strong>${s.fy}</strong></td>
              <td class="num">₹${formatCr(s.income_cr)} Cr</td>
              <td class="num">₹${formatCr(s.expenditure_cr)} Cr</td>
              <td class="num" style="color:${s.surplus_cr >= 0 ? 'var(--good)' : 'var(--critical)'};">
                ${s.surplus_cr >= 0 ? '+' : ''}₹${formatCr(s.surplus_cr)} Cr
              </td>
              <td class="num" style="font-weight:650;">₹${formatCr(s.general_fund_cr)} Cr</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- Official Documents -->
    <h4 style="font-size:.9rem; font-weight:700; margin-bottom:8px;">Official ECI Document Filings (${partyDocs.length})</h4>
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${partyDocs.slice(0, 15).map(d => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--surface-2); border-radius:var(--r-sm); font-size:.75rem;">
          <div>
            <div style="font-weight:600;">${d.title}</div>
            <div style="color:var(--ink-muted);">${d.category} · ${d.year_group}</div>
          </div>
          <a class="btn-download" href="${d.pdf_url}" target="_blank" rel="noopener noreferrer">
            <svg class="ic-inline"><use href="#i-external"></use></svg> PDF
          </a>
        </div>
      `).join('')}
    </div>
  `;

  modalBody.innerHTML = bodyHtml;
  modalOverlay.classList.add('open');
};

window.closePartyModal = function() {
  const modalOverlay = document.getElementById('party-modal');
  if (modalOverlay) modalOverlay.classList.remove('open');
};

// ==========================================
// TAB 7: PAN-INDIA POLITICAL PARTIES MAP & DIRECTORY
// ==========================================

function getStatusBadgeClass(status) {
  if (status === 'Recognized National') return 'status-national';
  if (status === 'Recognized State') return 'status-state';
  if (status === 'Registered Unrecognized (RUPP)') return 'status-rupp';
  if (status === 'Inactive') return 'status-inactive';
  if (status === 'Delisted / Cancelled') return 'status-delisted';
  return 'status-rupp';
}

function getFilteredAllIndiaParties() {
  let list = allIndiaParties;

  if (mapStatusFilter !== 'ALL') {
    list = list.filter(p => p.status === mapStatusFilter);
  }

  if (mapStateFilter !== 'ALL') {
    list = list.filter(p => p.state === mapStateFilter);
  }

  if (mapSearchQuery.trim()) {
    const q = mapSearchQuery.toLowerCase().trim();
    list = list.filter(p => 
      p.party_name.toLowerCase().includes(q) ||
      (p.short_name && p.short_name.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.pincode && p.pincode.includes(q)) ||
      (p.district && p.district.toLowerCase().includes(q)) ||
      (p.symbol && p.symbol.toLowerCase().includes(q)) ||
      (p.delisted_reason && p.delisted_reason.toLowerCase().includes(q))
    );
  }

  return list;
}

function renderPanIndiaMapTab(container) {
  // If data not loaded yet, fetch and show loading card
  if (allIndiaParties.length === 0) {
    container.innerHTML = `
      <div class="callout-card info" style="margin: 30px 0; text-align: center; padding: 40px 20px;">
        <h3 style="font-size: 1.15rem; margin-bottom: 8px;">Loading Pan-India Political Parties Database...</h3>
        <p style="color: var(--ink-2); font-size: .875rem;">
          Fetching 3,216 geocoded political parties from official ECI gazette notifications and delisting orders...
        </p>
      </div>
    `;

    Promise.all([
      fetch('/data/all_india_parties.json').then(r => r.json()),
      fetch('/data/india-states.geojson').then(r => r.json())
    ]).then(([parties, geojson]) => {
      allIndiaParties = parties;
      allIndiaGeoJson = geojson;
      renderPanIndiaMapTab(container);
    }).catch(err => {
      container.innerHTML = `
        <div class="callout-card critical" style="margin: 20px 0;">
          <h4>Failed to load Pan-India parties dataset</h4>
          <p>${err.message}</p>
        </div>
      `;
    });
    return;
  }

  const summary = allIndiaSummary || {
    total_parties: allIndiaParties.length,
    by_status: {
      'Recognized National': 6,
      'Recognized State': 51,
      'Registered Unrecognized (RUPP)': 2403,
      'Inactive': 251,
      'Delisted / Cancelled': 505
    },
    by_state: {}
  };

  const filteredParties = getFilteredAllIndiaParties();
  const totalPages = Math.ceil(filteredParties.length / mapTablePageSize) || 1;
  if (mapTablePage > totalPages) mapTablePage = 1;
  const startIdx = (mapTablePage - 1) * mapTablePageSize;
  const pageParties = filteredParties.slice(startIdx, startIdx + mapTablePageSize);

  // States list sorted by total count
  const stateCounts = summary.by_state || {};
  const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);

  let html = `
    <!-- Header & Action Row -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
      <div>
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
          <svg class="ic-inline" style="width:1.25em; height:1.25em;"><use href="#i-globe"></use></svg> Pan-India Political Parties Master Registry & Geocoded Map
        </h2>
        <p style="color:var(--ink-2); font-size:.875rem; max-width:850px;">
          Every political party to ever exist in independent India (3,218 entities), complete with official registered headquarters address, postal PIN codes, recognition status, and Supreme Court/ECI delisting orders. Sourced from the Election Commission of India Gazette Notifications (Table I, II, III) and Orders (2016–2026).
        </p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <a href="/data/all_india_parties.csv" download="all_india_parties.csv" class="pill-btn active" style="text-decoration:none; padding:8px 16px;">
          <svg class="ic-inline"><use href="#i-download"></use></svg> Download Full CSV (3,218 Parties)
        </a>
      </div>
    </div>

    <!-- Status KPI Tiles -->
    <div class="tiles" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 20px;">
      <div class="tile" style="cursor:pointer;" onclick="setMapStatus('ALL')">
        <small class="sub">Total Parties Registered</small>
        <div class="num" style="color:var(--brand-tn);">${(summary.total_parties || 3218).toLocaleString()}</div>
        <small class="sub">All 28 States & 8 UTs</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setMapStatus('Recognized National')">
        <small class="sub">Recognized National</small>
        <div class="num" style="color:#9333ea;">${summary.by_status['Recognized National'] || 6}</div>
        <small class="sub">AAP, BSP, BJP, CPI(M), INC, NPP</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setMapStatus('Recognized State')">
        <small class="sub">Recognized State</small>
        <div class="num" style="color:#10b981;">${summary.by_status['Recognized State'] || 51}</div>
        <small class="sub">DMK, AIADMK, TMC, NCP, SP, etc.</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setMapStatus('Registered Unrecognized (RUPP)')">
        <small class="sub">Registered Unrecog. (RUPP)</small>
        <div class="num" style="color:#3b82f6;">${(summary.by_status['Registered Unrecognized (RUPP)'] || 2405).toLocaleString()}</div>
        <small class="sub">Active Free-Symbol Parties</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setMapStatus('Inactive')">
        <small class="sub">Declared Inactive</small>
        <div class="num" style="color:#f59e0b;">${summary.by_status['Inactive'] || 251}</div>
        <small class="sub">Uncontested for 6+ Years</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setMapStatus('Delisted / Cancelled')">
        <small class="sub">Delisted / Cancelled</small>
        <div class="num" style="color:#ef4444;">${summary.by_status['Delisted / Cancelled'] || 505}</div>
        <small class="sub">Postal Returned / Fake Address</small>
      </div>
    </div>

    <!-- Map Visualization Controls: Choropleth Mode & Markers -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; background:var(--surface); border:1px solid var(--grid); border-radius:var(--r-md); padding:10px 14px;">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-size:.78rem; font-weight:700; color:var(--ink-muted); text-transform:uppercase; letter-spacing:.04em;">Map Mode:</span>
        <div class="pill-group">
          <button class="pill-btn ${mapChoroplethMode === 'recognized-state' ? 'active' : ''}" onclick="setMapChoroplethMode('recognized-state')">
            <svg class="ic-inline"><use href="#i-grid"></use></svg> Recognized State Parties Choropleth
          </button>
          <button class="pill-btn ${mapChoroplethMode === 'total-parties' ? 'active' : ''}" onclick="setMapChoroplethMode('total-parties')">
            <svg class="ic-inline"><use href="#i-chart"></use></svg> Total Parties Density (3,218)
          </button>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <button class="pill-btn ${mapShowPins ? 'active' : ''}" onclick="toggleMapPins()">
          <svg class="ic-inline"><use href="#i-map-pin"></use></svg> ${mapShowPins ? 'Hide Headquarters Pins' : 'Show Headquarters Pins'}
        </button>
      </div>
    </div>

    <!-- Filter Control Bar -->
    <div style="background:var(--surface); border:1px solid var(--grid); border-radius:var(--r-md); padding:14px 16px; margin-bottom:16px; display:flex; flex-direction:column; gap:12px;">
      <!-- Row 1: Status pills -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div class="pill-group" style="flex-wrap:wrap;">
          <button class="pill-btn ${mapStatusFilter === 'ALL' ? 'active' : ''}" onclick="setMapStatus('ALL')">All Statuses (${summary.total_parties})</button>
          <button class="pill-btn ${mapStatusFilter === 'Recognized National' ? 'active' : ''}" onclick="setMapStatus('Recognized National')">National (${summary.by_status['Recognized National']})</button>
          <button class="pill-btn ${mapStatusFilter === 'Recognized State' ? 'active' : ''}" onclick="setMapStatus('Recognized State')">State Recognized (${summary.by_status['Recognized State']})</button>
          <button class="pill-btn ${mapStatusFilter === 'Registered Unrecognized (RUPP)' ? 'active' : ''}" onclick="setMapStatus('Registered Unrecognized (RUPP)')">RUPPs (${summary.by_status['Registered Unrecognized (RUPP)']})</button>
          <button class="pill-btn ${mapStatusFilter === 'Inactive' ? 'active' : ''}" onclick="setMapStatus('Inactive')">Inactive (${summary.by_status['Inactive']})</button>
          <button class="pill-btn ${mapStatusFilter === 'Delisted / Cancelled' ? 'active' : ''}" onclick="setMapStatus('Delisted / Cancelled')">Delisted / Cancelled (${summary.by_status['Delisted / Cancelled']})</button>
        </div>

        ${(mapStatusFilter !== 'ALL' || mapStateFilter !== 'ALL' || mapSearchQuery) ? `
          <button class="pill-btn" onclick="resetMapFilters()" style="color:var(--brand-tn);">
            <svg class="ic-inline"><use href="#i-close"></use></svg> Clear Filters
          </button>
        ` : ''}
      </div>

      <!-- Row 2: State Dropdown & Live Search -->
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;">
          <label for="map-state-select" style="font-size:.8125rem; font-weight:600; color:var(--ink-2); white-space:nowrap;">
            <svg class="ic-inline"><use href="#i-map-pin"></use></svg> Filter State/UT:
          </label>
          <select id="map-state-select" onchange="setMapState(this.value)" style="padding:6px 12px; border-radius:9999px; border:1px solid var(--ring); background:var(--surface-2); color:var(--ink); font-size:.8125rem;">
            <option value="ALL">All States & UTs (Pan-India)</option>
            ${sortedStates.map(([sName, count]) => `
              <option value="${sName}" ${mapStateFilter === sName ? 'selected' : ''}>${sName} (${count})</option>
            `).join('')}
          </select>
        </div>

        <div style="flex:1; min-width:240px; position:relative;">
          <input 
            type="text" 
            id="map-search-input" 
            class="table-search-input" 
            placeholder="Search party name, PIN code, address, symbol, or delisting reason..."
            value="${mapSearchQuery}"
            oninput="setMapSearch(this.value)"
            style="width:100%; padding:7px 14px 7px 34px; border-radius:9999px; border:1px solid var(--ring); background:var(--surface-2); color:var(--ink); font-size:.8125rem;"
          >
          <svg class="ic-inline" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--ink-muted); pointer-events:none;">
            <use href="#i-filter"></use>
          </svg>
        </div>
      </div>
    </div>

    <!-- Map & State Sidebar Grid -->
    <div class="map-layout-grid">
      <!-- Left: Leaflet Map Container -->
      <div class="map-wrapper">
        <div id="pan-india-map"></div>
        <div class="map-floating-legend" id="map-legend-box">
          <!-- Dynamically populated in initLeafletMap -->
        </div>
      </div>

      <!-- Right: State Distribution Leaderboard -->
      <div style="background:var(--surface); border:1px solid var(--grid); border-radius:var(--r-lg); padding:16px; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:.9rem; font-weight:700;">Parties by State/UT</h4>
          <span style="font-size:.75rem; color:var(--ink-muted);">${sortedStates.length} Regions</span>
        </div>
        <div class="state-sidebar-list">
          <div 
            class="state-sidebar-item ${mapStateFilter === 'ALL' ? 'selected' : ''}" 
            onclick="setMapState('ALL')"
          >
            <strong>All India (Total)</strong>
            <span class="count-pill">${summary.total_parties}</span>
          </div>
          ${sortedStates.map(([sName, count]) => `
            <div 
              class="state-sidebar-item ${mapStateFilter === sName ? 'selected' : ''}" 
              onclick="setMapState('${sName}')"
            >
              <span>${sName}</span>
              <span class="count-pill">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Paginated Parties Directory Table -->
    <div style="margin-top:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">
            Political Parties Directory 
            <span style="font-weight:400; font-size:.875rem; color:var(--ink-2);">
              (Showing ${filteredParties.length === 0 ? 0 : startIdx + 1}–${Math.min(startIdx + mapTablePageSize, filteredParties.length)} of ${filteredParties.length.toLocaleString()} parties)
            </span>
          </h3>
        </div>
        
        <!-- Pagination Controls -->
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="pill-btn" onclick="changeMapPage(-1)" ${mapTablePage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            &larr; Previous
          </button>
          <span style="font-size:.8125rem; font-weight:600; color:var(--ink-2); padding:0 4px;">
            Page ${mapTablePage} of ${totalPages}
          </span>
          <button class="pill-btn" onclick="changeMapPage(1)" ${mapTablePage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            Next &rarr;
          </button>
        </div>
      </div>

      <div class="table-card">
        <table class="parties-table">
          <thead>
            <tr>
              <th style="width:50px;">#</th>
              <th>Party Name</th>
              <th>Status</th>
              <th>State / UT</th>
              <th>District</th>
              <th>PIN Code</th>
              <th>Headquarters Postal Address</th>
              <th>Symbol</th>
              <th style="text-align:center;">Map</th>
            </tr>
          </thead>
          <tbody>
            ${pageParties.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align:center; padding:30px; color:var(--ink-muted);">
                  No political parties match the active filter criteria. Try clearing filters or searching another keyword.
                </td>
              </tr>
            ` : pageParties.map((p, idx) => `
              <tr>
                <td style="color:var(--ink-muted); font-size:.75rem;">${startIdx + idx + 1}</td>
                <td>
                  <strong style="color:var(--ink);">${p.party_name}</strong>
                  ${p.short_name ? `<span style="font-size:.75rem; color:var(--ink-2); margin-left:4px;">(${p.short_name})</span>` : ''}
                  <div style="font-size:.7rem; color:var(--ink-muted); font-family:monospace;">${p.party_id}</div>
                  ${p.delisted_reason ? `
                    <div style="font-size:.7rem; color:var(--critical); margin-top:2px;">
                      <span class="status-badge status-delisted" style="padding:1px 6px; font-size:.65rem;">Delisted</span> ${p.delisted_order || ''} · ${p.delisted_reason}
                    </div>
                  ` : ''}
                </td>
                <td>
                  <span class="status-badge ${getStatusBadgeClass(p.status)}">${p.status}</span>
                </td>
                <td><strong>${p.state}</strong></td>
                <td>${p.district || '<span style="color:var(--ink-muted);">-</span>'}</td>
                <td class="num" style="font-family:monospace;">${p.pincode || '<span style="color:var(--ink-muted);">-</span>'}</td>
                <td style="font-size:.78rem; max-width:280px; line-height:1.35; color:var(--ink-2);">${p.address}</td>
                <td style="font-size:.78rem;">${p.symbol || '<span style="color:var(--ink-muted);">-</span>'}</td>
                <td style="text-align:center;">
                  <button class="pill-btn" onclick="zoomToParty('${p.party_id}')" style="padding:4px 10px; font-size:.75rem;" title="Locate on Map">
                    <svg class="ic-inline"><use href="#i-map-pin"></use></svg>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Initialize or re-render Leaflet Map after DOM insertion
  setTimeout(() => {
    initLeafletMap();
  }, 50);
}

// Leaflet Map Initialization and State Choropleth (Recognized State Parties Mode)
function initLeafletMap() {
  const mapEl = document.getElementById('pan-india-map');
  if (!mapEl || typeof L === 'undefined') return;

  if (indiaMap) {
    try {
      indiaMap.remove();
    } catch (e) {}
    indiaMap = null;
  }

  // Centered on India
  indiaMap = L.map('pan-india-map', {
    center: [22.8, 80.0],
    zoom: 5,
    minZoom: 4,
    maxZoom: 16,
    scrollWheelZoom: true
  });

  // Base Map Layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(indiaMap);

  // Standardize state naming between GeoJSON and party records
  const stateGeoAliases = {
    'Orissa': 'Odisha',
    'Uttaranchal': 'Uttarakhand',
    'Andaman and Nicobar': 'Andaman & Nicobar Islands',
    'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
    'Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  };

  // Pre-calculate Recognized State Parties by State
  const recognizedByState = {};
  if (allIndiaParties) {
    allIndiaParties.forEach(p => {
      if (p.status === 'Recognized State') {
        const st = p.state || 'Unknown';
        if (!recognizedByState[st]) recognizedByState[st] = [];
        recognizedByState[st].push({
          party_name: p.party_name,
          short_name: p.short_name,
          symbol: p.symbol,
          party_id: p.party_id
        });
      }
    });
  }

  // Color functions
  function getRecognizedStateColor(count) {
    if (count >= 4) return '#065f46'; // Assam (4), Maharashtra (4)
    if (count === 3) return '#059669'; // TN (3), Bihar (3), UP (3), Kerala (3), Meghalaya (3), Mizoram (3)
    if (count === 2) return '#10b981'; // AP (2), WB (2), JK (2), Jharkhand (2), Sikkim (2), Tripura (2), Goa (2), Puducherry (2), Arunachal (2)
    if (count === 1) return '#6ee7b7'; // Punjab (1), Haryana (1), Odisha (1), Nagaland (1), Manipur (1)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? '#27272a' : '#e2e8f0'; // 0: National / RUPPs only
  }

  function getTotalPartiesColor(d) {
    return d > 500 ? '#7f1d1d' :
           d > 200 ? '#991b1b' :
           d > 100 ? '#dc2626' :
           d > 50  ? '#ea580c' :
           d > 20  ? '#f59e0b' :
           d > 5   ? '#10b981' :
                     '#64748b';
  }

  // Choropleth GeoJSON Layer
  if (allIndiaGeoJson && allIndiaSummary) {
    const stateCounts = allIndiaSummary.by_state || {};

    function style(feature) {
      const rawName = feature.properties.NAME_1;
      const sName = stateGeoAliases[rawName] || rawName;
      const isSelected = (mapStateFilter === sName);

      if (mapChoroplethMode === 'recognized-state') {
        const count = recognizedByState[sName] ? recognizedByState[sName].length : 0;
        return {
          fillColor: getRecognizedStateColor(count),
          weight: isSelected ? 3 : 1.2,
          opacity: 1,
          color: isSelected ? '#047857' : (isSelected ? '#059669' : 'rgba(5, 150, 105, 0.4)'),
          fillOpacity: isSelected ? 0.85 : 0.65
        };
      } else {
        const count = stateCounts[sName] || 0;
        return {
          fillColor: getTotalPartiesColor(count),
          weight: isSelected ? 2.5 : 1,
          opacity: 1,
          color: isSelected ? '#d90429' : 'rgba(100,116,139,0.5)',
          dashArray: isSelected ? '' : '2',
          fillOpacity: isSelected ? 0.65 : 0.28
        };
      }
    }

    mapGeoJsonLayer = L.geoJson(allIndiaGeoJson, {
      style: style,
      onEachFeature: function(feature, layer) {
        const rawName = feature.properties.NAME_1;
        const sName = stateGeoAliases[rawName] || rawName;
        const totalRegistered = stateCounts[sName] || 0;
        const stateParties = recognizedByState[sName] || [];
        const statePartyCount = stateParties.length;

        // Rich glassy tooltip with state parties & reserved symbols
        let tooltipHtml = '';
        if (mapChoroplethMode === 'recognized-state') {
          tooltipHtml = `
            <div class="map-tooltip-title">
              <span>${sName}</span>
              <span class="status-badge status-state" style="font-size:.7rem;">${statePartyCount} State ${statePartyCount === 1 ? 'Party' : 'Parties'}</span>
            </div>
          `;
          if (statePartyCount > 0) {
            tooltipHtml += `<ul class="map-tooltip-party-list">`;
            stateParties.forEach(p => {
              tooltipHtml += `
                <li class="map-tooltip-party-item">
                  <span class="map-tooltip-party-name">${p.party_name} ${p.short_name ? `(${p.short_name})` : ''}</span>
                  <span class="map-tooltip-symbol">Reserved Symbol: <strong>${p.symbol || 'Free Symbol'}</strong></span>
                </li>
              `;
            });
            tooltipHtml += `</ul>`;
          } else {
            tooltipHtml += `
              <div style="font-size:.76rem; color:var(--ink-muted); margin:4px 0 6px 0;">
                No Recognized State Parties. Dominant representation by National Parties (BJP, INC, AAP) and RUPPs.
              </div>
            `;
          }
          tooltipHtml += `
            <div class="map-tooltip-meta">
              <span>${totalRegistered.toLocaleString()} total registered parties</span>
              <span style="font-weight:600; color:var(--series-1);">Click to filter</span>
            </div>
          `;
        } else {
          tooltipHtml = `
            <div class="map-tooltip-title">
              <span>${sName}</span>
              <span class="status-badge status-national">${totalRegistered} Parties</span>
            </div>
            <div style="font-size:.76rem; color:var(--ink-2); margin:4px 0;">
              Total registered political parties headquartered in ${sName}.
            </div>
            <div class="map-tooltip-meta">
              <span>${statePartyCount} Recognized State Parties</span>
              <span style="font-weight:600; color:var(--series-1);">Click to filter</span>
            </div>
          `;
        }

        layer.bindTooltip(tooltipHtml, {
          sticky: true,
          className: 'map-tooltip'
        });

        layer.on({
          mouseover: function(e) {
            const l = e.target;
            l.setStyle({
              weight: 2.8,
              color: '#059669',
              fillOpacity: 0.85
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              l.bringToFront();
            }
          },
          mouseout: function(e) {
            mapGeoJsonLayer.resetStyle(e.target);
          },
          click: function() {
            setMapState(mapStateFilter === sName ? 'ALL' : sName);
            if (mapStateFilter !== 'ALL') {
              try {
                indiaMap.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 8 });
              } catch (err) {}
            }
          }
        });
      }
    }).addTo(indiaMap);
  }

  // Update floating legend box
  const legendBox = document.getElementById('map-legend-box');
  if (legendBox) {
    if (mapChoroplethMode === 'recognized-state') {
      legendBox.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px; font-size:.78rem; border-bottom:1px solid var(--ring); padding-bottom:3px;">
          Recognized State Parties
        </div>
        <div class="legend-item"><span class="legend-dot" style="background:#065f46;"></span> 4 Parties (Assam, Maharashtra)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#059669;"></span> 3 Parties (Tamil Nadu, Bihar, UP, Kerala, Meghalaya, Mizoram)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#10b981;"></span> 2 Parties (AP, WB, JK, Jharkhand, Sikkim, Tripura, Goa, Puducherry, Arunachal)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#6ee7b7;"></span> 1 Party (Punjab, Haryana, Odisha, Nagaland, Manipur)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#e2e8f0; border:1px solid #cbd5e1;"></span> 0 Parties (National / RUPPs Only)</div>
        <div style="font-size:.7rem; color:var(--ink-muted); margin-top:4px; border-top:1px dashed var(--ring); padding-top:4px;">
          Click state polygon to zoom & filter directory
        </div>
      `;
    } else {
      legendBox.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px; font-size:.78rem; border-bottom:1px solid var(--ring); padding-bottom:3px;">
          Total Registered Parties
        </div>
        <div class="legend-item"><span class="legend-dot" style="background:#7f1d1d;"></span> &gt; 500 Parties (UP 803)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#991b1b;"></span> 201–500 Parties (Delhi 394, TN 295, MH 228)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#dc2626;"></span> 101–200 Parties (Bihar, AP, Haryana)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#ea580c;"></span> 51–100 Parties (KA, MP, GJ, RJ, WB, PB, TS)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#f59e0b;"></span> 21–50 Parties (KL, JK, OD, JH, CT, AS, UK)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#10b981;"></span> 6–20 Parties (Goa, Sikkim, Meghalaya)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#64748b;"></span> 1–5 Parties (Northeast & UTs)</div>
      `;
    }
  }

  // Markers Layer Group
  mapMarkersLayer = L.layerGroup().addTo(indiaMap);
  if (mapShowPins) {
    updateMapMarkers();
  }
}

function updateMapMarkers() {
  if (!indiaMap || !mapMarkersLayer) return;
  mapMarkersLayer.clearLayers();
  mapMarkerIndex = {};

  if (!mapShowPins) return;

  const filtered = getFilteredAllIndiaParties();
  // Plot up to 1,500 active markers to keep rendering smooth and lightning fast
  const toPlot = filtered.slice(0, 1500);

  const statusColors = {
    'Recognized National': '#9333ea',
    'Recognized State': '#10b981',
    'Registered Unrecognized (RUPP)': '#3b82f6',
    'Inactive': '#f59e0b',
    'Delisted / Cancelled': '#ef4444'
  };

  toPlot.forEach(p => {
    if (!p.lat || !p.lon) return;

    const color = statusColors[p.status] || '#64748b';
    const radius = p.status === 'Recognized National' ? 8 : (p.status === 'Recognized State' ? 6 : 4);
    const weight = p.status.includes('Recognized') ? 2 : 1;

    const marker = L.circleMarker([p.lat, p.lon], {
      radius: radius,
      fillColor: color,
      color: '#fff',
      weight: weight,
      opacity: 0.9,
      fillOpacity: 0.8
    });

    const popupHtml = `
      <div style="min-width:240px; max-width:320px; padding:4px 2px;">
        <div style="margin-bottom:6px;">
          <span class="status-badge ${getStatusBadgeClass(p.status)}">${p.status}</span>
        </div>
        <div style="font-size:.95rem; font-weight:700; margin-bottom:4px; color:var(--ink); line-height:1.3;">
          ${p.party_name} ${p.short_name ? `(${p.short_name})` : ''}
        </div>
        <div style="font-size:.78rem; color:var(--ink-2); margin-bottom:6px;">
          <strong>State:</strong> ${p.state} ${p.district ? `· ${p.district}` : ''}
          ${p.pincode ? `· <strong>PIN:</strong> ${p.pincode}` : ''}
        </div>
        <div style="font-size:.75rem; color:var(--ink); background:var(--surface-2); padding:6px 8px; border-radius:6px; margin-bottom:6px; line-height:1.4;">
          ${p.address}
        </div>
        ${p.symbol ? `<div style="font-size:.75rem; color:var(--ink-2); margin-bottom:4px;"><strong>Symbol:</strong> ${p.symbol}</div>` : ''}
        ${p.delisted_order ? `
          <div style="font-size:.72rem; color:var(--critical); background:rgba(239,68,68,0.1); padding:5px 7px; border-radius:4px; margin-top:4px; line-height:1.3;">
            <b>Delisted:</b> ${p.delisted_order} (${p.delisted_date || ''})<br>
            <i>${p.delisted_reason || ''}</i>
          </div>
        ` : ''}
      </div>
    `;

    marker.bindPopup(popupHtml);
    mapMarkersLayer.addLayer(marker);
    mapMarkerIndex[p.party_id] = marker;
  });
}

// Map Controls Handlers
window.setMapChoroplethMode = function(mode) {
  mapChoroplethMode = mode;
  initLeafletMap();
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

window.toggleMapPins = function() {
  mapShowPins = !mapShowPins;
  if (mapShowPins) {
    updateMapMarkers();
  } else if (mapMarkersLayer) {
    mapMarkersLayer.clearLayers();
  }
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

// TAB: CHIEF ELECTORAL OFFICER TAMIL NADU RUPPS SUBMISSIONS (830 FILINGS)
function renderTnRuppsTab(container) {
  if (tnRuppFilings.length === 0) {
    container.innerHTML = `
      <div class="callout-card info" style="margin: 30px 0; text-align: center; padding: 40px 20px;">
        <h3 style="font-size: 1.15rem; margin-bottom: 8px;">Loading CEO Tamil Nadu RUPPs Database...</h3>
        <p style="color: var(--ink-2); font-size: .875rem;">
          Fetching 830 official contribution reports & audit statements from Chief Electoral Officer Tamil Nadu (erolls.tn.gov.in)...
        </p>
      </div>
    `;

    fetch('/data/tn_rupp_filings_erolls.json')
      .then(r => r.json())
      .then(data => {
        tnRuppFilings = data;
        renderTnRuppsTab(container);
      })
      .catch(err => {
        container.innerHTML = `
          <div class="callout-card critical" style="margin:20px 0;">
            <h4>Failed to load TN CEO RUPP filings</h4>
            <p>${err.message}</p>
          </div>
        `;
      });
    return;
  }

  // Calculate statistics
  const totalFilings = tnRuppFilings.length;
  const contribCount = tnRuppFilings.filter(f => f.category.includes('Contribution')).length;
  const auditCount = tnRuppFilings.filter(f => f.category.includes('Audit')).length;
  const yearsSet = Array.from(new Set(tnRuppFilings.map(f => f.year))).sort().reverse();

  // Filter filings
  let filtered = tnRuppFilings.filter(f => {
    if (tnRuppFilterCategory === 'Contribution' && !f.category.includes('Contribution')) return false;
    if (tnRuppFilterCategory === 'Audit' && !f.category.includes('Audit')) return false;
    if (tnRuppFilterYear !== 'ALL' && f.year !== tnRuppFilterYear) return false;
    if (tnRuppSearch) {
      const q = tnRuppSearch.toLowerCase().trim();
      const pName = (f.party_name || '').toLowerCase();
      const pMatch = pName.includes(q);
      const aMatch = (f.address || '').toLowerCase().includes(q);
      const aliasMatch = (q === 'tvk' && pName.includes('tamilaga vettri')) ||
                         (q === 'ammk' && pName.includes('amma makkal')) ||
                         (q === 'ntk' && pName.includes('naam tamilar')) ||
                         (q === 'mnm' && pName.includes('makkal needhi')) ||
                         (q === 'pmk' && pName.includes('pattali makkal')) ||
                         (q === 'dmdk' && pName.includes('desiya murpokku'));
      if (!pMatch && !aMatch && !aliasMatch) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / tnRuppPageSize) || 1;
  if (tnRuppPage > totalPages) tnRuppPage = 1;
  const startIdx = (tnRuppPage - 1) * tnRuppPageSize;
  const pageFilings = filtered.slice(startIdx, startIdx + tnRuppPageSize);

  let html = `
    <!-- Header & Action Row -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
      <div>
        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
          <svg class="ic-inline" style="width:1.2em; height:1.2em;"><use href="#i-building"></use></svg> Chief Electoral Officer Tamil Nadu RUPPs Transparency Portal
        </h2>
        <p style="color:var(--ink-2); font-size:.875rem; max-width:850px;">
          Official public records scraped directly from the CEO Tamil Nadu portal (erolls.tn.gov.in/dashboard/RUPPs.aspx & RUPPs_Submitted.aspx). Contains 830 statutory filings across 13 financial years (2013-14 through 2025-26) with direct official PDF links, filing dates, and declared contribution amounts.
        </p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <a href="https://www.erolls.tn.gov.in/dashboard/RUPPs.aspx" target="_blank" rel="noopener noreferrer" class="pill-btn active" style="text-decoration:none; padding:8px 16px;">
          <svg class="ic-inline"><use href="#i-external"></use></svg> Official CEO TN Portal
        </a>
      </div>
    </div>

    <!-- KPI Tiles -->
    <div class="tiles" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 20px;">
      <div class="tile" style="cursor:pointer;" onclick="setTnRuppCategory('ALL')">
        <small class="sub">Total Submissions Scraped</small>
        <div class="num" style="color:var(--brand-tn);">${totalFilings.toLocaleString()}</div>
        <small class="sub">13 Financial Years (2013–2026)</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setTnRuppCategory('Contribution')">
        <small class="sub">Form 24A Contribution Reports</small>
        <div class="num" style="color:#10b981;">${contribCount.toLocaleString()}</div>
        <small class="sub">Sec 29C RP Act Filings</small>
      </div>
      <div class="tile" style="cursor:pointer;" onclick="setTnRuppCategory('Audit')">
        <small class="sub">Annual Audit Statements</small>
        <div class="num" style="color:#3b82f6;">${auditCount.toLocaleString()}</div>
        <small class="sub">Sec 139(4B) IT Act Balance Sheets</small>
      </div>
      <div class="tile">
        <small class="sub">TVK Submissions On Record</small>
        <div class="num" style="color:#8e44ad;">3 Filings</div>
        <small class="sub">FY25 & FY26 Form 24A + Audit</small>
      </div>
    </div>

    <!-- Filter Bar -->
    <div style="background:var(--surface); border:1px solid var(--grid); border-radius:var(--r-md); padding:14px 16px; margin-bottom:16px; display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <!-- Category Filter Pills -->
        <div class="pill-group" style="flex-wrap:wrap;">
          <button class="pill-btn ${tnRuppFilterCategory === 'ALL' ? 'active' : ''}" onclick="setTnRuppCategory('ALL')">All Filings (${totalFilings})</button>
          <button class="pill-btn ${tnRuppFilterCategory === 'Contribution' ? 'active' : ''}" onclick="setTnRuppCategory('Contribution')">Form 24A Contributions (${contribCount})</button>
          <button class="pill-btn ${tnRuppFilterCategory === 'Audit' ? 'active' : ''}" onclick="setTnRuppCategory('Audit')">Annual Audit Reports (${auditCount})</button>
        </div>

        ${(tnRuppFilterCategory !== 'ALL' || tnRuppFilterYear !== 'ALL' || tnRuppSearch) ? `
          <button class="pill-btn" onclick="resetTnRuppFilters()" style="color:var(--brand-tn);">
            <svg class="ic-inline"><use href="#i-close"></use></svg> Clear Filters
          </button>
        ` : ''}
      </div>

      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <!-- Year Dropdown -->
        <div style="display:flex; align-items:center; gap:8px;">
          <label for="rupp-year-select" style="font-size:.8125rem; font-weight:600; color:var(--ink-2); white-space:nowrap;">
            Financial Year:
          </label>
          <select id="rupp-year-select" onchange="setTnRuppYear(this.value)" style="padding:6px 12px; border-radius:9999px; border:1px solid var(--ring); background:var(--surface-2); color:var(--ink); font-size:.8125rem;">
            <option value="ALL">All Financial Years (2013–2026)</option>
            ${yearsSet.map(y => `
              <option value="${y}" ${tnRuppFilterYear === y ? 'selected' : ''}>FY ${y}</option>
            `).join('')}
          </select>
        </div>

        <!-- Search Input -->
        <div style="flex:1; min-width:240px; position:relative;">
          <input 
            type="text" 
            id="rupp-search-input" 
            class="table-search-input" 
            placeholder="Search party name or Chennai/TN postal address..."
            value="${tnRuppSearch}"
            oninput="setTnRuppSearch(this.value)"
            style="width:100%; padding:7px 14px 7px 34px; border-radius:9999px; border:1px solid var(--ring); background:var(--surface-2); color:var(--ink); font-size:.8125rem;"
          >
          <svg class="ic-inline" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--ink-muted); pointer-events:none;">
            <use href="#i-filter"></use>
          </svg>
        </div>
      </div>
    </div>

    <!-- Paginated Results Table -->
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
        <h3 style="font-size:1.05rem; font-weight:700;">
          Official CEO Tamil Nadu Submissions 
          <span style="font-weight:400; font-size:.85rem; color:var(--ink-2);">
            (Showing ${filtered.length === 0 ? 0 : startIdx + 1}–${Math.min(startIdx + tnRuppPageSize, filtered.length)} of ${filtered.length.toLocaleString()} filings)
          </span>
        </h3>

        <!-- Pagination -->
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="pill-btn" onclick="changeTnRuppPage(-1)" ${tnRuppPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            &larr; Previous
          </button>
          <span style="font-size:.8125rem; font-weight:600; color:var(--ink-2); padding:0 4px;">
            Page ${tnRuppPage} of ${totalPages}
          </span>
          <button class="pill-btn" onclick="changeTnRuppPage(1)" ${tnRuppPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            Next &rarr;
          </button>
        </div>
      </div>

      <div class="table-card">
        <table class="rupp-table">
          <thead>
            <tr>
              <th style="width:50px;">#</th>
              <th>Registered Political Party Name & Headquarters</th>
              <th>Financial Year</th>
              <th>Report Category</th>
              <th>Filing Date</th>
              <th>Declared Amount</th>
              <th style="text-align:center;">Official PDF Document</th>
            </tr>
          </thead>
          <tbody>
            ${pageFilings.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center; padding:30px; color:var(--ink-muted);">
                  No submissions match the active filter criteria. Try selecting another year or clearing filters.
                </td>
              </tr>
            ` : pageFilings.map((f, idx) => {
              const isTv = f.party_name && f.party_name.toLowerCase().includes('tamilaga vettri');
              const isAmmk = f.party_name && f.party_name.toLowerCase().includes('amma makkal');
              const matchedParty = isTv ? partiesData.find(p => p.id === 'TVK') : (isAmmk ? partiesData.find(p => p.id === 'AMMK') : null);
              return `
                <tr ${isTv ? 'style="background:rgba(163,38,90,0.06);"' : (isAmmk ? 'style="background:rgba(153,51,51,0.06);"' : '')}>
                  <td style="color:var(--ink-muted); font-size:.75rem;">${startIdx + idx + 1}</td>
                  <td>
                    <div style="display:flex; align-items:flex-start; gap:8px;">
                      ${matchedParty?.logo_url ? `<img class="party-table-logo" src="${matchedParty.logo_url}" alt="${matchedParty.symbol}">` : ''}
                      <div>
                        <strong style="color:var(--ink);">${f.party_name}</strong>
                        ${isTv ? `<span class="status-badge" style="background:var(--tvk-color); color:#fff; margin-left:6px; font-size:.68rem;">TVK (Vijay)</span>` : ''}
                        ${isAmmk ? `<span class="status-badge" style="background:#993333; color:#fff; margin-left:6px; font-size:.68rem;">AMMK (TTV Dhinakaran)</span>` : ''}
                        <div style="font-size:.72rem; color:var(--ink-muted); margin-top:2px; max-width:320px; line-height:1.3;">
                          ${f.address || 'Address on record with CEO Tamil Nadu'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style="font-weight:650; white-space:nowrap;">FY ${f.year}</td>
                  <td>
                    <span class="status-badge ${f.category.includes('Contribution') ? 'status-state' : 'status-rupp'}">
                      ${f.category}
                    </span>
                  </td>
                  <td style="font-family:monospace; font-size:.75rem;">${f.filing_date || '-'}</td>
                  <td class="num" style="font-weight:700;">
                    ${f.amount && f.amount > 0 ? `₹${(f.amount / 10000000).toFixed(2)} Cr` : '₹0.00 (Nil)'}
                  </td>
                  <td style="text-align:center;">
                    <a href="${f.pdf_url}" target="_blank" rel="noopener noreferrer" class="rupp-btn" title="View official PDF on erolls.tn.gov.in">
                      <svg class="ic-inline"><use href="#i-download"></use></svg> View PDF
                    </a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// TN RUPP Handlers
window.setTnRuppCategory = function(cat) {
  tnRuppFilterCategory = cat;
  tnRuppPage = 1;
  const container = document.getElementById('cards');
  if (container) renderTnRuppsTab(container);
};

window.setTnRuppYear = function(year) {
  tnRuppFilterYear = year;
  tnRuppPage = 1;
  const container = document.getElementById('cards');
  if (container) renderTnRuppsTab(container);
};

window.setTnRuppSearch = function(query) {
  tnRuppSearch = query;
  tnRuppPage = 1;
  const container = document.getElementById('cards');
  if (container) renderTnRuppsTab(container);
};

window.changeTnRuppPage = function(delta) {
  tnRuppPage += delta;
  const container = document.getElementById('cards');
  if (container) renderTnRuppsTab(container);
};

window.resetTnRuppFilters = function() {
  tnRuppFilterCategory = 'ALL';
  tnRuppFilterYear = 'ALL';
  tnRuppSearch = '';
  tnRuppPage = 1;
  const container = document.getElementById('cards');
  if (container) renderTnRuppsTab(container);
};

// Window Event Handlers for Map
window.setMapStatus = function(status) {
  mapStatusFilter = status;
  mapTablePage = 1;
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

window.setMapState = function(stateName) {
  mapStateFilter = stateName;
  mapTablePage = 1;
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

window.setMapSearch = function(query) {
  mapSearchQuery = query;
  mapTablePage = 1;
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

window.changeMapPage = function(delta) {
  mapTablePage += delta;
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

window.resetMapFilters = function() {
  mapStatusFilter = 'ALL';
  mapStateFilter = 'ALL';
  mapSearchQuery = '';
  mapTablePage = 1;
  const container = document.getElementById('cards');
  if (container) renderPanIndiaMapTab(container);
};

window.zoomToParty = function(partyId) {
  const marker = mapMarkerIndex[partyId];
  const party = allIndiaParties.find(p => p.party_id === partyId);
  if (!party) return;

  if (indiaMap && party.lat && party.lon) {
    indiaMap.setView([party.lat, party.lon], 12, { animate: true });
    if (marker) {
      setTimeout(() => marker.openPopup(), 250);
    }
    const mapEl = document.getElementById('pan-india-map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadData();
});
