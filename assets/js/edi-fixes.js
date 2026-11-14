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
    { label: 'SHIPPERS OWN', src: "shipper['\u2019]?s?[\\s-]*own", re: /shipper['\u2019]?s?[\s\u2013-]*own/i },
    { label: 'STRIPPING', src: 'strip+ing|stripped', re: /strip+ing|stripped/i },
    { label: 'SHIP SPARES', src: "ship['\u2019]?s?[\\s-]*spares", re: /ship['\u2019]?s?[\s\u2013-]*spares?/i }
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
  function lowerName(node) { return String(localName(node) || '').toLowerCase(); }

  function childByName(el, name) {
    var want = String(name).toLowerCase();
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && lowerName(c) === want) return c;
    }
    return null;
  }

  function textOf(el) {
    return String(el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findDescription(el) {
    var direct = childByName(el, 'description');
    if (direct) return direct;
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      if (lowerName(all[i]) === 'description') return all[i];
    }
    return null;
  }

  function hasBillCodeChild(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && /bill_code$/.test(lowerName(c))) return true;
    }
    return false;
  }

  // Keyword scan: every <description> in the document, matched against the
  // TD record it belongs to. Descriptions are usually one per cargo line and
  // live deeper than a direct child of <td>, so we walk up to the nearest
  // <td> (or bill_code-bearing record) for the bill code and line number.
  // Only description text is tested - never remarks, marks or codes.
  function keywordReport(doc, keywords, lineMap) {
    keywords = keywords || DEFAULT_KEYWORDS;
    var hits = [], scanned = 0, withDesc = 0, descCount = 0;
    var all = doc.getElementsByTagName('*');
    var names = {}, sample = [];
    var records = [], descriptions = [];

    for (var i = 0; i < all.length; i++) {
      var ln = lowerName(all[i]);
      if (!names[ln] && sample.length < 15) { names[ln] = 1; sample.push(ln); }
      else names[ln] = 1;
      if (ln === 'td') records.push(all[i]);
      if (ln === 'description') descriptions.push(all[i]);
    }
    var mode = 'td';
    if (!records.length) {
      mode = 'bill_code';
      for (var j = 0; j < all.length; j++) {
        if (all[j].nodeType === 1 && hasBillCodeChild(all[j])) records.push(all[j]);
      }
    }

    var recordSet = {};
    records.forEach(function (r) { recordSet[keyOf(r)] = r; });

    function keyOf(node) {
      if (!node.__kvKey) node.__kvKey = 'k' + (keyOf.n = (keyOf.n || 0) + 1);
      return node.__kvKey;
    }

    function nearestRecord(el) {
      var n = el.parentNode;
      while (n && n.nodeType === 1) {
        if (recordSet[keyOf(n)]) return n;
        n = n.parentNode;
      }
      return null;
    }

    function billCodeOf(rec) {
      if (!rec) return '';
      var kid = rec.firstChild;
      while (kid) {
        if (kid.nodeType === 1 && /bill_code$/.test(lowerName(kid))) return textOf(kid);
        kid = kid.nextSibling;
      }
      return '';
    }

    var perRecord = {};
    var counted = {};
    descriptions.forEach(function (d) {
      descCount++;
      var rec = nearestRecord(d);
      var desc = textOf(d);
      if (!desc) return;
      if (rec) {
        var rk = keyOf(rec);
        if (!counted[rk]) { counted[rk] = 1; withDesc++; }
      }
      var matched = [];
      for (var k = 0; k < keywords.length; k++) {
        if (keywords[k].re.test(desc)) matched.push(keywords[k].label);
      }
      if (!matched.length) return;
      var line = (lineMap && (lineMap.get(d) || (rec && lineMap.get(rec)))) || null;
      hits.push({
        line: line,
        code: billCodeOf(rec),
        field: 'description',
        description: desc,
        matched: matched
      });
    });

    records.forEach(function (r) { if (r) scanned++; });

    return {
      hits: hits,
      scanned: scanned,
      withDescription: withDesc,
      descriptions: descCount,
      mode: mode,
      sample: sample
    };
  }

  function num(el) {
    var v = String((el && el.textContent) || '').replace(/[^0-9.\-]/g, '');
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  // Manifest totals for the summary table: TDs, containers (split 20/40 ft by
  // the ISO type prefix), packages (sum of decl_qty) and gross weight.
  function summary(doc) {
    var s = {
      tds: 0, containers: 0, ft20: 0, ft40: 0, otherFt: 0,
      packages: 0, grossWeight: 0, grossLines: 0, packageLines: 0,
      isoTypes: {}
    };
    if (!doc) return s;

    var all = doc.getElementsByTagName('*');
    var billCodes = 0;
    for (var i = 0; i < all.length; i++) {
      var ln = lowerName(all[i]);
      if (ln === 'td') s.tds++;
      if (/bill_code$/.test(ln)) billCodes++;
      else if (ln === 'container_num') {
        if (textOf(all[i])) s.containers++;
      } else if (ln === 'iso_container_type') {
        var iso = textOf(all[i]).toUpperCase();
        if (iso) s.isoTypes[iso] = (s.isoTypes[iso] || 0) + 1;
        if (iso.charAt(0) === '2') s.ft20++;
        else if (iso.charAt(0) === '4') s.ft40++;
        else if (iso) s.otherFt++;
      } else if (ln === 'decl_qty') {
        s.packages += num(all[i]);
        s.packageLines++;
      } else if (ln === 'decl_gross_wgt') {
        s.grossWeight += num(all[i]);
        s.grossLines++;
      }
    }
    // some exports have no <td> wrapper: fall back to the bill code elements
    if (!s.tds) s.tds = billCodes;
    s.otherFt = Math.max(0, s.containers - s.ft20 - s.ft40);
    return s;
  }

  return {
    DEFAULT_KEYWORDS: DEFAULT_KEYWORDS,
    parseReplacements: parseReplacements,
    applyReplacements: applyReplacements,
    keywordReport: keywordReport,
    summary: summary
  };
});
