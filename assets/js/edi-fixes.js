(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EdiFixes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_KEYWORDS = [
    { label: 'TRANSHIPMENT', src: 'transs?hip(?:ment)?', re: /transs?hip(?:ment|ped|ping)?/i },
    { label: 'ZANZIBAR', src: 'zanzibar', re: /zanzibar/i },
    { label: 'CFS', src: 'c\\.?f\\.?s\\.?', re: /\bc\.?f\.?s\.?\b/i },
    { label: 'CONSOLIDATION', src: 'consolidat', re: /consolidat/i },
    { label: 'SHIPPERS OWN', src: "shipper['\u2019]?s?[\\s-]*own", re: /shipper['\u2019]?s?[\s\u2013-]*own/i }
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
        if (!used[rule.old]) used[rule.old] = { rule: rule, count: 0 };
        used[rule.old].count += n;
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

    var rulesUsed = Object.keys(used).map(function (k) { return used[k]; });
    rulesUsed.sort(function (a, b) { return a.rule.srcLine - b.rule.srcLine; });

    return {
      text: lines.join(''),
      changes: changes,
      count: count,
      rulesUsed: rulesUsed,
      rulesUsedCount: rulesUsed.length
    };
  }

  function localName(node) { return node.localName || String(node.nodeName).split(':').pop(); }

  function childByName(el, name) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && localName(c) === name) return c;
    }
    return null;
  }

  var SKIP_FIELDS = { td_bill_code: 1, description: 1 };

  function textOf(el) {
    return String(el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // Every <td> whose text matches a keyword, with its line number.
  // Namespace-safe: iterates all elements and compares localName, so
  // <kra:td> / <ns:td> are found as well as plain <td>.
  // Matches in <description> are primary; a hit found only elsewhere
  // (remarks, lp_marks, ...) is still reported, with its field name.
  function keywordReport(doc, keywords, lineMap) {
    keywords = keywords || DEFAULT_KEYWORDS;
    var hits = [], scanned = 0, withDesc = 0;
    var all = doc.getElementsByTagName('*');

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (localName(el) !== 'td') continue;
      scanned++;

      var codeEl = childByName(el, 'td_bill_code');
      var descEl = childByName(el, 'description');
      var desc = descEl ? textOf(descEl) : '';
      if (desc) withDesc++;
      var code = codeEl ? textOf(codeEl) : '';
      var line = (lineMap && lineMap.get(el)) || null;

      var seen = {};
      var matched = [];
      for (var k = 0; k < keywords.length; k++) {
        if (keywords[k].re.test(desc)) {
          matched.push(keywords[k].label);
          seen[keywords[k].label] = true;
        }
      }
      if (matched.length) {
        hits.push({ line: line, code: code, field: 'description', description: desc, matched: matched });
      }

      // keywords present in the TD but not inside <description>
      var kids = el.childNodes;
      for (var c = 0; c < kids.length; c++) {
        var ch = kids[c];
        if (ch.nodeType !== 1) continue;
        var fname = localName(ch);
        if (SKIP_FIELDS[fname] || ch.childNodes.length > 1) continue;
        var text = textOf(ch);
        if (!text) continue;
        var extra = [];
        for (var kk = 0; kk < keywords.length; kk++) {
          var lbl = keywords[kk].label;
          if (seen[lbl]) continue;
          if (keywords[kk].re.test(text)) {
            extra.push(lbl);
            seen[lbl] = true;
          }
        }
        if (extra.length) {
          hits.push({ line: line, code: code, field: fname, description: text, matched: extra });
        }
      }
    }
    return { hits: hits, scanned: scanned, withDescription: withDesc };
  }

  return {
    DEFAULT_KEYWORDS: DEFAULT_KEYWORDS,
    parseReplacements: parseReplacements,
    applyReplacements: applyReplacements,
    keywordReport: keywordReport
  };
});
