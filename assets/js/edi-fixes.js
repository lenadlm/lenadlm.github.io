(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EdiFixes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_KEYWORDS = [
    { label: 'TRANSHIPMENT', re: /transs?hipment/i },
    { label: 'ZANZIBAR', re: /zanzibar/i },
    { label: 'CFS', re: /\bcfs\b/i },
    { label: 'CONSOLIDATION', re: /consolidat(?:ion|ed|ing)?/i },
    { label: 'SHIPPERS OWN', re: /shipper['\u2019]?s\s+own/i }
  ];

  // replacements.txt: one "old,new" literal per line, applied in file order.
  function parseReplacements(text) {
    var out = [], seen = {};
    String(text).replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line, idx) {
      var s = line.trim();
      if (!s || s.charAt(0) === '#') return;
      var comma = s.indexOf(',');
      if (comma < 1) return;
      var oldValue = s.slice(0, comma).trim();
      var newValue = s.slice(comma + 1).trim();
      if (!oldValue) return;
      var key = oldValue + '\u0000' + newValue;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ old: oldValue, new: newValue, srcLine: idx + 1, hits: 0 });
    });
    return out;
  }

  function splitLines(text) {
    // keeps terminators so the rebuilt document is byte-identical apart from replacements
    return text.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
  }

  var TD_RE = /<td_bill_code>\s*([^<]*?)\s*<\/td_bill_code>/;

  function applyReplacements(text, rules) {
    var lines = splitLines(text);
    var changes = [], count = 0, used = {}, currentTd = '';

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var body = raw.replace(/(\r\n|\n|\r)$/, '');
      var eol = raw.slice(body.length);
      var m = TD_RE.exec(body);
      if (m) currentTd = m[1];

      var next = body, touched = [];
      for (var r = 0; r < rules.length; r++) {
        var rule = rules[r];
        if (next.indexOf(rule.old) === -1) continue;
        var n = next.split(rule.old).length - 1;
        next = next.split(rule.old).join(rule.new);
        rule.hits += n;
        used[rule.old] = true;
        touched.push(rule);
        count += n;
      }
      if (next !== body) {
        changes.push({
          line: i + 1,
          td: currentTd,
          before: body,
          after: next,
          rules: touched.map(function (k) { return { old: k.old, new: k.new, srcLine: k.srcLine }; })
        });
        lines[i] = next + eol;
      }
    }
    return {
      text: lines.join(''),
      changes: changes,
      count: count,
      rulesUsed: Object.keys(used).length
    };
  }

  function localName(node) { return node.localName || String(node.nodeName).split(':').pop(); }

  function childByName(el, name) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && localName(c) === name) return c;
    }
    return null;
  }

  function keywordReport(doc, keywords) {
    keywords = keywords || DEFAULT_KEYWORDS;
    var hits = [], scanned = 0;
    var tds = doc.getElementsByTagName('td');
    for (var i = 0; i < tds.length; i++) {
      if (localName(tds[i]) !== 'td') continue;
      scanned++;
      var codeEl = childByName(tds[i], 'td_bill_code');
      var descEl = childByName(tds[i], 'description');
      var desc = descEl ? String(descEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (!desc) continue;
      var matched = [];
      for (var k = 0; k < keywords.length; k++) {
        if (keywords[k].re.test(desc)) matched.push(keywords[k].label);
      }
      if (matched.length) {
        hits.push({ index: i + 1, code: codeEl ? codeEl.textContent.trim() : '', description: desc, matched: matched });
      }
    }
    return { hits: hits, scanned: scanned };
  }

  return {
    DEFAULT_KEYWORDS: DEFAULT_KEYWORDS,
    parseReplacements: parseReplacements,
    applyReplacements: applyReplacements,
    keywordReport: keywordReport
  };
});
