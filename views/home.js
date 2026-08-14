function renderHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility Checker</title>
<style>
  :root{
    --bg:#F5F5F5;--surface:#FFFFFF;--border:#E2E4E8;--text:#0D0D0D;--muted:#6B7280;
    --green:#16A34A;--red:#DC2626;--amber:#CA8A04;
    --brand:#F5B000;--brand-dark:#111111;--brand-hover:#E0A000;
    --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    --mono:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;
  }
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.5;-webkit-font-smoothing:antialiased}
  a{color:inherit}
  :focus-visible{outline:2px solid var(--brand-dark);outline-offset:2px}

  .hdr{background:var(--brand-dark);border-bottom:3px solid var(--brand)}
  .hdr-inner{max-width:640px;margin:0 auto;padding:1.5rem 1.25rem}
  .hdr-title{margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.02em;color:#fff}
  .hdr-tag{margin:.3rem 0 0;font-size:.85rem;color:#9CA3AF}

  main{max-width:640px;margin:0 auto;padding:1.75rem 1.25rem 3rem}

  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.25rem}

  fieldset{border:0;margin:0;padding:0}
  legend{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:0 0 .75rem;width:100%}

  .url-row{display:flex;gap:.5rem;margin-bottom:.6rem}
  .url-row input{
    flex:1;min-width:0;font-family:var(--mono);font-size:.88rem;
    padding:.65rem .75rem;border:1px solid var(--border);border-radius:8px;
    background:var(--bg);color:var(--text);
  }
  .url-row input:focus{background:var(--surface);border-color:var(--brand-dark)}
  .url-row input:disabled{opacity:.6;cursor:not-allowed}
  .url-row input:invalid:not(:placeholder-shown){border-color:var(--red)}

  .remove-btn{
    flex-shrink:0;width:2.4rem;border:1px solid var(--border);border-radius:8px;
    background:var(--surface);color:var(--muted);font-size:1.1rem;cursor:pointer;line-height:1;
  }
  .remove-btn:hover:not(:disabled){border-color:var(--red);color:var(--red)}
  .remove-btn:disabled{opacity:.35;cursor:not-allowed}

  .add-btn{
    background:none;border:1px dashed var(--border);border-radius:8px;color:var(--muted);
    font-size:.82rem;font-weight:600;padding:.5rem .8rem;cursor:pointer;margin-top:.15rem;
  }
  .add-btn:hover:not(:disabled){border-color:var(--brand-dark);color:var(--brand-dark)}
  .add-btn:disabled{opacity:.5;cursor:not-allowed}

  .crawl-row{display:flex;align-items:flex-start;gap:.6rem;margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid var(--border)}
  .crawl-row[hidden]{display:none}
  .crawl-row input{margin-top:.2rem;flex-shrink:0;width:1.05rem;height:1.05rem;accent-color:var(--brand-dark)}
  .crawl-row label{font-size:.85rem;color:var(--text);cursor:pointer}
  .crawl-row .hint{display:block;font-size:.78rem;color:var(--muted);margin-top:.1rem}

  .submit-btn{
    width:100%;margin-top:1.25rem;padding:.85rem 1rem;border:none;border-radius:8px;
    background:var(--brand);color:var(--brand-dark);font-size:.95rem;font-weight:800;
    cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.6rem;
    transition:background .12s;
  }
  .submit-btn:hover:not(:disabled){background:var(--brand-hover)}
  .submit-btn:disabled{opacity:.75;cursor:not-allowed}

  .spinner{width:1rem;height:1rem;border-radius:50%;border:2px solid rgba(17,17,17,.25);border-top-color:var(--brand-dark);animation:spin .7s linear infinite;flex-shrink:0}
  @keyframes spin{to{transform:rotate(360deg)}}

  .scan-panel{display:flex;align-items:center;gap:1.1rem}
  .scan-panel[hidden]{display:none}
  .scan-icon{flex-shrink:0}
  .scan-sweep{animation:sweep 1.6s ease-in-out infinite}
  @keyframes sweep{0%,100%{transform:translateY(0)}50%{transform:translateY(28px)}}
  @media (prefers-reduced-motion: reduce){
    .scan-sweep{animation:none}
    .spinner{animation:none;border-top-color:rgba(17,17,17,.25)}
  }
  .scan-status{font-size:.88rem;color:var(--text);font-weight:600}
  .scan-status .sub{display:block;font-size:.78rem;font-weight:400;color:var(--muted);margin-top:.2rem}

  .result-panel[hidden],.error-panel[hidden]{display:none}
  .result-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.9rem}
  .result-head .dot{width:1.6rem;height:1.6rem;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
  .result-head h2{margin:0;font-size:1rem;font-weight:700}

  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.2rem}
  .stat{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.7rem .5rem;text-align:center}
  .stat .num{font-family:var(--mono);font-size:1.25rem;font-weight:700}
  .stat .lbl{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:.15rem}

  .result-actions{display:flex;gap:.6rem;flex-wrap:wrap}
  .btn-primary,.btn-secondary{
    flex:1;text-align:center;padding:.7rem 1rem;border-radius:8px;font-size:.85rem;font-weight:700;
    text-decoration:none;cursor:pointer;border:1px solid transparent;
  }
  .btn-primary{background:var(--brand-dark);color:#fff}
  .btn-primary:hover{background:#000}
  .btn-secondary{background:var(--surface);color:var(--text);border-color:var(--border)}
  .btn-secondary:hover{border-color:var(--brand-dark)}
  .json-link{display:inline-block;margin-top:.7rem;font-size:.78rem;color:var(--muted);text-decoration:underline}

  .error-panel{border-color:#FECACA;background:#FEF2F2}
  .error-panel p{margin:0;font-size:.88rem;color:var(--red)}

  footer{max-width:640px;margin:0 auto;padding:0 1.25rem 2rem;font-size:.75rem;color:var(--muted)}

  @media (max-width:420px){
    .stat-grid{grid-template-columns:1fr 1fr}
    .stat-grid .stat:last-child{grid-column:span 2}
  }
</style>
</head>
<body>

<header class="hdr">
  <div class="hdr-inner">
    <h1 class="hdr-title">Accessibility Checker</h1>
    <p class="hdr-tag">Scan a page for WCAG issues in seconds.</p>
  </div>
</header>

<main>
  <form id="scanForm" class="card" novalidate>
    <fieldset>
      <legend>URLs to scan</legend>
      <div id="urlRows"></div>
      <button type="button" id="addUrlBtn" class="add-btn">+ Add another URL</button>
    </fieldset>

    <div class="crawl-row" id="crawlRow" hidden>
      <input type="checkbox" id="crawlCheckbox" name="crawl">
      <label for="crawlCheckbox">
        Also scan pages one level deep from this URL
        <span class="hint">We'll follow links found on this page and check those too (up to 20 pages).</span>
      </label>
    </div>

    <button type="submit" id="scanBtn" class="submit-btn">Run accessibility scan</button>
  </form>

  <div class="card scan-panel" id="scanPanel" hidden role="status" aria-live="polite">
    <div class="scan-icon" aria-hidden="true">
      <svg width="56" height="42" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="62" height="46" rx="6" fill="#F5F5F5" stroke="#E2E4E8" stroke-width="2"/>
        <rect x="1" y="1" width="62" height="12" rx="6" fill="#111111"/>
        <path d="M1 7 L7 1 H57 A6 6 0 0 1 63 7 V13 H1 Z" fill="#111111"/>
        <circle cx="9" cy="7" r="2" fill="#DC2626"/>
        <circle cx="16" cy="7" r="2" fill="#CA8A04"/>
        <circle cx="23" cy="7" r="2" fill="#16A34A"/>
        <rect class="scan-sweep" x="1" y="15" width="62" height="3" fill="#F5B000"/>
      </svg>
    </div>
    <p class="scan-status" id="scanStatusText">Opening the page&hellip;<span class="sub" id="scanStatusSub">This can take a little longer for sites with several pages.</span></p>
  </div>

  <div class="card result-panel" id="resultPanel" hidden tabindex="-1">
    <div class="result-head">
      <span class="dot" aria-hidden="true">&#10003;</span>
      <h2 id="resultHeading">Scan complete</h2>
    </div>
    <div class="stat-grid" id="statGrid"></div>
    <div class="result-actions">
      <a class="btn-primary" id="viewReportLink" target="_blank" rel="noopener">View full report</a>
      <a class="btn-secondary" id="downloadReportLink" download>Download report</a>
    </div>
    <a class="json-link" id="downloadJsonLink" download>Download raw JSON</a>
  </div>

  <div class="card error-panel" id="errorPanel" hidden role="alert" tabindex="-1">
    <p id="errorText"></p>
  </div>
</main>

<footer>
  Reports are generated on demand and automatically deleted after 24 hours.
</footer>

<template id="urlRowTemplate">
  <div class="url-row">
    <label class="visually-hidden" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap"></label>
    <input type="url" placeholder="https://example.com" required autocomplete="off" spellcheck="false">
    <button type="button" class="remove-btn" aria-label="Remove this URL">&times;</button>
  </div>
</template>

<script>
(function(){
  var urlRows = document.getElementById('urlRows');
  var addUrlBtn = document.getElementById('addUrlBtn');
  var crawlRow = document.getElementById('crawlRow');
  var crawlCheckbox = document.getElementById('crawlCheckbox');
  var form = document.getElementById('scanForm');
  var scanBtn = document.getElementById('scanBtn');
  var scanPanel = document.getElementById('scanPanel');
  var scanStatusText = document.getElementById('scanStatusText');
  var scanStatusSub = document.getElementById('scanStatusSub');
  var resultPanel = document.getElementById('resultPanel');
  var errorPanel = document.getElementById('errorPanel');
  var errorText = document.getElementById('errorText');
  var statGrid = document.getElementById('statGrid');
  var viewReportLink = document.getElementById('viewReportLink');
  var downloadReportLink = document.getElementById('downloadReportLink');
  var downloadJsonLink = document.getElementById('downloadJsonLink');
  var rowTemplate = document.getElementById('urlRowTemplate');

  var isScanning = false;
  var statusInterval = null;
  var rowCount = 0;

  var STATUS_MESSAGES = [
    { main: 'Opening the page…', sub: 'This can take a little longer for sites with several pages.' },
    { main: 'Running accessibility checks…', sub: 'Testing against WCAG and custom rules.' },
    { main: 'Still working…', sub: 'Larger scans and multi-page crawls take a bit more time.' },
    { main: 'Almost there…', sub: 'Putting the report together.' }
  ];

  function addRow(focus){
    rowCount++;
    var node = rowTemplate.content.cloneNode(true);
    var row = node.querySelector('.url-row');
    var label = node.querySelector('label');
    var input = node.querySelector('input');
    var removeBtn = node.querySelector('.remove-btn');
    var id = 'url-input-' + rowCount;
    input.id = id;
    label.setAttribute('for', id);
    label.textContent = 'URL ' + rowCount;
    removeBtn.setAttribute('aria-label', 'Remove URL ' + rowCount);
    removeBtn.addEventListener('click', function(){
      row.remove();
      updateRowState();
      var remaining = urlRows.querySelectorAll('input');
      if (remaining.length) remaining[remaining.length - 1].focus();
    });
    urlRows.appendChild(node);
    updateRowState();
    if (focus) row.querySelector('input').focus();
  }

  function updateRowState(){
    var rows = urlRows.querySelectorAll('.url-row');
    var removeBtns = urlRows.querySelectorAll('.remove-btn');
    removeBtns.forEach(function(btn){ btn.disabled = rows.length <= 1; });
    crawlRow.hidden = rows.length !== 1;
    if (rows.length !== 1) crawlCheckbox.checked = false;
  }

  function normalizeUrl(raw){
    var value = raw.trim();
    if (value && !/^https?:\\/\\//i.test(value)) value = 'https://' + value;
    return value;
  }

  function collectUrls(){
    var inputs = Array.prototype.slice.call(urlRows.querySelectorAll('input'));
    return inputs.map(function(input){
      var normalized = normalizeUrl(input.value);
      input.value = normalized;
      return normalized;
    });
  }

  function setFormDisabled(disabled){
    var inputs = urlRows.querySelectorAll('input');
    inputs.forEach(function(input){ input.disabled = disabled; });
    urlRows.querySelectorAll('.remove-btn').forEach(function(btn){
      btn.disabled = disabled || urlRows.querySelectorAll('.url-row').length <= 1;
    });
    addUrlBtn.disabled = disabled;
    crawlCheckbox.disabled = disabled;
    scanBtn.disabled = disabled;
    scanBtn.innerHTML = disabled
      ? '<span class="spinner" aria-hidden="true"></span> Scanning…'
      : 'Run accessibility scan';
  }

  function startStatusRotation(){
    var i = 0;
    scanStatusText.innerHTML = STATUS_MESSAGES[0].main + '<span class="sub" id="scanStatusSub">' + STATUS_MESSAGES[0].sub + '</span>';
    statusInterval = setInterval(function(){
      i = (i + 1) % STATUS_MESSAGES.length;
      if (i === 0) return;
      scanStatusText.innerHTML = STATUS_MESSAGES[i].main + '<span class="sub">' + STATUS_MESSAGES[i].sub + '</span>';
    }, 5000);
  }

  function stopStatusRotation(){
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = null;
  }

  addUrlBtn.addEventListener('click', function(){ addRow(true); });
  addRow(false);

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (isScanning) return;

    var urls = collectUrls().filter(function(u){ return u.length > 0; });
    if (urls.length === 0 || !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    isScanning = true;
    resultPanel.hidden = true;
    errorPanel.hidden = true;
    scanPanel.hidden = false;
    setFormDisabled(true);
    startStatusRotation();

    var params = new URLSearchParams();
    urls.forEach(function(u){ params.append('url', u); });
    if (urls.length === 1) {
      params.append('crawl', crawlCheckbox.checked ? 'true' : 'false');
    }

    fetch('/audit?' + params.toString())
      .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
      .then(function(result){
        if (!result.ok || !result.data.success) {
          throw new Error(result.data && result.data.message ? result.data.message : 'The scan failed. Please try again.');
        }
        showResult(result.data);
      })
      .catch(function(err){
        showError(err.message || 'Something went wrong while scanning. Please try again.');
      })
      .finally(function(){
        isScanning = false;
        stopStatusRotation();
        scanPanel.hidden = true;
        setFormDisabled(false);
      });
  });

  function showResult(data){
    statGrid.innerHTML = '';
    var stats = [
      { num: data.pagesScanned, lbl: 'Pages scanned' },
      { num: data.violations, lbl: 'Violations' },
      { num: data.passes, lbl: 'Checks passed' }
    ];
    stats.forEach(function(s){
      var el = document.createElement('div');
      el.className = 'stat';
      el.innerHTML = '<div class="num">' + s.num + '</div><div class="lbl">' + s.lbl + '</div>';
      statGrid.appendChild(el);
    });
    viewReportLink.href = data.report;
    downloadReportLink.href = data.report;
    downloadJsonLink.href = data.reportJson;
    resultPanel.hidden = false;
    resultPanel.focus();
  }

  function showError(message){
    errorText.textContent = message;
    errorPanel.hidden = false;
    errorPanel.focus();
  }
})();
</script>
</body>
</html>`;
}

module.exports = { renderHomePage };
