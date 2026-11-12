// SiliconPath RTL subset engine.
//
// Parses and simulates a small, defined subset of synthesizable Verilog-2005
// so learners get immediate feedback in the browser. It is NOT a Verilog
// simulator: values are 2-state (0/1) with a pessimistic "unknown" for
// never-initialized registers, there is no event timing or delay, and any
// construct outside the subset is rejected with an explanation.
// scripts/rtl-crosscheck.mjs compares this engine with Icarus Verilog on
// every reference design, bugged variant and a width-rule corpus.
//
// Learner source is tokenized and interpreted; it is never executed as
// JavaScript.
(function (root) {
  const LIMITS = {
    source: 8000,
    signals: 96,
    width: 16,
    literalWidth: 32,
    instances: 16,
    depth: 4,
    cycles: 200,
  };

  class RtlError extends Error {
    constructor(message, line) {
      super(line ? `Line ${line}: ${message}` : message);
      this.line = line || null;
      this.reason = message;
    }
  }

  /* ---------------- Lexer ---------------- */
  const KEYWORDS = new Set([
    "module",
    "endmodule",
    "input",
    "output",
    "wire",
    "reg",
    "assign",
    "always",
    "begin",
    "end",
    "if",
    "else",
    "case",
    "endcase",
    "default",
    "posedge",
    "or",
  ]);
  const UNSUPPORTED = {
    initial:
      "`initial` blocks belong in testbenches. Designs in this subset reset through an input instead.",
    integer: "`integer` variables are outside the subset; use `reg [n:0]`.",
    for: "`for` loops are outside the subset; write the logic out explicitly.",
    while: "`while` loops are outside the subset.",
    repeat: "`repeat` is outside the subset.",
    forever: "`forever` is outside the subset.",
    negedge: "Only `posedge` clocks are supported in this subset.",
    signed:
      "Signed arithmetic is outside the subset; all values are unsigned here.",
    parameter: "Parameters are outside the subset; use fixed widths.",
    localparam: "`localparam` is outside the subset; write constants directly.",
    function: "Functions are outside the subset.",
    task: "Tasks are outside the subset.",
    generate: "`generate` is outside the subset.",
    genvar: "`genvar` is outside the subset.",
    inout: "`inout` ports are outside the subset.",
    tri: "Tri-state nets are outside the subset.",
    logic:
      "`logic` is SystemVerilog. This subset is Verilog-2005: use `wire` or `reg`.",
    always_ff:
      "`always_ff` is SystemVerilog. Use `always @(posedge clk)` in this subset.",
    always_comb:
      "`always_comb` is SystemVerilog. Use `always @(*)` in this subset.",
    always_latch: "Latches are outside the subset.",
    casez: "`casez` is outside the subset; use `case`.",
    casex: "`casex` is outside the subset; use `case`.",
    assert: "Assertions are outside the subset.",
    fork: "`fork` is outside the subset.",
    wait: "`wait` is outside the subset.",
    deassign: "`deassign` is outside the subset.",
    force: "`force` is outside the subset.",
  };
  const OPS = [
    "===",
    "!==",
    "<<<",
    ">>>",
    "~^",
    "^~",
    "~&",
    "~|",
    "&&",
    "||",
    "==",
    "!=",
    "<=",
    ">=",
    "<<",
    ">>",
    "**",
    "~",
    "!",
    "&",
    "|",
    "^",
    "+",
    "-",
    "<",
    ">",
    "?",
    ":",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    ",",
    ";",
    ".",
    "@",
    "=",
    "*",
    "#",
    "/",
    "%",
  ];
  const BASES = { b: 2n, o: 8n, d: 10n, h: 16n };

  function lex(src) {
    if (typeof src !== "string") throw new RtlError("No source code.");
    if (src.length > LIMITS.source)
      throw new RtlError(
        `Source is longer than ${LIMITS.source} characters; designs in this track are small.`,
      );
    const toks = [];
    let i = 0,
      line = 1;
    while (i < src.length) {
      const c = src[i];
      if (c === "\n") {
        line++;
        i++;
        continue;
      }
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (src.startsWith("//", i)) {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (src.startsWith("/*", i)) {
        const end = src.indexOf("*/", i + 2);
        if (end < 0) throw new RtlError("Unclosed /* comment.", line);
        for (let k = i; k < end; k++) if (src[k] === "\n") line++;
        i = end + 2;
        continue;
      }
      if (c === "`") {
        const m = /^`(\w+)[^\n]*/.exec(src.slice(i));
        if (m && (m[1] === "timescale" || m[1] === "default_nettype")) {
          i += m[0].length;
          continue;
        }
        throw new RtlError(
          `Compiler directive \`${m ? m[1] : ""} is outside the subset.`,
          line,
        );
      }
      if (c === "$")
        throw new RtlError(
          "System tasks such as $display belong in testbenches, not in the design.",
          line,
        );
      if (c === '"')
        throw new RtlError("Strings are outside the subset.", line);
      const rest = src.slice(i, i + 80);
      const num =
        /^(\d[\d_]*)?\s*'\s*([sS]?)([bBoOdDhH])\s*([0-9a-zA-Z_?]+)/.exec(
          rest,
        ) || /^(\d[\d_]*)/.exec(rest);
      if (num && (num[3] || /^\d/.test(c))) {
        toks.push(number(num, line));
        i += num[0].length;
        continue;
      }
      if (c === "'")
        throw new RtlError(
          "Malformed number literal; write e.g. 4'b1010.",
          line,
        );
      const id = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(rest);
      if (id) {
        const v = id[0];
        if (Object.hasOwn(UNSUPPORTED, v))
          throw new RtlError(UNSUPPORTED[v], line);
        // Names are used as keys in lookup tables; refuse the few that
        // collide with JavaScript object properties.
        if (v in Object.prototype || v === "__proto__")
          throw new RtlError(`"${v}" cannot be used as a name here.`, line);
        toks.push({ t: KEYWORDS.has(v) ? "kw" : "id", v, line });
        i += v.length;
        continue;
      }
      if (c === "\\")
        throw new RtlError("Escaped identifiers are outside the subset.", line);
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new RtlError(`Unexpected character "${c}".`, line);
      toks.push({ t: "op", v: op, line });
      i += op.length;
    }
    toks.push({ t: "eof", v: "end of file", line });
    return toks;
  }

  function number(m, line) {
    if (!m[3]) {
      const value = BigInt(m[1].replace(/_/g, ""));
      if (value >= 1n << 32n)
        throw new RtlError("Number is wider than 32 bits.", line);
      return { t: "num", v: m[0], line, value, width: 32, sized: false };
    }
    if (m[2])
      throw new RtlError(
        "Signed literals are outside the subset; all values are unsigned here.",
        line,
      );
    const width = m[1] ? Number(m[1].replace(/_/g, "")) : 32;
    if (!width || width > LIMITS.literalWidth)
      throw new RtlError(
        `Literal width must be between 1 and ${LIMITS.literalWidth}.`,
        line,
      );
    const base = BASES[m[3].toLowerCase()];
    const digits = m[4].replace(/_/g, "").toLowerCase();
    if (/[xz?]/.test(digits))
      throw new RtlError(
        "x and z values are outside this 2-state subset; use 0 or 1.",
        line,
      );
    let value = 0n;
    for (const d of digits) {
      const n = BigInt(parseInt(d, 36));
      if (Number.isNaN(parseInt(d, 36)) || n >= base)
        throw new RtlError(`"${d}" is not a valid digit in ${m[0]}.`, line);
      value = value * base + n;
    }
    return {
      t: "num",
      v: m[0],
      line,
      value: value & mask(width),
      width,
      sized: true,
    };
  }

  /* ---------------- Parser ---------------- */
  // Verilog operator precedence, lowest first.
  const BIN = [
    ["||"],
    ["&&"],
    ["|"],
    ["^", "~^", "^~"],
    ["&"],
    ["==", "!="],
    ["<", "<=", ">", ">="],
    ["<<", ">>"],
    ["+", "-"],
  ];
  const REJECT = {
    "===": "Use == in this 2-state subset (=== compares x and z values).",
    "!==": "Use != in this 2-state subset.",
    "<<<": "Arithmetic shifts are outside the subset.",
    ">>>": "Arithmetic shifts are outside the subset.",
    "*": "Multiplication is outside the subset.",
    "/": "Division is outside the subset.",
    "%": "Modulo is outside the subset.",
    "**": "Power is outside the subset.",
  };
  function parse(src) {
    const toks = lex(src);
    let p = 0;
    const peek = (k = 0) => toks[p + k];
    const is = (v, k = 0) =>
      (toks[p + k].t === "op" || toks[p + k].t === "kw") && toks[p + k].v === v;
    const take = () => toks[p++];
    const fail = (msg, tok = peek()) => {
      throw new RtlError(msg, tok.line);
    };
    const expect = (v, what) => {
      if (!is(v)) fail(`Expected ${what || `"${v}"`} but found "${peek().v}".`);
      return take();
    };
    const ident = (what) => {
      if (peek().t !== "id")
        fail(
          `Expected ${what} but found "${peek().v}"${peek().t === "kw" ? " (a reserved word)" : ""}.`,
        );
      return take();
    };
    const constInt = (what) => {
      if (peek().t !== "num") fail(`Expected a constant ${what}.`);
      return Number(take().value);
    };
    function range() {
      if (!is("[")) return 1;
      const t = take();
      const msb = constInt("bit index");
      expect(":");
      const lsb = constInt("bit index");
      expect("]");
      if (lsb !== 0) fail("Write vector ranges as [msb:0] in this subset.", t);
      const w = msb + 1;
      if (w > LIMITS.width)
        fail(`Signals are limited to ${LIMITS.width} bits in this subset.`, t);
      return w;
    }

    const modules = {};
    while (peek().t !== "eof") {
      if (!is("module")) fail(`Expected "module" but found "${peek().v}".`);
      const mod = parseModule();
      if (modules[mod.name])
        throw new RtlError(`Module ${mod.name} is defined twice.`, mod.line);
      modules[mod.name] = mod;
    }
    if (!Object.keys(modules).length)
      throw new RtlError("No module found. Start with: module name ( ... );");
    return { modules };

    function parseModule() {
      const kw = take();
      const name = ident("a module name").v;
      const mod = { name, line: kw.line, decls: {}, ports: [], items: [] };
      const declare = (n, d, tok) => {
        if (mod.decls[n])
          throw new RtlError(`"${n}" is declared twice.`, tok.line);
        mod.decls[n] = d;
      };
      expect("(", '"(" after the module name');
      if (!is(")")) {
        let cur = null;
        do {
          if (is("input") || is("output")) {
            const dir = take().v;
            let kind = "wire";
            if (is("wire") || is("reg")) kind = take().v;
            if (dir === "input" && kind === "reg")
              fail("Inputs cannot be declared reg.");
            cur = { dir, kind, width: range() };
          } else if (!cur)
            fail(
              "Declare port directions in the module header (ANSI style), e.g. module m (input wire a, output wire y);",
            );
          const t = ident("a port name");
          declare(t.v, { ...cur, line: t.line }, t);
          mod.ports.push(t.v);
        } while (is(",") && take());
      }
      expect(")");
      expect(";");
      while (!is("endmodule")) {
        if (peek().t === "eof") fail(`Missing "endmodule" for ${name}.`);
        item(mod, declare);
      }
      take();
      return mod;
    }

    function item(mod, declare) {
      const t = peek();
      if (is("input") || is("output"))
        fail(
          "Declare ports in the module header (ANSI style), not in the body.",
        );
      if (is("wire") || is("reg")) {
        const kind = take().v;
        const width = range();
        do {
          const n = ident("a signal name");
          declare(n.v, { dir: null, kind, width, line: n.line }, n);
          if (is("=")) {
            if (kind === "reg")
              fail("Initial values on reg are outside the subset.");
            take();
            mod.items.push({
              t: "assign",
              lhs: { t: "id", name: n.v, line: n.line },
              rhs: expr(),
              line: n.line,
            });
          }
        } while (is(",") && take());
        expect(";");
        return;
      }
      if (is("assign")) {
        take();
        do {
          const lhs = lvalue();
          expect("=");
          mod.items.push({ t: "assign", lhs, rhs: expr(), line: t.line });
        } while (is(",") && take());
        expect(";");
        return;
      }
      if (is("always")) {
        take();
        expect("@", '"@" after always');
        let clock = null;
        if (is("*")) take();
        else {
          expect("(");
          if (is("*")) take();
          else if (is("posedge")) {
            take();
            clock = ident("a clock name").v;
          } else
            fail(
              "Use @(*) for combinational logic or @(posedge clk) for registers. Hand-written sensitivity lists are outside the subset because a missing signal makes simulation disagree with synthesis.",
            );
          expect(")");
        }
        mod.items.push({
          t: clock ? "seq" : "comb",
          clock,
          body: stmt(),
          line: t.line,
        });
        return;
      }
      if (peek().t === "id" && peek(1).t === "id") {
        const type = take().v;
        const inst = take().v;
        expect("(");
        const conns = {};
        if (!is(")"))
          do {
            if (!is("."))
              fail(
                "Connect instance ports by name, e.g. .a(x), so a reordered port list cannot silently miswire the design.",
              );
            take();
            const port = ident("a port name");
            if (port.v in conns)
              fail(`Port ${port.v} is connected twice.`, port);
            expect("(");
            conns[port.v] = is(")") ? null : expr();
            expect(")");
          } while (is(",") && take());
        expect(")");
        expect(";");
        mod.items.push({ t: "inst", type, inst, conns, line: t.line });
        return;
      }
      fail(`Unexpected "${t.v}" in module body.`);
    }

    function stmt() {
      const t = peek();
      if (is(";")) {
        take();
        return { t: "block", body: [], line: t.line };
      }
      if (is("begin")) {
        take();
        if (is(":")) fail("Named blocks are outside the subset.");
        const body = [];
        while (!is("end")) {
          if (peek().t === "eof") fail('Missing "end".', t);
          body.push(stmt());
        }
        take();
        return { t: "block", body, line: t.line };
      }
      if (is("if")) {
        take();
        expect("(");
        const cond = expr();
        expect(")");
        const then = stmt();
        let els = null;
        if (is("else")) {
          take();
          els = stmt();
        }
        return { t: "if", cond, then, els, line: t.line };
      }
      if (is("case")) {
        take();
        expect("(");
        const sel = expr();
        expect(")");
        const items = [];
        let def = null;
        while (!is("endcase")) {
          if (peek().t === "eof") fail('Missing "endcase".', t);
          if (is("default")) {
            const d = take();
            if (def) fail("A case can have only one default.", d);
            if (is(":")) take();
            def = stmt();
            continue;
          }
          const labels = [expr()];
          while (is(",")) {
            take();
            labels.push(expr());
          }
          expect(":");
          items.push({ labels, body: stmt() });
        }
        take();
        return { t: "case", sel, items, def, line: t.line };
      }
      if (is("#"))
        fail(
          "Delays (#) do not become hardware and are outside the subset. Timing is covered in Module 4.",
        );
      const lhs = lvalue();
      let op;
      if (is("=") || is("<=")) op = take().v;
      else fail('Expected "=" or "<=" in an assignment.');
      const rhs = expr();
      expect(";");
      return {
        t: "set",
        nb: op === "<=",
        lhs,
        rhs,
        line: t.line,
      };
    }

    function lvalue() {
      const t = peek();
      if (is("{")) {
        take();
        const parts = [lvalue()];
        while (is(",")) {
          take();
          parts.push(lvalue());
        }
        expect("}");
        return { t: "concat", parts, line: t.line };
      }
      const n = ident("a signal to assign");
      const node = { t: "id", name: n.v, line: n.line };
      if (!is("[")) return node;
      take();
      const a = constInt("bit index");
      if (is(":")) {
        take();
        const b = constInt("bit index");
        expect("]");
        return { t: "part", name: n.v, msb: a, lsb: b, line: n.line };
      }
      expect("]");
      return { t: "bit", name: n.v, msb: a, lsb: a, line: n.line };
    }

    function expr() {
      const c = binary(0);
      if (is("?")) {
        const t = take();
        const a = expr();
        expect(":");
        const b = expr();
        return { t: "cond", c, a, b, line: t.line };
      }
      return c;
    }
    function binary(level) {
      if (level === BIN.length) return unary();
      let left = binary(level + 1);
      for (;;) {
        const tok = peek();
        if (tok.t === "op" && REJECT[tok.v]) fail(REJECT[tok.v]);
        if (tok.t !== "op" || !BIN[level].includes(tok.v)) return left;
        take();
        left = {
          t: "bin",
          op: tok.v === "^~" ? "~^" : tok.v,
          a: left,
          b: binary(level + 1),
          line: tok.line,
        };
      }
    }
    function unary() {
      const tok = peek();
      if (
        tok.t === "op" &&
        ["~", "!", "&", "|", "^", "~&", "~|", "~^", "^~", "-", "+"].includes(
          tok.v,
        )
      ) {
        take();
        return {
          t: "un",
          op: tok.v === "^~" ? "~^" : tok.v,
          a: unary(),
          line: tok.line,
        };
      }
      return primary();
    }
    function primary() {
      const tok = peek();
      if (tok.t === "num") {
        take();
        return {
          t: "num",
          value: tok.value,
          width: tok.width,
          line: tok.line,
        };
      }
      if (is("(")) {
        take();
        const e = expr();
        expect(")");
        return e;
      }
      if (is("{")) {
        take();
        const first = expr();
        if (is("{")) {
          if (first.t !== "num")
            fail("The replication count must be a constant, e.g. {4{a}}.");
          take();
          const parts = [expr()];
          while (is(",")) {
            take();
            parts.push(expr());
          }
          expect("}");
          expect("}");
          const n = Number(first.value);
          if (n < 1 || n > LIMITS.literalWidth)
            fail("Replication count is out of range.", tok);
          return { t: "repl", n, parts, line: tok.line };
        }
        const parts = [first];
        while (is(",")) {
          take();
          parts.push(expr());
        }
        expect("}");
        return { t: "concat", parts, line: tok.line };
      }
      if (tok.t === "id") {
        take();
        if (is("(")) fail("Function calls are outside the subset.");
        if (!is("[")) return { t: "id", name: tok.v, line: tok.line };
        take();
        const idx = expr();
        if (is(":")) {
          take();
          if (idx.t !== "num") fail("Part-select bounds must be constants.");
          const lsb = constInt("bit index");
          expect("]");
          return {
            t: "part",
            name: tok.v,
            msb: Number(idx.value),
            lsb,
            line: tok.line,
          };
        }
        expect("]");
        if (idx.t === "num")
          return {
            t: "bit",
            name: tok.v,
            msb: Number(idx.value),
            lsb: Number(idx.value),
            line: tok.line,
          };
        return { t: "index", name: tok.v, idx, line: tok.line };
      }
      fail(`Expected a value but found "${tok.v}".`);
    }
  }

  /* ---------------- Elaboration ---------------- */
  // Flattens the hierarchy under `top` into one list of signals and processes,
  // and rejects designs whose meaning would differ between simulation and
  // synthesis (multiple drivers, latches, loops, undriven outputs).
  function elaborate(parsed, top) {
    const mods = parsed.modules;
    if (!top) top = Object.keys(mods).pop();
    if (!mods[top]) throw new RtlError(`Module ${top} is not defined.`);
    const signals = {};
    const procs = [];
    let instances = 0;

    function walk(mod, prefix, depth, stack) {
      if (depth > LIMITS.depth)
        throw new RtlError("Module hierarchy is nested too deeply.");
      for (const [n, d] of Object.entries(mod.decls)) {
        signals[prefix + n] = {
          name: prefix + n,
          width: d.width,
          kind: d.kind,
          dir: prefix ? null : d.dir,
          portDir: d.dir,
          line: d.line,
        };
        if (Object.keys(signals).length > LIMITS.signals)
          throw new RtlError(
            `Designs are limited to ${LIMITS.signals} signals in this subset.`,
          );
      }
      const r = (e) => resolve(e, mod, prefix);
      for (const it of mod.items) {
        if (it.t === "assign")
          procs.push({
            t: "assign",
            lhs: r(it.lhs),
            rhs: r(it.rhs),
            line: it.line,
          });
        else if (it.t === "comb" || it.t === "seq")
          procs.push({
            t: it.t,
            clock: it.clock
              ? r({ t: "id", name: it.clock, line: it.line })
              : null,
            body: rs(it.body, r),
            line: it.line,
          });
        else {
          const child = mods[it.type];
          if (!child)
            throw new RtlError(`Module ${it.type} is not defined.`, it.line);
          if (stack.includes(it.type))
            throw new RtlError(
              `Module ${it.type} instantiates itself.`,
              it.line,
            );
          if (++instances > LIMITS.instances)
            throw new RtlError("Too many module instances.", it.line);
          const cp = prefix + it.inst + ".";
          if (signals[prefix + it.inst])
            throw new RtlError(
              `Instance name ${it.inst} clashes with a signal.`,
              it.line,
            );
          for (const port of Object.keys(it.conns))
            if (!child.decls[port] || !child.decls[port].dir)
              throw new RtlError(
                `Module ${it.type} has no port named ${port}.`,
                it.line,
              );
          walk(child, cp, depth + 1, [...stack, it.type]);
          for (const port of child.ports) {
            const d = child.decls[port];
            const conn = it.conns[port];
            const inner = { t: "id", name: cp + port, line: it.line };
            if (conn === undefined || conn === null) {
              if (d.dir === "input")
                throw new RtlError(
                  `Input ${port} of ${it.inst} is not connected.`,
                  it.line,
                );
              continue;
            }
            if (d.dir === "input")
              procs.push({
                t: "assign",
                lhs: inner,
                rhs: r(conn),
                line: it.line,
                port: true,
              });
            else {
              if (!["id", "bit", "part", "concat"].includes(conn.t))
                throw new RtlError(
                  `Output ${port} of ${it.inst} must connect to a signal.`,
                  it.line,
                );
              procs.push({
                t: "assign",
                lhs: r(conn),
                rhs: inner,
                line: it.line,
                port: true,
              });
            }
          }
        }
      }
    }
    function rs(s, r) {
      if (s.t === "block") return { ...s, body: s.body.map((x) => rs(x, r)) };
      if (s.t === "if")
        return {
          ...s,
          cond: r(s.cond),
          then: rs(s.then, r),
          els: s.els && rs(s.els, r),
        };
      if (s.t === "case")
        return {
          ...s,
          sel: r(s.sel),
          items: s.items.map((i) => ({
            labels: i.labels.map(r),
            body: rs(i.body, r),
          })),
          def: s.def && rs(s.def, r),
        };
      return { ...s, lhs: r(s.lhs), rhs: r(s.rhs) };
    }
    function resolve(e, mod, prefix) {
      if (!e) return e;
      const out = { ...e };
      if ("name" in e) {
        if (!mod.decls[e.name])
          throw new RtlError(`"${e.name}" is not declared.`, e.line);
        out.name = prefix + e.name;
        const w = mod.decls[e.name].width;
        if ((e.t === "bit" || e.t === "part") && (e.msb >= w || e.lsb > e.msb))
          throw new RtlError(
            `${e.name}[${e.msb}${e.t === "part" ? ":" + e.lsb : ""}] is outside ${e.name}'s range [${w - 1}:0].`,
            e.line,
          );
      }
      for (const k of ["a", "b", "c", "idx"])
        if (e[k]) out[k] = resolve(e[k], mod, prefix);
      if (e.parts) out.parts = e.parts.map((x) => resolve(x, mod, prefix));
      return out;
    }

    walk(mods[top], "", 0, [top]);
    for (const p of procs)
      if (p.t === "seq" && signals[p.clock.name].width !== 1)
        throw new RtlError("The clock must be a 1-bit signal.", p.line);
    const design = { top, signals, procs, ports: mods[top].ports.slice() };
    checkDrivers(design);
    for (const p of procs) if (p.t === "comb") analyzeComb(p, design);
    design.order = combOrder(design);
    return design;
  }

  const widthOf = (e, sig) => sw(e, sig);
  function lhsBits(l, design) {
    // Returns [{name, mask}] for the bits an lvalue writes.
    if (l.t === "concat") return l.parts.flatMap((x) => lhsBits(x, design));
    const s = design.signals[l.name];
    if (l.t === "id") return [{ name: l.name, mask: mask(s.width) }];
    return [{ name: l.name, mask: mask(l.msb - l.lsb + 1) << BigInt(l.lsb) }];
  }
  function stmtWrites(s, design, out = []) {
    if (s.t === "block") s.body.forEach((x) => stmtWrites(x, design, out));
    else if (s.t === "if") {
      stmtWrites(s.then, design, out);
      if (s.els) stmtWrites(s.els, design, out);
    } else if (s.t === "case") {
      s.items.forEach((i) => stmtWrites(i.body, design, out));
      if (s.def) stmtWrites(s.def, design, out);
    } else out.push(...lhsBits(s.lhs, design).map((b) => ({ ...b, stmt: s })));
    return out;
  }

  function checkDrivers(design) {
    const driven = {};
    for (const [i, p] of design.procs.entries()) {
      const writes =
        p.t === "assign"
          ? lhsBits(p.lhs, design).map((b) => ({ ...b, stmt: p }))
          : stmtWrites(p.body, design);
      const mine = {};
      for (const w of writes) {
        const s = design.signals[w.name];
        if (s.dir === "input" || (s.portDir === "input" && !p.port))
          throw new RtlError(
            `"${w.name}" is an input and cannot be assigned inside the module.`,
            w.stmt.line,
          );
        if (p.t === "assign" && s.kind === "reg")
          throw new RtlError(
            `"${w.name}" is declared reg, so it must be assigned inside an always block. Declare it wire to use assign.`,
            p.line,
          );
        if (p.t !== "assign" && s.kind !== "reg")
          throw new RtlError(
            `"${w.name}" is assigned inside an always block, so it must be declared reg.`,
            w.stmt.line,
          );
        if (p.t === "comb" && w.stmt.nb)
          throw new RtlError(
            "Use blocking assignment (=) inside always @(*).",
            w.stmt.line,
          );
        if (p.t === "seq" && !w.stmt.nb)
          throw new RtlError(
            "Use non-blocking assignment (<=) inside clocked always blocks, so every register updates from the values before the clock edge.",
            w.stmt.line,
          );
        mine[w.name] = (mine[w.name] || 0n) | w.mask;
      }
      for (const [n, m] of Object.entries(mine)) {
        if ((driven[n] || 0n) & m)
          throw new RtlError(
            `"${n}" is driven by more than one assign or always block.`,
            p.line,
          );
        driven[n] = (driven[n] || 0n) | m;
      }
      p.writes = mine;
      p.index = i;
    }
    for (const s of Object.values(design.signals)) {
      if (s.dir === "input") continue;
      const d = driven[s.name] || 0n;
      if (d !== mask(s.width) && (s.dir === "output" || used(design, s.name))) {
        const where = s.name.includes(".")
          ? ` (inside ${s.name.split(".")[0]})`
          : "";
        throw new RtlError(
          d
            ? `Some bits of "${s.name}" are never assigned${where}.`
            : `"${s.name}" is never assigned${where}.`,
          s.line,
        );
      }
    }
    design.driven = driven;
  }
  function used(design, name) {
    let hit = false;
    const visit = (e) => {
      if (!e || hit) return;
      if (e.name === name) hit = true;
      ["a", "b", "c", "idx"].forEach((k) => visit(e[k]));
      (e.parts || []).forEach(visit);
    };
    const vs = (s) => {
      if (s.t === "block") s.body.forEach(vs);
      else if (s.t === "if") {
        visit(s.cond);
        vs(s.then);
        if (s.els) vs(s.els);
      } else if (s.t === "case") {
        visit(s.sel);
        s.items.forEach((i) => {
          i.labels.forEach(visit);
          vs(i.body);
        });
        if (s.def) vs(s.def);
      } else visit(s.rhs);
    };
    for (const p of design.procs) {
      if (p.t === "assign") visit(p.rhs);
      else vs(p.body);
      if (p.clock) visit(p.clock);
    }
    return hit;
  }

  // Bits read by an expression: [{name, mask}].
  function readBits(e, design, out = []) {
    if (!e) return out;
    if (e.t === "id")
      out.push({ name: e.name, mask: mask(design.signals[e.name].width) });
    else if (e.t === "bit" || e.t === "part")
      out.push({
        name: e.name,
        mask: mask(e.msb - e.lsb + 1) << BigInt(e.lsb),
      });
    else if (e.t === "index") {
      out.push({ name: e.name, mask: mask(design.signals[e.name].width) });
      readBits(e.idx, design, out);
    }
    for (const k of ["a", "b", "c"]) if (e[k]) readBits(e[k], design, out);
    (e.parts || []).forEach((x) => readBits(x, design, out));
    return out;
  }

  // Definite-assignment analysis for always @(*): every written bit must be
  // assigned on every path (otherwise synthesis infers a latch), and a block
  // must not read a bit it writes before assigning it (feedback).
  function analyzeComb(p, design) {
    const reads = {};
    const note = (bits, assigned, line) => {
      for (const b of bits) {
        const own = p.writes[b.name] || 0n;
        const before = b.mask & own & ~(assigned[b.name] || 0n);
        if (before)
          throw new RtlError(
            `This always @(*) block reads "${b.name}" before assigning it. That describes feedback (a latch or loop), not combinational logic.`,
            line,
          );
        const ext = b.mask & ~(assigned[b.name] || 0n);
        if (ext) reads[b.name] = (reads[b.name] || 0n) | ext;
      }
    };
    const exprReads = (e, assigned, line) =>
      note(readBits(e, design), assigned, line);
    const merge = (a, b) => {
      const out = {};
      for (const k of Object.keys(a)) if (k in b) out[k] = a[k] & b[k];
      return out;
    };
    function run(s, assigned) {
      if (s.t === "block") {
        let cur = assigned;
        for (const x of s.body) cur = run(x, cur);
        return cur;
      }
      if (s.t === "if") {
        exprReads(s.cond, assigned, s.line);
        const a = run(s.then, { ...assigned });
        const b = s.els ? run(s.els, { ...assigned }) : { ...assigned };
        return merge(a, b);
      }
      if (s.t === "case") {
        exprReads(s.sel, assigned, s.line);
        s.items.forEach((i) =>
          i.labels.forEach((l) => exprReads(l, assigned, s.line)),
        );
        let paths = s.items.map((i) => run(i.body, { ...assigned }));
        if (s.def) paths.push(run(s.def, { ...assigned }));
        else if (!caseIsFull(s, design)) paths.push({ ...assigned });
        return paths.reduce(merge);
      }
      exprReads(s.rhs, assigned, s.line);
      const out = { ...assigned };
      for (const b of lhsBits(s.lhs, design))
        out[b.name] = (out[b.name] || 0n) | b.mask;
      return out;
    }
    const end = run(p.body, {});
    for (const [n, m] of Object.entries(p.writes))
      if (((end[n] || 0n) & m) !== m) {
        const err = new RtlError(
          `Latch inferred: "${n}" is not assigned on every path through this always @(*) block, so the hardware must remember its old value. Assign it in every branch (or set a default at the top of the block).`,
          p.line,
        );
        err.latch = n;
        throw err;
      }
    p.reads = reads;
  }
  function caseIsFull(s, design) {
    const w = sw(s.sel, design.signals);
    if (w > 8) return false;
    if (!s.items.every((i) => i.labels.every((l) => l.t === "num")))
      return false;
    const seen = new Set();
    for (const i of s.items)
      for (const l of i.labels)
        if (l.value < 1n << BigInt(w)) seen.add(l.value);
    return seen.size === 2 ** w;
  }

  // Orders combinational processes so one pass settles the design; a cycle is
  // a combinational loop.
  function combOrder(design) {
    const comb = design.procs.filter((p) => p.t !== "seq");
    for (const p of comb)
      if (p.t === "assign") {
        p.reads = {};
        for (const b of readBits(p.rhs, design))
          p.reads[b.name] = (p.reads[b.name] || 0n) | b.mask;
      }
    const deps = new Map(comb.map((p) => [p, []]));
    for (const q of comb)
      for (const p of comb)
        if (Object.entries(q.reads).some(([n, m]) => (p.writes[n] || 0n) & m))
          deps.get(q).push(p);
    const order = [],
      state = new Map();
    const visit = (p, path) => {
      if (state.get(p) === 2) return;
      if (state.get(p) === 1) {
        const names = path
          .slice(path.indexOf(p))
          .map((x) => Object.keys(x.writes)[0]);
        throw new RtlError(
          `Combinational loop: ${[...names, names[0]].join(" → ")}. A signal must not depend on itself without a register in between.`,
          p.line,
        );
      }
      state.set(p, 1);
      for (const d of deps.get(p)) visit(d, [...path, p]);
      state.set(p, 2);
      order.push(p);
    };
    for (const p of comb) visit(p, []);
    return order;
  }

  /* ---------------- Values and widths ---------------- */
  // Values are BigInt, or null for "unknown" (a register that has never been
  // assigned, or anything computed from one).
  const mask = (w) => (1n << BigInt(w)) - 1n;
  // Self-determined width (IEEE 1364-2005 Table 5-22, unsigned only).
  function sw(e, sig) {
    switch (e.t) {
      case "num":
        return e.width;
      case "id":
        return sig[e.name].width;
      case "bit":
      case "index":
        return 1;
      case "part":
        return e.msb - e.lsb + 1;
      case "un":
        return ["~", "-", "+"].includes(e.op) ? sw(e.a, sig) : 1;
      case "bin":
        if (["==", "!=", "<", "<=", ">", ">=", "&&", "||"].includes(e.op))
          return 1;
        if (e.op === "<<" || e.op === ">>") return sw(e.a, sig);
        return Math.max(sw(e.a, sig), sw(e.b, sig));
      case "cond":
        return Math.max(sw(e.a, sig), sw(e.b, sig));
      case "concat":
        return e.parts.reduce((s, x) => s + sw(x, sig), 0);
      case "repl":
        return e.n * e.parts.reduce((s, x) => s + sw(x, sig), 0);
    }
    throw new Error("unknown node " + e.t);
  }
  // Evaluates `e` at context width `w` (w >= its self-determined width).
  function ev(e, w, vals, sig) {
    const m = mask(w);
    switch (e.t) {
      case "num":
        return e.value & m;
      case "id":
        return vals[e.name];
      case "bit":
      case "part": {
        const v = vals[e.name];
        return v === null
          ? null
          : (v >> BigInt(e.lsb)) & mask(e.msb - e.lsb + 1);
      }
      case "index": {
        const v = vals[e.name],
          i = ev(e.idx, sw(e.idx, sig), vals, sig);
        if (v === null || i === null || i >= BigInt(sig[e.name].width))
          return null;
        return (v >> i) & 1n;
      }
      case "un": {
        if (e.op === "~" || e.op === "-" || e.op === "+") {
          const a = ev(e.a, w, vals, sig);
          if (a === null) return null;
          return e.op === "~" ? ~a & m : e.op === "-" ? -a & m : a;
        }
        const aw = sw(e.a, sig),
          a = ev(e.a, aw, vals, sig);
        if (a === null) return null;
        if (e.op === "!") return a === 0n ? 1n : 0n;
        const all = a === mask(aw),
          any = a !== 0n,
          par = BigInt(a.toString(2).split("1").length % 2 === 0 ? 1 : 0);
        return {
          "&": all ? 1n : 0n,
          "~&": all ? 0n : 1n,
          "|": any ? 1n : 0n,
          "~|": any ? 0n : 1n,
          "^": par,
          "~^": par ^ 1n,
        }[e.op];
      }
      case "bin": {
        const op = e.op;
        if (op === "&&" || op === "||") {
          const a = ev(e.a, sw(e.a, sig), vals, sig),
            b = ev(e.b, sw(e.b, sig), vals, sig);
          if (op === "&&" && (a === 0n || b === 0n)) return 0n;
          if (
            op === "||" &&
            ((a !== null && a !== 0n) || (b !== null && b !== 0n))
          )
            return 1n;
          if (a === null || b === null) return null;
          return op === "&&" ? 1n : 0n;
        }
        if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
          const cw = Math.max(sw(e.a, sig), sw(e.b, sig));
          const a = ev(e.a, cw, vals, sig),
            b = ev(e.b, cw, vals, sig);
          if (a === null || b === null) return null;
          const r = {
            "==": a === b,
            "!=": a !== b,
            "<": a < b,
            "<=": a <= b,
            ">": a > b,
            ">=": a >= b,
          }[op];
          return r ? 1n : 0n;
        }
        if (op === "<<" || op === ">>") {
          const a = ev(e.a, w, vals, sig),
            b = ev(e.b, sw(e.b, sig), vals, sig);
          if (a === null || b === null) return null;
          if (b >= BigInt(w)) return 0n;
          return op === "<<" ? (a << b) & m : a >> b;
        }
        const a = ev(e.a, w, vals, sig),
          b = ev(e.b, w, vals, sig);
        if (a === null || b === null) return null;
        switch (op) {
          case "+":
            return (a + b) & m;
          case "-":
            return (a - b) & m;
          case "&":
            return a & b;
          case "|":
            return a | b;
          case "^":
            return a ^ b;
          case "~^":
            return ~(a ^ b) & m;
        }
        break;
      }
      case "cond": {
        const c = ev(e.c, sw(e.c, sig), vals, sig);
        const a = ev(e.a, w, vals, sig),
          b = ev(e.b, w, vals, sig);
        if (c === null) return a !== null && a === b ? a : null;
        return c !== 0n ? a : b;
      }
      case "concat":
      case "repl": {
        let out = 0n;
        const n = e.t === "repl" ? e.n : 1;
        for (let k = 0; k < n; k++)
          for (const x of e.parts) {
            const xw = sw(x, sig),
              v = ev(x, xw, vals, sig);
            if (v === null) return null;
            out = (out << BigInt(xw)) | v;
          }
        return out & m;
      }
    }
    throw new Error("unknown node " + e.t);
  }

  function writeLhs(l, value, vals, sig, out = vals) {
    if (l.t === "concat") {
      let shift = 0n;
      for (const part of l.parts.slice().reverse()) {
        const pw = BigInt(lw(part, sig));
        writeLhs(
          part,
          value === null ? null : (value >> shift) & mask(pw),
          vals,
          sig,
          out,
        );
        shift += pw;
      }
      return;
    }
    const s = sig[l.name];
    const lsb = l.t === "id" ? 0 : l.lsb,
      width = l.t === "id" ? s.width : l.msb - l.lsb + 1;
    if (value === null) {
      out[l.name] = null;
      return;
    }
    const cur = l.name in out ? out[l.name] : vals[l.name];
    if (l.t === "id") {
      out[l.name] = value & mask(width);
      return;
    }
    if (cur === null) {
      out[l.name] = null;
      return;
    }
    const fm = mask(width) << BigInt(lsb);
    out[l.name] = (cur & ~fm) | ((value & mask(width)) << BigInt(lsb));
  }
  const lw = (l, sig) =>
    l.t === "concat"
      ? l.parts.reduce((s, x) => s + lw(x, sig), 0)
      : l.t === "id"
        ? sig[l.name].width
        : l.msb - l.lsb + 1;

  function assignValue(lhs, rhs, vals, sig) {
    const tw = lw(lhs, sig);
    const w = Math.max(sw(rhs, sig), tw);
    const v = ev(rhs, w, vals, sig);
    return v === null ? null : v & mask(tw);
  }

  // Executes a statement. Blocking writes go to `vals` directly; non-blocking
  // writes are collected in `nb` and applied after every clocked block ran.
  function exec(s, vals, sig, nb) {
    if (s.t === "block") {
      for (const x of s.body) exec(x, vals, sig, nb);
      return;
    }
    if (s.t === "if") {
      const c = ev(s.cond, sw(s.cond, sig), vals, sig);
      if (c === null) return poison(s, sig, nb || vals);
      if (c !== 0n) exec(s.then, vals, sig, nb);
      else if (s.els) exec(s.els, vals, sig, nb);
      return;
    }
    if (s.t === "case") {
      const cw = Math.max(
        sw(s.sel, sig),
        ...s.items.flatMap((i) => i.labels.map((l) => sw(l, sig))),
      );
      const v = ev(s.sel, cw, vals, sig);
      if (v === null) return poison(s, sig, nb || vals);
      for (const i of s.items)
        for (const l of i.labels) {
          const lv = ev(l, cw, vals, sig);
          if (lv === null) return poison(s, sig, nb || vals);
          if (lv === v) return exec(i.body, vals, sig, nb);
        }
      if (s.def) exec(s.def, vals, sig, nb);
      return;
    }
    const value = assignValue(s.lhs, s.rhs, vals, sig);
    if (s.nb) writeLhs(s.lhs, value, vals, sig, nb);
    else writeLhs(s.lhs, value, vals, sig);
  }
  function poison(s, sig, target) {
    const names = new Set();
    const walk = (x) => {
      if (x.t === "block") x.body.forEach(walk);
      else if (x.t === "if") {
        walk(x.then);
        if (x.els) walk(x.els);
      } else if (x.t === "case") {
        x.items.forEach((i) => walk(i.body));
        if (x.def) walk(x.def);
      } else {
        const coll = (l) =>
          l.t === "concat" ? l.parts.forEach(coll) : names.add(l.name);
        coll(x.lhs);
      }
    };
    walk(s);
    for (const n of names) target[n] = null;
  }

  /* ---------------- Simulation ---------------- */
  function simulator(design) {
    const sig = design.signals;
    const vals = {};
    for (const n of Object.keys(sig)) vals[n] = null;
    const seq = design.procs.filter((p) => p.t === "seq");
    const settle = () => {
      for (const p of design.order) {
        if (p.t === "assign")
          writeLhs(p.lhs, assignValue(p.lhs, p.rhs, vals, sig), vals, sig);
        else exec(p.body, vals, sig, null);
      }
    };
    const clockOf = (p) => ev(p.clock, 1, vals, sig);
    let prevClk = seq.map(clockOf);
    function set(name, value) {
      const s = sig[name];
      if (!s || s.dir !== "input") throw new Error(`${name} is not an input`);
      vals[name] = value === null ? null : BigInt(value) & mask(s.width);
    }
    function apply(inputs) {
      for (const [k, v] of Object.entries(inputs)) set(k, v);
      settle();
      for (let guard = 0; guard < 4; guard++) {
        const now = seq.map(clockOf);
        const fired = seq.filter((p, i) => prevClk[i] === 0n && now[i] === 1n);
        prevClk = now;
        if (!fired.length) return;
        const nb = {};
        for (const p of fired) exec(p.body, vals, sig, nb);
        Object.assign(vals, nb);
        settle();
      }
    }
    return {
      apply,
      get: (n) => vals[n],
      values: () => ({ ...vals }),
    };
  }

  const ports = (design, dir) =>
    design.ports
      .map((n) => design.signals[n])
      .filter((s) => s.dir === dir)
      .map((s) => ({ name: s.name, width: s.width }));

  // Every input combination, in binary counting order over the input ports
  // as declared (first port is the most significant).
  function exhaustive(design) {
    const ins = ports(design, "input");
    const bits = ins.reduce((s, p) => s + p.width, 0);
    if (bits > 12)
      throw new RtlError("Too many input bits for an exhaustive check.");
    const sim = simulator(design);
    const outs = ports(design, "output");
    const rows = [];
    for (let k = 0; k < 2 ** bits; k++) {
      let shift = bits;
      const inputs = {};
      for (const p of ins) {
        shift -= p.width;
        inputs[p.name] = (BigInt(k) >> BigInt(shift)) & mask(p.width);
      }
      sim.apply(inputs);
      const outputs = {};
      for (const o of outs) outputs[o.name] = sim.get(o.name);
      rows.push({ inputs, outputs });
    }
    return rows;
  }

  // Cycle-based run. Each cycle: apply inputs with clk = 0, then raise clk;
  // outputs are sampled after the rising edge.
  function runCycles(design, clock, stimulus) {
    if (stimulus.length > LIMITS.cycles)
      throw new RtlError(`Runs are limited to ${LIMITS.cycles} cycles.`);
    const sim = simulator(design);
    const outs = ports(design, "output");
    return stimulus.map((inputs) => {
      sim.apply({ ...inputs, [clock]: 0n });
      sim.apply({ [clock]: 1n });
      const outputs = {};
      for (const o of outs) outputs[o.name] = sim.get(o.name);
      return { inputs, outputs };
    });
  }

  function compile(src, top) {
    return elaborate(parse(src), top);
  }

  // Deterministic pseudo-random stimulus (a 32-bit LCG), so the same cycles
  // are used in the browser, in tests and in the Icarus cross-check.
  function lcg(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s >>> 16;
    };
  }

  /* ---------------- Testbench generation ---------------- */
  const vlit = (w, v) => `${w}'d${v}`;
  // Builds a self-checking Verilog-2005 testbench. Expected values that are
  // unknown (null) are not checked.
  function testbench({ top, inputs, outputs, clock, rows, vcd = true }) {
    const decl = (p, kind) =>
      `  ${kind}${p.width > 1 ? ` [${p.width - 1}:0]` : ""} ${p.name};`;
    const allIn = clock ? [{ name: clock, width: 1 }, ...inputs] : inputs;
    let tb = `// Self-checking testbench generated by SiliconPath.\n// Run: iverilog -g2005 -o sim design.v tb.v && vvp sim\n\`timescale 1ns/1ps\nmodule tb;\n`;
    tb += allIn.map((p) => decl(p, "reg")).join("\n") + "\n";
    tb += outputs.map((p) => decl(p, "wire")).join("\n") + "\n";
    tb += `  integer errors = 0;\n  integer checks = 0;\n`;
    tb += `  ${top} dut (${[...allIn, ...outputs].map((p) => `.${p.name}(${p.name})`).join(", ")});\n`;
    tb += `  initial begin\n`;
    if (vcd) tb += `    $dumpfile("wave.vcd");\n    $dumpvars(0, tb);\n`;
    if (clock) tb += `    ${clock} = 0;\n`;
    rows.forEach((r, i) => {
      tb += `    // ${clock ? "cycle" : "row"} ${i}\n`;
      tb += inputs
        .map((p) => `    ${p.name} = ${vlit(p.width, r.inputs[p.name])};\n`)
        .join("");
      if (clock) tb += `    #5 ${clock} = 1;\n    #1;\n`;
      else tb += `    #1;\n`;
      for (const o of outputs) {
        const v = r.outputs[o.name];
        if (v === null || v === undefined) continue;
        tb += `    checks = checks + 1;\n    if (${o.name} !== ${vlit(o.width, v)}) begin errors = errors + 1; $display("MISMATCH ${clock ? "cycle" : "row"} ${i}: ${o.name} = %0d, expected ${v}", ${o.name}); end\n`;
      }
      if (clock) tb += `    #4 ${clock} = 0;\n`;
    });
    tb += `    if (errors == 0) $display("PASS: %0d checks", checks);\n    else $display("FAIL: %0d of %0d checks", errors, checks);\n    $finish;\n  end\nendmodule\n`;
    return tb;
  }

  const api = {
    LIMITS,
    RtlError,
    lex,
    parse,
    elaborate,
    compile,
    simulator,
    exhaustive,
    runCycles,
    ports,
    lcg,
    testbench,
    selfWidth: widthOf,
  };
  root.RtlEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
