(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KraValidator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function kids(node) {
    var out = [];
    for (var c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c);
    return out;
  }

  function child(node, name) {
    var k = kids(node);
    for (var i = 0; i < k.length; i++) if (k[i].localName === name) return k[i];
    return null;
  }

  function local(qname) {
    var i = (qname || '').indexOf(':');
    return i < 0 ? qname || '' : qname.slice(i + 1);
  }

  function chars(s) { return Array.from(s).length; }

  function quote(v) {
    var a = Array.from(String(v));
    return '"' + (a.length > 60 ? a.slice(0, 57).join('') + '...' : a.join('')) + '"';
  }

  function val(v) { return v === '' ? 'Empty value' : 'Value ' + quote(v); }

  function readFacets(restriction) {
    var f = { patterns: [], enums: [] };
    if (!restriction) return f;
    kids(restriction).forEach(function (x) {
      var v = x.getAttribute('value');
      switch (x.localName) {
        case 'pattern':
          f.patterns.push({ src: v, re: new RegExp('^(?:' + v + ')$') });
          break;
        case 'enumeration':
          f.enums.push(v);
          break;
        case 'length': case 'minLength': case 'maxLength': case 'totalDigits': case 'fractionDigits':
          f[x.localName] = parseInt(v, 10);
          break;
        case 'minInclusive': case 'maxInclusive': case 'minExclusive': case 'maxExclusive':
          f[x.localName] = v;
          break;
      }
    });
    return f;
  }

  function parseSchema(xsdDoc) {
    var schema = { elements: {}, count: 0, problems: [] };
    kids(xsdDoc.documentElement).forEach(function (n) {
      var name = n.localName === 'element' && n.getAttribute('name');
      if (!name) return;
      var def = { name: name };
      var ct = child(n, 'complexType');
      if (ct) {
        def.kind = 'complex';
        def.particles = [];
        var seq = child(ct, 'sequence');
        if (seq) kids(seq).forEach(function (p) {
          if (p.localName !== 'element') return;
          var max = p.getAttribute('maxOccurs');
          def.particles.push({
            ref: local(p.getAttribute('ref') || p.getAttribute('name')),
            min: p.hasAttribute('minOccurs') ? parseInt(p.getAttribute('minOccurs'), 10) : 1,
            max: max === null ? 1 : (max === 'unbounded' ? Infinity : parseInt(max, 10))
          });
        });
      } else {
        var st = child(n, 'simpleType');
        var r = st && child(st, 'restriction');
        def.kind = 'simple';
        def.base = r ? local(r.getAttribute('base')) : 'string';
        try {
          def.facets = readFacets(r);
        } catch (e) {
          def.facets = { patterns: [], enums: [] };
          schema.problems.push('Bad pattern in <' + name + '>: ' + e.message);
        }
      }
      schema.elements[name] = def;
      schema.count++;
    });
    Object.keys(schema.elements).forEach(function (k) {
      var d = schema.elements[k];
      if (d.kind === 'complex') d.particles.forEach(function (p) {
        if (!schema.elements[p.ref]) schema.problems.push('<' + k + '> references undefined element <' + p.ref + '>');
      });
    });
    return schema;
  }

  function validDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    var dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
    return d <= dim;
  }

  function isDate(v) {
    var m = /^(-?\d{4,})-(\d{2})-(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(v);
    return !!m && validDate(+m[1], +m[2], +m[3]);
  }

  function isDateTime(v) {
    var m = /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(v);
    if (!m || !validDate(+m[1], +m[2], +m[3])) return false;
    var h = +m[4], mi = +m[5], s = +m[6];
    if (h === 24) return mi === 0 && s === 0 && !m[7];
    return h <= 23 && mi <= 59 && s <= 59;
  }

  function digitCounts(v) {
    var parts = v.replace(/^[+-]/, '').split('.');
    var int = parts[0].replace(/^0+/, '');
    var frac = (parts[1] || '').replace(/0+$/, '');
    return { total: int.length + frac.length, frac: frac.length };
  }

  function checkSimple(raw, def) {
    var f = def.facets, base = def.base, errs = [];
    var v = base === 'string' ? raw : raw.replace(/\s+/g, ' ').trim();

    if (base === 'decimal' && !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(v)) return [val(v) + ' is not a valid number'];
    if (base === 'date' && !isDate(v)) return [val(v) + ' is not a valid date (expected YYYY-MM-DD)'];
    if (base === 'dateTime' && !isDateTime(v)) return [val(v) + ' is not a valid date-time (expected YYYY-MM-DDThh:mm:ss)'];

    if (f.enums.length && f.enums.indexOf(v) < 0) errs.push(val(v) + ' is not one of: ' + f.enums.join(', '));
    if (f.patterns.length && !f.patterns.some(function (p) { return p.re.test(v); })) {
      errs.push(val(v) + ' does not match pattern ' + f.patterns.map(function (p) { return p.src; }).join(' | '));
    }

    var len = chars(v);
    if (f.length != null && len !== f.length) errs.push(val(v) + ' must be exactly ' + f.length + ' characters (found ' + len + ')');
    if (f.minLength != null && len < f.minLength) {
      errs.push(len === 0 ? 'Empty value (minimum length ' + f.minLength + ')' : val(v) + ' is too short (' + len + ' < ' + f.minLength + ')');
    }
    if (f.maxLength != null && len > f.maxLength) errs.push(val(v) + ' is too long (' + len + ' > ' + f.maxLength + ')');

    if (base === 'decimal') {
      var dc = digitCounts(v), n = Number(v);
      if (f.totalDigits != null && dc.total > f.totalDigits) errs.push(val(v) + ' has ' + dc.total + ' digits (maximum ' + f.totalDigits + ')');
      if (f.fractionDigits != null && dc.frac > f.fractionDigits) errs.push(val(v) + ' has ' + dc.frac + ' decimal places (maximum ' + f.fractionDigits + ')');
      if (f.maxExclusive != null && !(n < Number(f.maxExclusive))) errs.push(val(v) + ' must be less than ' + f.maxExclusive);
      if (f.maxInclusive != null && !(n <= Number(f.maxInclusive))) errs.push(val(v) + ' must be at most ' + f.maxInclusive);
      if (f.minExclusive != null && !(n > Number(f.minExclusive))) errs.push(val(v) + ' must be greater than ' + f.minExclusive);
      if (f.minInclusive != null && !(n >= Number(f.minInclusive))) errs.push(val(v) + ' must be at least ' + f.minInclusive);
    }
    return errs;
  }

  function buildLineMap(rootEl, text) {
    var lines = [], line = 1, last = 0, m;
    var re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<([A-Za-z_][^\s\/>]*)/g;
    while ((m = re.exec(text))) {
      for (var i = text.indexOf('\n', last); i !== -1 && i < m.index; i = text.indexOf('\n', i + 1)) line++;
      last = m.index;
      if (m[1]) lines.push(line);
    }
    var order = [], stack = [rootEl];
    while (stack.length) {
      var el = stack.pop();
      order.push(el);
      var k = kids(el);
      for (var j = k.length - 1; j >= 0; j--) stack.push(k[j]);
    }
    if (order.length !== lines.length) return null;
    var map = new Map();
    order.forEach(function (el, idx) { map.set(el, lines[idx]); });
    return map;
  }

  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    var err = doc.getElementsByTagName('parsererror')[0];
    if (err) return { doc: null, error: err.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) };
    return { doc: doc, error: null };
  }

  function validate(doc, schema, opts) {
    opts = opts || {};
    var maxErrors = opts.maxErrors || 1000;
    var result = { errors: [], total: 0, truncated: false, stats: { elements: 0, td: 0 } };
    var lineMap = opts.text ? buildLineMap(doc.documentElement, opts.text) : null;

    function add(el, path, ctx, message) {
      result.total++;
      if (result.errors.length >= maxErrors) { result.truncated = true; return; }
      result.errors.push({ line: (lineMap && lineMap.get(el)) || null, path: path, ctx: ctx, message: message });
    }

    function checkAttrs(el, path, ctx) {
      for (var i = 0; i < el.attributes.length; i++) {
        var n = el.attributes[i].name;
        if (n === 'xmlns' || n.indexOf('xmlns:') === 0 || n.indexOf('xsi:') === 0) continue;
        add(el, path, ctx, 'Attribute "' + n + '" is not allowed');
      }
    }

    function visit(el, path, ctx) {
      var def = schema.elements[el.localName];
      if (!def) return;
      result.stats.elements++;
      if (el.localName === 'td') {
        result.stats.td++;
        var bill = child(el, 'td_bill_code');
        ctx = bill ? bill.textContent.trim() : '';
      }
      checkAttrs(el, path, ctx);
      if (def.kind === 'simple') {
        if (kids(el).length) add(el, path, ctx, 'Must not contain child elements');
        else checkSimple(el.textContent, def).forEach(function (m) { add(el, path, ctx, m); });
        return;
      }
      visitComplex(el, def, path, ctx);
    }

    function visitComplex(el, def, path, ctx) {
      for (var t = el.firstChild; t; t = t.nextSibling) {
        if ((t.nodeType === 3 || t.nodeType === 4) && t.nodeValue.trim()) {
          add(el, path, ctx, 'Unexpected text content ' + quote(t.nodeValue.trim()));
          break;
        }
      }
      var children = kids(el), totals = {}, seen = {}, names = {}, ci = 0;
      def.particles.forEach(function (p) { names[p.ref] = true; });
      children.forEach(function (c) { totals[c.localName] = (totals[c.localName] || 0) + 1; });
      var paths = children.map(function (c) {
        var nm = c.localName;
        seen[nm] = (seen[nm] || 0) + 1;
        return path + '/' + nm + (totals[nm] > 1 ? '[' + seen[nm] + ']' : '');
      });

      function stray(idx) {
        var nm = children[idx].localName;
        add(children[idx], paths[idx], ctx, names[nm]
          ? 'Element <' + nm + '> is out of order or repeated too many times'
          : 'Unexpected element <' + nm + '>');
      }

      for (var i = 0; i < def.particles.length; i++) {
        var p = def.particles[i], remaining = {}, count = 0;
        for (var j = i; j < def.particles.length; j++) remaining[def.particles[j].ref] = true;
        while (ci < children.length && !remaining[children[ci].localName]) stray(ci++);
        while (ci < children.length && count < p.max && children[ci].localName === p.ref) {
          visit(children[ci], paths[ci], ctx);
          ci++;
          count++;
        }
        if (count < p.min) {
          add(el, path, ctx, 'Missing required element <' + p.ref + '>' +
            (children[ci] ? ' (found <' + children[ci].localName + '> instead)' : ''));
        }
      }
      while (ci < children.length) stray(ci++);
    }

    var rootEl = doc.documentElement;
    if (rootEl.localName !== 'message') {
      add(rootEl, rootEl.localName, '', 'Root element must be <message>');
    } else {
      visit(rootEl, 'message', '');
    }
    return result;
  }

  return { parseSchema: parseSchema, parseXml: parseXml, validate: validate };
});
