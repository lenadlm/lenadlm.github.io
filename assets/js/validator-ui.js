(function () {
  'use strict';

  var XSD_URL = 'assets/xsd/SA01-LoadSeaSD.xsd';
  var schema = null;
  var results = [];

  var input = document.getElementById('file-input');
  var drop = document.getElementById('dropzone');
  var status = document.getElementById('schema-status');
  var panel = document.getElementById('results');
  var summary = document.getElementById('summary');
  var list = document.getElementById('file-list');
  var csvBtn = document.getElementById('csv-btn');
  var clearBtn = document.getElementById('clear-btn');

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function fmt(n) { return n.toLocaleString('en-US'); }

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

  function validateFile(file) {
    return file.text().then(function (text) {
      var parsed = KraValidator.parseXml(text);
      var entry = { name: file.name, size: file.size, parseError: parsed.error, res: null };
      if (parsed.doc) entry.res = KraValidator.validate(parsed.doc, schema, { text: text });
      return entry;
    }).catch(function (err) {
      return { name: file.name, size: file.size, parseError: 'Could not read file: ' + err.message, res: null };
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

  function render() {
    panel.hidden = !results.length;
    var ok = results.filter(isValid).length;
    summary.textContent = results.length + ' file' + (results.length === 1 ? '' : 's') +
      ' · ' + ok + ' valid · ' + (results.length - ok) + ' invalid';
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
      s.appendChild(h('span', 'vmeta', meta));
      d.appendChild(s);

      if (e.parseError) {
        d.appendChild(h('pre', 'vparse', e.parseError));
      } else if (!valid) {
        var wrap = h('div', 'verr-wrap');
        var t = h('table', 'verr');
        var head = h('tr');
        ['Line', 'Location', 'Problem'].forEach(function (c) {
          var th = h('th', '', c);
          th.scope = 'col';
          head.appendChild(th);
        });
        t.appendChild(h('thead')).appendChild(head);
        var body = h('tbody');
        e.res.errors.forEach(function (er) {
          var tr = h('tr');
          tr.appendChild(h('td', 'c-line', er.line ? String(er.line) : '–'));
          var loc = h('td', 'c-loc', er.path);
          if (er.ctx) loc.appendChild(h('span', 'c-bill', 'TD ' + er.ctx));
          tr.appendChild(loc);
          tr.appendChild(h('td', 'c-msg', er.message));
          body.appendChild(tr);
        });
        t.appendChild(body);
        wrap.appendChild(t);
        d.appendChild(wrap);
        if (e.res.truncated) {
          d.appendChild(h('p', 'vnote', 'Showing the first ' + fmt(e.res.errors.length) + ' of ' + fmt(e.res.total) + ' errors. Download the CSV for the capped list, fix, and re-run.'));
        }
      }
      list.appendChild(d);
    });
  }

  function csvCell(v) {
    return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  }

  function downloadCsv() {
    var rows = [['file', 'line', 'location', 'td_bill_code', 'problem']];
    results.forEach(function (e) {
      if (e.parseError) rows.push([e.name, '', '', '', e.parseError]);
      else e.res.errors.forEach(function (er) { rows.push([e.name, er.line, er.path, er.ctx, er.message]); });
    });
    var blob = new Blob(['\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kra-validation-report.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
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
  clearBtn.addEventListener('click', function () {
    results = [];
    render();
  });

  loadSchema();
})();
