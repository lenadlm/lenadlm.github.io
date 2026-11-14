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

  // Replacements are always computed (so the report can show them), but only
  // written into the validated text when the toggle is on. Nothing outside
  // replacements.txt is ever changed.
  function process(entry) {
    entry.rawText = entry.rawText || entry.text || '';

    var preview = { changes: [], count: 0, rulesUsed: [], rulesUsedCount: 0, text: entry.rawText };
    if (rules.length) preview = EdiFixes.applyReplacements(entry.rawText, rules);

    var applied = applyToggle.checked && rules.length > 0;
    entry.preview = preview;
    entry.changes = preview.changes;
    entry.replCount = preview.count;
    entry.rulesUsed = preview.rulesUsed;
    entry.applied = applied;

    var text = applied ? preview.text : entry.rawText;
    entry.text = text;

    var parsed = KraValidator.parseXml(text);
    entry.parseError = parsed.error;
    entry.res = null;
    entry.keywordHits = [];
    entry.keywordStats = { scanned: 0, withDescription: 0, descriptions: 0, mode: 'td', sample: [] };

    if (!parsed.doc) return entry;
    // older cached copies of kra-validator.js may not expose buildLineMap
    var lineMap = typeof KraValidator.buildLineMap === 'function'
      ? KraValidator.buildLineMap(parsed.doc.documentElement, text)
      : null;
    entry.res = KraValidator.validate(parsed.doc, schema, { text: text });
    entry.summary = typeof EdiFixes.summary === 'function' ? EdiFixes.summary(parsed.doc) : null;
    var kw = EdiFixes.keywordReport(parsed.doc, keywords, lineMap);
    entry.keywordHits = kw.hits;
    entry.keywordStats = { scanned: kw.scanned, withDescription: kw.withDescription, descriptions: kw.descriptions, mode: kw.mode, sample: kw.sample };
    return entry;
  }

  function validateFile(file) {
    return file.text().then(function (text) {
      var entry = { name: file.name, size: file.size, rawText: text };
      return process(entry);
    }).catch(function (err) {
      return { name: file.name, size: file.size, parseError: 'Could not read file: ' + err.message,
        res: null, changes: [], rulesUsed: [], keywordHits: [], replCount: 0, applied: false,
        preview: { changes: [], count: 0, rulesUsed: [] } };
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

  // strip element markup so the report shows only the value that changed
  function plainValue(raw) {
    var v = String(raw === null || raw === undefined ? '' : raw)
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .trim();
    return v;
  }

  // ---- section: what was replaced (always rendered) ----
  function renderFixes(d, e) {
    var box = h('div', 'vfixes');
    var head = h('div', 'vsec-head');
    head.appendChild(h('span', 'vsec-title', 'replacements'));
    head.appendChild(h('span', 'vsec-meta', e.changes.length
      ? fmt(e.replCount) + ' value(s) replaced' + (e.applied ? '' : ' · not applied (toggle off)')
      : 'no matching values'));
    box.appendChild(head);

    if (!e.changes.length) {
      box.appendChild(h('p', 'vnote',
        rules.length
          ? 'Nothing in this file matches the ' + fmt(rules.length) + ' rules in replacements.txt - no value was changed.'
          : 'replacements.txt could not be loaded, so no value was changed.'));
      d.appendChild(box);
      return;
    }

    // one row per replaced value, XML tags stripped
    var rows = [];
    e.changes.forEach(function (c) {
      c.rules.forEach(function (r) {
        var td = h('td', 'c-td');
        if (c.td) td.appendChild(h('span', 'c-bill', c.td));
        else td.textContent = '–';
        var from = h('td', 'c-diff');
        var oldVal = plainValue(r.old);
        from.appendChild(h('span', 'c-old', oldVal === '' ? '(empty)' : oldVal));
        var to = h('td', 'c-diff');
        var newVal = plainValue(r.new);
        to.appendChild(h('span', 'c-new', newVal === '' ? '(empty)' : newVal));
        td.title = 'line ' + c.line + ' · replacements.txt:' + r.srcLine;
        rows.push([td, from, to]);
      });
    });

    box.appendChild(h('div', 'verr-wrap vfix-wrap')).appendChild(
      table(['TD bill code', 'Original value', 'Replaced with'], rows, 'verr vfix')
    );

    d.appendChild(box);
  }

  // ---- section: key words (always rendered) ----
  function highlight(text, labels) {
    var span = h('span');
    var parts = [{ t: text, hit: false }];
    labels.forEach(function (label) {
      var k = null;
      for (var i = 0; i < keywords.length; i++) if (keywords[i].label === label) k = keywords[i];
      if (!k) return;
      var re = new RegExp(k.re.source, 'gi');
      var next = [];
      parts.forEach(function (p) {
        if (p.hit) { next.push(p); return; }
        var idx = 0, m;
        while ((m = re.exec(p.t))) {
          if (m.index > idx) next.push({ t: p.t.slice(idx, m.index), hit: false });
          next.push({ t: m[0], hit: true });
          idx = m.index + m[0].length;
          if (m[0].length === 0) re.lastIndex++;
        }
        if (idx < p.t.length) next.push({ t: p.t.slice(idx), hit: false });
      });
      parts = next;
    });
    parts.forEach(function (p) {
      if (!p.t) return;
      if (p.hit) span.appendChild(h('mark', 'kw-mark', p.t));
      else span.appendChild(document.createTextNode(p.t));
    });
    return span;
  }

  function renderKeywords(d, e) {
    var box = h('div', 'vkw');
    var counts = {}, totalHits = 0;
    e.keywordHits.forEach(function (hit) {
      hit.matched.forEach(function (l) { counts[l] = (counts[l] || 0) + 1; totalHits++; });
    });

    var head = h('div', 'vsec-head');
    head.appendChild(h('span', 'vsec-title', 'key words'));
    head.appendChild(h('span', 'vsec-meta',
      fmt(e.keywordHits.length) + ' description(s) · ' + fmt(totalHits) + ' keyword hit(s) · ' +
      fmt(e.keywordStats.descriptions) + ' descriptions in ' + fmt(e.keywordStats.withDescription) +
      ' of ' + fmt(e.keywordStats.scanned) + ' TDs'));
    box.appendChild(head);

    var chips = h('div', 'kw-chips');
    keywords.forEach(function (k) {
      var n = counts[k.label] || 0;
      chips.appendChild(h('span', 'kw-chip' + (n ? ' is-hit' : ''),
        k.label + ' · ' + (n ? n + ' found' : 'none')));
    });
    box.appendChild(chips);

    if (!e.keywordHits.length) {
      var why;
      if (!e.keywordStats.scanned) {
        why = 'No TD records were recognised in this file. Element names found: ' +
          (e.keywordStats.sample || []).join(', ') + '.';
      } else if (!e.keywordStats.withDescription) {
        why = fmt(e.keywordStats.scanned) + ' TD record(s) found, but none contains a <description> element.';
      } else {
        why = 'None of the ' + fmt(e.keywordStats.withDescription) +
          ' description(s) contains these keywords.';
      }
      box.appendChild(h('p', 'vnote', why));
    } else {
      var rows = e.keywordHits.map(function (hit) {
        var kwCell = h('td', 'c-loc');
        hit.matched.forEach(function (l) { kwCell.appendChild(h('span', 'c-bill', l)); });
        var textCell = h('td', 'c-desc');
        textCell.appendChild(highlight(hit.description, hit.matched));
        return [
          hit.line ? String(hit.line) : '–',
          h('td', 'c-loc', hit.code || '–'),
          kwCell,
          textCell
        ];
      });
      box.appendChild(h('div', 'verr-wrap')).appendChild(
        table(['Line', 'TD bill code', 'Keyword', 'Description'], rows)
      );
    }
    d.appendChild(box);
  }

  // ---- section: manifest totals (top of the report, always rendered) ----
  function fmtWeight(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderSummary(listEl) {
    var rows_ = results.filter(function (e) { return e.summary; });
    if (!rows_.length) return;

    var box = h('div', 'vsum');
    var head = h('div', 'vsec-head');
    head.appendChild(h('span', 'vsec-title', 'summary'));
    head.appendChild(h('span', 'vsec-meta', rows_.length > 1
      ? 'totals per file · ' + fmt(rows_.length) + ' files'
      : 'manifest totals'));
    box.appendChild(head);

    function cells(s) {
      return [fmt(s.tds), fmt(s.containers), fmt(s.ft20), fmt(s.ft40), fmt(s.packages), fmtWeight(s.grossWeight)];
    }

    var rows = rows_.map(function (e) {
      var name = h('td', 'c-file', e.name);
      name.title = e.name;
      return [name].concat(cells(e.summary));
    });

    var other = 0;
    if (rows_.length > 1) {
      var tot = { tds: 0, containers: 0, ft20: 0, ft40: 0, packages: 0, grossWeight: 0 };
      rows_.forEach(function (e) {
        var s = e.summary;
        tot.tds += s.tds; tot.containers += s.containers; tot.ft20 += s.ft20;
        tot.ft40 += s.ft40; tot.packages += s.packages; tot.grossWeight += s.grossWeight;
        other += s.otherFt;
      });
      rows.push([h('td', 'c-file c-total', 'total')].concat(cells(tot)));
    } else {
      other = rows_[0].summary.otherFt;
    }

    var headers = ['File', 'TDs', 'Containers', '20 ft', '40 ft', 'Packages', 'Gross weight (kg)'];
    var sources = ['uploaded file', 'count of <td_bill_code>', 'count of <container_num>',
      'ISO type starts with 2', 'ISO type starts with 4', 'sum of <decl_qty>', 'sum of <decl_gross_wgt>'];
    var w = h('div', 'verr-wrap vsum-wrap');
    var t = table(headers, rows, 'verr vsum-table');
    var ths = t.querySelectorAll('thead th');
    for (var i = 1; i < ths.length; i++) ths[i].title = sources[i];
    w.appendChild(t);
    box.appendChild(w);

    if (other) {
      box.appendChild(h('p', 'vnote', fmt(other) + ' container(s) have an ISO type that is neither 2xxx nor 4xxx.'));
    }

    listEl.appendChild(box);
  }

  function renderActions(d, e) {
    var bar = h('div', 'vact');
    if (e.changes.length) {
      var btn = h('button', 'btn is-accent', 'download revised xml');
      btn.type = 'button';
      btn.addEventListener('click', function () { download(revisedName(e.name), e.preview.text); });
      bar.appendChild(btn);
      bar.appendChild(h('span', 'vnote',
        'only the ' + fmt(e.changes.length) + ' listed line(s) change - encoding, order and structure are untouched'));
    }
    d.appendChild(bar);
  }

  function render() {
    panel.hidden = !results.length;
    var ok = results.filter(isValid).length;
    var fixes = results.reduce(function (n, e) { return n + (e.changes || []).length; }, 0);
    var hits = results.reduce(function (n, e) { return n + (e.keywordHits || []).length; }, 0);
    summary.textContent = results.length + ' file' + (results.length === 1 ? '' : 's') +
      ' · ' + ok + ' valid · ' + (results.length - ok) + ' invalid' +
      ' · ' + fmt(fixes) + ' line(s) fixed by replacements.txt' +
      ' · ' + fmt(hits) + ' keyword match(es)';
    list.textContent = '';
    renderSummary(list);

    results.forEach(function (e) {
      var valid = isValid(e);
      var d = h('details', 'vfile ' + (valid ? 'is-ok' : 'is-bad'));
      // Always open: the key-word review is a result in its own right, so a
      // clean file (no schema errors, no replacements) must not hide it behind
      // a click. Every file's sections are visible without interaction.
      d.open = true;

      var s = h('summary');
      s.appendChild(h('span', 'vbadge', valid ? 'VALID' : 'INVALID'));
      s.appendChild(h('span', 'vname', e.name));
      var meta = e.parseError ? 'not well-formed'
        : fmt(e.res.stats.td) + ' TDs · ' + (valid ? 'no schema errors' : fmt(e.res.total) + ' schema error' + (e.res.total === 1 ? '' : 's'));
      if (e.changes.length) meta += ' · ' + fmt(e.changes.length) + ' line(s) fixed';
      if (!e.parseError) meta += ' · ' + fmt((e.keywordHits || []).length) + ' keyword match' + ((e.keywordHits || []).length === 1 ? '' : 'es');
      s.appendChild(h('span', 'vmeta', meta));
      d.appendChild(s);

      if (e.parseError) {
        d.appendChild(h('pre', 'vparse', e.parseError));
        d.appendChild(h('p', 'vnote', 'Could not parse, so replacements were not written. The raw text is unchanged.'));
        list.appendChild(d);
        return;
      }

      if (!valid) {
        var errHead = h('div', 'vsec-head');
        errHead.appendChild(h('span', 'vsec-title', 'schema errors'));
        errHead.appendChild(h('span', 'vsec-meta', fmt(e.res.total) + ' error' + (e.res.total === 1 ? '' : 's') + ' · not fixable from replacements.txt'))
        d.appendChild(errHead);

        var wrap = h('div', 'verr-wrap');
        var rows = e.res.errors.map(function (er) {
          var loc = h('td', 'c-loc', er.path);
          if (er.ctx) loc.appendChild(h('span', 'c-bill', 'TD ' + er.ctx));
          return [er.line ? String(er.line) : '–', loc, er.message];
        });
        wrap.appendChild(table(['Line', 'Location', 'Problem'], rows));
        d.appendChild(wrap);
        if (e.res.truncated) {
          d.appendChild(h('p', 'vnote', 'Showing the first ' + fmt(e.res.errors.length) + ' of ' + fmt(e.res.total) + ' errors. Download the CSV for the capped list.'));
        }
      }

      renderFixes(d, e);
      renderKeywords(d, e);
      renderActions(d, e);
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
      else if (e.res) e.res.errors.forEach(function (er) { rows.push([e.name, er.line, er.path, er.ctx, er.message]); });
    });
    saveCsv('kra-validation-report.csv', rows);
  }

  function downloadFixCsv() {
    var rows = [[
      'file', 'type', 'xml_line', 'td_bill_code', 'keyword', 'field',
      'rule_line', 'old_value', 'new_value', 'line_before', 'line_after', 'description'
    ]];
    results.forEach(function (e) {
      (e.changes || []).forEach(function (c) {
        c.rules.forEach(function (r) {
          rows.push([e.name, 'replacement', c.line, c.td, '', '', 'replacements.txt:' + r.srcLine,
            r.old, r.new, c.before.trim(), c.after.trim(), '']);
        });
      });
      (e.keywordHits || []).forEach(function (k) {
        k.matched.forEach(function (label) {
          rows.push([e.name, 'keyword', k.line || '', k.code, label, k.field, '', '', '', '', '', k.description]);
        });
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
