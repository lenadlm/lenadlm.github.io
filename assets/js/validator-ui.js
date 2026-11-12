(function () {
  'use strict';

  var XSD_URL = 'assets/xsd/SA01-LoadSeaSD.xsd';
  var REPLACEMENTS_URL = 'https://raw.githubusercontent.com/lenadlm/edi-scripts/main/replacements.txt';
  var schema = null;
  var results = [];
  var rules = [];           // parsed replacements.txt
  var rulesError = '';      // set when fetch/parse failed
  var keywords = EdiFixes.DEFAULT_KEYWORDS;

  var input = document.getElementById('file-input');
  var drop = document.getElementById('dropzone');
  var status = document.getElementById('schema-status');
  var panel = document.getElementById('results');
  var summary = document.getElementById('summary');
  var list = document.getElementById('file-list');
  var csvBtn = document.getElementById('csv-btn');
  var fixCsvBtn = document.getElementById('fix-csv-btn');
  var clearBtn = document.getElementById('clear-btn');
  var applyToggle = document.getElementById('apply-toggle');
  var replStatus = document.getElementById('repl-status');

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  function table(headers, rows, cls) {
    var t = h('table', cls || 'verr');
    var head = h('tr');
    headers.forEach(function (c) {
      var th = h('th', '', c);
      th.scope = 'col';
      head.appendChild(th);
    });
    t.appendChild(h('thead')).appendChild(head);
    var body = h('tbody');
    rows.forEach(function (cells) {
      var tr = h('tr');
      cells.forEach(function (c) {
        if (c && c.nodeType === 1) tr.appendChild(c);
        else tr.appendChild(h('td', '', c === undefined || c === null ? '' : String(c)));
      });
      body.appendChild(tr);
    });
    t.appendChild(body);
    return t;
  }

  function loadReplacements() {
    return fetch(REPLACEMENTS_URL, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        rules = EdiFixes.parseReplacements(text);
        if (!rules.length) throw new Error('no usable rules');
        replStatus.textContent = 'replacements: ' + rules.length + ' rules · edi-scripts/replacements.txt';
      })
      .catch(function (err) {
        rules = [];
        rulesError = err.message;
        applyToggle.checked = false;
        applyToggle.disabled = true;
        replStatus.textContent = 'replacements: unavailable (' + err.message + ') - files validated as-is';
        replStatus.classList.add('is-error');
      });
  }

  function loadSchema() {
    fetch(XSD_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error('schema is not well-formed XML');
        schema = KraValidator.parseSchema(doc);
        status.textContent = 'schema: SA01-LoadSeaSD.xsd · ' + schema.count + ' elements loaded';
        if (schema.problems.length) status.textContent += ' · ' + schema.problems.length + ' schema warning(s)';
        input.disabled = false;
        drop.classList.remove('is-disabled');
      })
      .catch(function (err) {
        status.textContent = 'could not load schema (' + err.message + ')';
        status.classList.add('is-error');
      });
  }

  // Runs replacements (optional) then validates the resulting document.
  function process(entry) {
    entry.changes = [];
    entry.replCount = 0;
    entry.rawText = entry.rawText || entry.text;
    var text = entry.rawText;

    if (applyToggle.checked && rules.length) {
      var fixed = EdiFixes.applyReplacements(text, rules);
      text = fixed.text;
      entry.changes = fixed.changes;
      entry.replCount = fixed.count;
    }
    entry.text = text;

    var parsed = KraValidator.parseXml(text);
    entry.parseError = parsed.error;
    entry.res = null;
    entry.keywordHits = [];

    if (!parsed.doc) return entry;
    entry.res = KraValidator.validate(parsed.doc, schema, { text: text });
    entry.keywordHits = EdiFixes.keywordReport(parsed.doc, keywords).hits;
    return entry;
  }

  function validateFile(file) {
    return file.text().then(function (text) {
      var entry = { name: file.name, size: file.size, rawText: text };
      return process(entry);
    }).catch(function (err) {
      return { name: file.name, size: file.size, parseError: 'Could not read file: ' + err.message,
        res: null, changes: [], keywordHits: [], replCount: 0 };
    });
  }

  function handleFiles(files) {
    if (!schema || !files.length) return;
    var queue = Array.prototype.slice.call(files);
    status.textContent = 'validating ' + queue.length + ' file(s)...';
    queue.reduce(function (chain, file) {
      return chain.then(function () {
        return validateFile(file).then(function (entry) {
          results.push(entry);
          render();
        });
      });
    }, Promise.resolve()).then(function () {
      status.textContent = 'schema: SA01-LoadSeaSD.xsd · ' + schema.count + ' elements loaded';
    });
  }

  function isValid(e) { return !e.parseError && e.res.total === 0; }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/xml;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function revisedName(name) {
    return name.replace(/\.xml$/i, '') + '.revised.xml';
  }

  function renderFixes(d, e) {
    if (!applyToggle.checked) return;

    var box = h('div', 'vfixes');
    if (!e.changes.length) {
      box.appendChild(h('p', 'vnote', 'Replacements applied: no matching values in this file.'));
      d.appendChild(box);
      return;
    }

    var head = h('div', 'vsec-head');
    head.appendChild(h('span', 'vsec-title', 'replacements applied'));
    head.appendChild(h('span', 'vsec-meta', fmt(e.replCount) + ' value(s) · ' + fmt(e.changes.length) + ' line(s)'));
    box.appendChild(head);

    var rows = e.changes.map(function (c) {
      var td = h('td', 'c-loc');
      if (c.td) td.appendChild(h('span', 'c-bill', 'TD ' + c.td));
      var from = h('td', 'c-diff');
      from.appendChild(h('span', 'c-old', c.before.trim()));
      var to = h('td', 'c-diff');
      to.appendChild(h('span', 'c-new', c.after.trim()));
      return [String(c.line), td, from, to];
    });
    box.appendChild(h('div', 'verr-wrap vfix-wrap')).appendChild(
      table(['Line', 'TD', 'Before', 'After'], rows)
    );

    d.appendChild(box);
  }

  function renderKeywords(d, e) {
    var box = h('div', 'vkw');
    var head = h('div', 'vsec-head');
    head.appendChild(h('span', 'vsec-title', 'keyword review'));
    head.appendChild(h('span', 'vsec-meta', fmt(e.keywordHits.length) + ' matching TD(s)'));

    var chips = h('div', 'kw-chips');
    var matchedLabels = {};
    e.keywordHits.forEach(function (hit) { hit.matched.forEach(function (l) { matchedLabels[l] = true; }); });
    keywords.forEach(function (k) {
      chips.appendChild(h('span', 'kw-chip' + (matchedLabels[k.label] ? ' is-hit' : ''), k.label));
    });
    box.appendChild(head);
    box.appendChild(chips);

    if (!e.keywordHits.length) {
      box.appendChild(h('p', 'vnote', 'No <description> matched the keywords above.'));
    } else {
      var rows = e.keywordHits.map(function (hit) {
        return [
          hit.matched.join(' · '),
          h('td', 'c-loc', hit.code || '–'),
          h('td', 'c-desc', hit.description)
        ];
      });
      box.appendChild(h('div', 'verr-wrap')).appendChild(
        table(['Keyword', 'TD bill code', 'Description'], rows)
      );
    }
    d.appendChild(box);
  }

  function renderActions(d, e) {
    var bar = h('div', 'vact');
    if (applyToggle.checked && e.changes.length) {
      var btn = h('button', 'btn is-accent', 'download revised xml');
      btn.type = 'button';
      btn.addEventListener('click', function () { download(revisedName(e.name), e.text); });
      bar.appendChild(btn);
      bar.appendChild(h('span', 'vnote', 'only the listed values change - encoding, order and structure are untouched'));
    }
    d.appendChild(bar);
  }

  function render() {
    panel.hidden = !results.length;
    var ok = results.filter(isValid).length;
    var fixes = results.reduce(function (n, e) { return n + (e.replCount || 0); }, 0);
    summary.textContent = results.length + ' file' + (results.length === 1 ? '' : 's') +
      ' · ' + ok + ' valid · ' + (results.length - ok) + ' invalid' +
      (fixes ? ' · ' + fmt(fixes) + ' replaceable value(s)' : '');
    list.textContent = '';
    results.forEach(function (e) {
      var valid = isValid(e);
      var d = h('details', 'vfile ' + (valid ? 'is-ok' : 'is-bad'));
      if (!valid && results.length <= 3) d.open = true;
      var s = h('summary');
      s.appendChild(h('span', 'vbadge', valid ? 'VALID' : 'INVALID'));
      s.appendChild(h('span', 'vname', e.name));
      var meta = e.parseError ? 'not well-formed'
        : fmt(e.res.stats.td) + ' TDs · ' + (valid ? 'no errors' : fmt(e.res.total) + ' error' + (e.res.total === 1 ? '' : 's'));
      if (e.replCount) meta += ' · ' + fmt(e.replCount) + ' fixed after replacement';
      s.appendChild(h('span', 'vmeta', meta));
      d.appendChild(s);

      if (e.parseError) {
        d.appendChild(h('pre', 'vparse', e.parseError));
      } else {
        if (!valid) {
          var wrap = h('div', 'verr-wrap');
          var rows = e.res.errors.map(function (er) {
            var loc = h('td', 'c-loc', er.path);
            if (er.ctx) loc.appendChild(h('span', 'c-bill', 'TD ' + er.ctx));
            return [er.line ? String(er.line) : '–', loc, er.message];
          });
          wrap.appendChild(table(['Line', 'Location', 'Problem'], rows));
          d.appendChild(wrap);
          if (e.res.truncated) {
            d.appendChild(h('p', 'vnote', 'Showing the first ' + fmt(e.res.errors.length) + ' of ' + fmt(e.res.total) + ' errors. Download the CSV for the capped list, fix, and re-run.'));
          }
        }
        renderFixes(d, e);
        renderKeywords(d, e);
        renderActions(d, e);
      }
      list.appendChild(d);
    });
  }

  function csvCell(v) {
    return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  }

  function saveCsv(name, rows) {
    download(name, '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'),
      'text/csv;charset=utf-8');
  }

  function downloadCsv() {
    var rows = [['file', 'line', 'location', 'td_bill_code', 'problem']];
    results.forEach(function (e) {
      if (e.parseError) rows.push([e.name, '', '', '', e.parseError]);
      else e.res.errors.forEach(function (er) { rows.push([e.name, er.line, er.path, er.ctx, er.message]); });
    });
    saveCsv('kra-validation-report.csv', rows);
  }

  function downloadFixCsv() {
    var rows = [['file', 'type', 'line', 'td_bill_code', 'keyword_or_rule', 'before', 'after']];
    results.forEach(function (e) {
      (e.changes || []).forEach(function (c) {
        var ruleList = c.rules.map(function (r) { return r.old + ' -> ' + r.new; }).join(' | ');
        rows.push([e.name, 'replacement', c.line, c.td, ruleList, c.before.trim(), c.after.trim()]);
      });
      (e.keywordHits || []).forEach(function (k) {
        rows.push([e.name, 'keyword', '', k.code, k.matched.join(' | '), k.description, '']);
      });
    });
    saveCsv('kra-fixes-report.csv', rows);
  }

  input.addEventListener('change', function () {
    handleFiles(input.files);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
  });
  drop.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });

  csvBtn.addEventListener('click', downloadCsv);
  fixCsvBtn.addEventListener('click', downloadFixCsv);
  clearBtn.addEventListener('click', function () {
    results = [];
    render();
  });

  applyToggle.addEventListener('change', function () {
    if (!schema || !results.length) { render(); return; }
    results.forEach(function (e) { if (e.rawText) process(e); });
    render();
  });

  loadSchema();
  loadReplacements();
})();
