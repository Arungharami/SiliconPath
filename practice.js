/* SiliconPath Practice Track — Logic → CMOS.
 *
 * Auto-checked exercises that produce an evidence record. Every check is
 * exhaustive over the input space (at most 16 rows), so feedback is exact.
 * Transistor exercises use an ideal switch-level model: each MOSFET is an
 * on/off switch. It is not a circuit (SPICE) simulator and says nothing about
 * delay, power, sizing, noise margins or leakage.
 */
"use strict";
window.PracticeTrack = (() => {
  const STORAGE_KEY = "sp-practice";
  const MAX_INPUT = 200;

  /* ---------------- Boolean expression parser (no eval) ---------------- */
  // Precedence, tightest first: NOT (prefix ! ~ ¬ or postfix '), AND (* · & or
  // juxtaposition), XOR (^ ⊕), OR (+ |).
  function tokenize(src) {
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (/\s/.test(c)) continue;
      const pos = i + 1;
      if (/[A-Za-z]/.test(c)) out.push({ t: "var", v: c.toUpperCase(), pos });
      else if (c === "0" || c === "1")
        out.push({ t: "const", v: Number(c), pos });
      else if (c === "(" || c === ")") out.push({ t: c, pos });
      else if ("+|".includes(c)) out.push({ t: "or", pos });
      else if ("*·&.".includes(c)) out.push({ t: "and", pos });
      else if ("^⊕".includes(c)) out.push({ t: "xor", pos });
      else if ("!~¬".includes(c)) out.push({ t: "not", pos });
      else if ("'’′".includes(c)) out.push({ t: "post", pos });
      else
        throw new SyntaxError(
          `Unexpected character “${c}” at position ${pos}.`,
        );
    }
    return out;
  }

  function parse(src, vars = ["A", "B", "C", "D"]) {
    src = String(src ?? "");
    if (!src.trim()) throw new SyntaxError("Enter an expression.");
    if (src.length > MAX_INPUT)
      throw new SyntaxError(
        `Keep the expression under ${MAX_INPUT} characters.`,
      );
    const toks = tokenize(src);
    let i = 0;
    const peek = () => toks[i],
      take = () => toks[i++];
    const startsFactor = (k) =>
      k && (k.t === "var" || k.t === "const" || k.t === "(" || k.t === "not");
    const nary = (t, xs) => (xs.length === 1 ? xs[0] : { t, xs });

    function orExpr() {
      const xs = [xorExpr()];
      while (peek()?.t === "or") take(), xs.push(xorExpr());
      return nary("or", xs);
    }
    function xorExpr() {
      const xs = [andExpr()];
      while (peek()?.t === "xor") take(), xs.push(andExpr());
      return nary("xor", xs);
    }
    function andExpr() {
      const xs = [unary()];
      for (;;) {
        if (peek()?.t === "and") take(), xs.push(unary());
        else if (startsFactor(peek())) xs.push(unary());
        else break;
      }
      return nary("and", xs);
    }
    function unary() {
      if (peek()?.t === "not") return take(), { t: "not", a: unary() };
      let node = primary();
      while (peek()?.t === "post") take(), (node = { t: "not", a: node });
      return node;
    }
    function primary() {
      const k = take();
      if (!k) throw new SyntaxError("The expression ends too early.");
      if (k.t === "var") {
        if (!vars.includes(k.v))
          throw new SyntaxError(
            `Input ${k.v} is not part of this exercise. Use ${vars.join(", ")}.`,
          );
        return { t: "var", n: k.v };
      }
      if (k.t === "const") return { t: "const", v: k.v };
      if (k.t === "(") {
        const e = orExpr();
        if (take()?.t !== ")")
          throw new SyntaxError(
            `Missing “)” for the “(” at position ${k.pos}.`,
          );
        return e;
      }
      throw new SyntaxError(`Unexpected symbol at position ${k.pos}.`);
    }
    const ast = orExpr();
    if (i < toks.length)
      throw new SyntaxError(`Unexpected symbol at position ${toks[i].pos}.`);
    return ast;
  }

  function evaluate(n, env) {
    switch (n.t) {
      case "var":
        return env[n.n];
      case "const":
        return n.v;
      case "not":
        return 1 - evaluate(n.a, env);
      case "and":
        return n.xs.every((x) => evaluate(x, env)) ? 1 : 0;
      case "or":
        return n.xs.some((x) => evaluate(x, env)) ? 1 : 0;
      case "xor":
        return n.xs.reduce((s, x) => s ^ evaluate(x, env), 0);
    }
    throw new Error("Unknown node");
  }

  const literals = (n) =>
    n.t === "var"
      ? 1
      : n.t === "not"
        ? literals(n.a)
        : n.xs
          ? n.xs.reduce((s, x) => s + literals(x), 0)
          : 0;

  // Sum of products: an OR of terms, each term a literal or an AND of literals.
  const isLiteral = (n) => n.t === "var" || (n.t === "not" && n.a.t === "var");
  const isTerm = (n) =>
    isLiteral(n) || (n.t === "and" && n.xs.every(isLiteral));
  const isSop = (n) => isTerm(n) || (n.t === "or" && n.xs.every(isTerm));

  // All input combinations in binary order, first variable most significant.
  function rows(vars) {
    return Array.from({ length: 2 ** vars.length }, (_, k) =>
      Object.fromEntries(
        vars.map((v, j) => [v, (k >> (vars.length - 1 - j)) & 1]),
      ),
    );
  }
  const envText = (env) =>
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");

  /* ---------------- Switch-level CMOS model ---------------- */
  // A network is written with input names, * for series and + for parallel.
  function parseNetwork(src, vars) {
    const ast = parse(src, vars);
    (function ok(n) {
      if (n.t === "var") return;
      if (n.t === "and" || n.t === "or") return n.xs.forEach(ok);
      throw new SyntaxError(
        "A transistor network may only use input names, * (series) and + (parallel). Inversion comes from the gate structure, not from the network.",
      );
    })(ast);
    return ast;
  }
  // NMOS conducts when its gate input is 1; PMOS when it is 0.
  function conducts(n, env, type) {
    if (n.t === "var") return type === "n" ? env[n.n] === 1 : env[n.n] === 0;
    if (n.t === "and") return n.xs.every((x) => conducts(x, env, type));
    return n.xs.some((x) => conducts(x, env, type));
  }
  // Output: 1 (pulled up), 0 (pulled down), "X" contention, "Z" floating.
  function switchLevel(pun, pdn, env) {
    const up = conducts(pun, env, "p"),
      down = conducts(pdn, env, "n");
    return {
      up,
      down,
      out: up && !down ? 1 : down && !up ? 0 : up ? "X" : "Z",
    };
  }
  function describe(n) {
    if (n.t === "var") return n.n;
    const parts = n.xs.map((x) => (x.t === "var" ? x.n : `(${describe(x)})`));
    return parts.join(
      n.t === "and" ? " in series with " : " in parallel with ",
    );
  }

  /* ---------------- Network diagram (inline SVG) ---------------- */
  const LEAF_W = 58,
    LEAF_H = 50,
    BUS = 12,
    GAP = 14;
  function size(n) {
    if (n.t === "var") return { w: LEAF_W, h: LEAF_H };
    const s = n.xs.map(size);
    return n.t === "and"
      ? { w: Math.max(...s.map((x) => x.w)), h: s.reduce((a, x) => a + x.h, 0) }
      : {
          w: s.reduce((a, x) => a + x.w, 0) + GAP * (s.length - 1),
          h: Math.max(...s.map((x) => x.h)) + 2 * BUS,
        };
  }
  // Draws node n in a box (x, y, w, h); terminals at top/bottom centre.
  function drawNode(n, type, x, y, w, h) {
    const cx = x + w / 2;
    let s = "";
    if (n.t === "var") {
      const by = y + (h - 26) / 2;
      s += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${by}"/><line x1="${cx}" y1="${by + 26}" x2="${cx}" y2="${y + h}"/>`;
      s += `<rect x="${cx - 13}" y="${by}" width="26" height="26" rx="3" class="pt-${type}"/>`;
      s += `<line x1="${cx - 24}" y1="${by + 13}" x2="${cx - (type === "p" ? 19 : 13)}" y2="${by + 13}"/>`;
      if (type === "p")
        s += `<circle cx="${cx - 16}" cy="${by + 13}" r="3" class="pt-bubble"/>`;
      s += `<text x="${cx}" y="${by + 17.5}" text-anchor="middle">${n.n}</text>`;
      return s;
    }
    const sizes = n.xs.map(size);
    if (n.t === "and") {
      // Series: stack vertically; stretch the last child to fill height.
      let yy = y;
      n.xs.forEach((c, k) => {
        const ch = k === n.xs.length - 1 ? y + h - yy : sizes[k].h;
        s += drawNode(c, type, x, yy, w, ch);
        yy += ch;
      });
      return s;
    }
    // Parallel: side by side between a top and bottom bus.
    const total = sizes.reduce((a, z) => a + z.w, 0) + GAP * (sizes.length - 1);
    let xx = x + (w - total) / 2;
    const centres = [];
    n.xs.forEach((c, k) => {
      s += drawNode(c, type, xx, y + BUS, sizes[k].w, h - 2 * BUS);
      centres.push(xx + sizes[k].w / 2);
      xx += sizes[k].w + GAP;
    });
    const l = centres[0],
      r = centres.at(-1);
    s += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + BUS}"/><line x1="${l}" y1="${y + BUS}" x2="${r}" y2="${y + BUS}"/>`;
    s += `<line x1="${l}" y1="${y + h - BUS}" x2="${r}" y2="${y + h - BUS}"/><line x1="${cx}" y1="${y + h - BUS}" x2="${cx}" y2="${y + h}"/>`;
    return s;
  }
  let diagramCount = 0;
  function diagram(pun, pdn, label = "CMOS gate") {
    const tid = `pd-title-${++diagramCount}`;
    const a = size(pun),
      b = size(pdn);
    const w = Math.max(a.w, b.w, 120) + 90,
      cx = (w - 60) / 2;
    const top = 30,
      yNode = top + a.h + 14,
      h = yNode + 14 + b.h + 34;
    const title = `${label}: pull-up network ${describe(pun)}; pull-down network ${describe(pdn)}`;
    return `<svg class="practice-diagram" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${tid}"><title id="${tid}">${title}</title>
<text x="${cx}" y="14" text-anchor="middle" class="pt-rail">VDD</text><line x1="${cx - 30}" y1="20" x2="${cx + 30}" y2="20" class="pt-railline"/><line x1="${cx}" y1="20" x2="${cx}" y2="${top}"/>
${drawNode(pun, "p", cx - a.w / 2, top, a.w, a.h)}
<line x1="${cx}" y1="${top + a.h}" x2="${cx}" y2="${yNode + 14}"/><circle cx="${cx}" cy="${yNode}" r="3.5" class="pt-node"/><line x1="${cx}" y1="${yNode}" x2="${w - 24}" y2="${yNode}"/><text x="${w - 18}" y="${yNode + 4}" class="pt-rail">Y</text>
${drawNode(pdn, "n", cx - b.w / 2, yNode + 14, b.w, b.h)}
<line x1="${cx}" y1="${yNode + 14 + b.h}" x2="${cx}" y2="${h - 18}"/><line x1="${cx - 30}" y1="${h - 18}" x2="${cx + 30}" y2="${h - 18}" class="pt-railline"/><text x="${cx}" y="${h - 3}" text-anchor="middle" class="pt-rail">GND</text></svg>`;
  }

  /* ---------------- Track content ---------------- */
  const MODEL_LIMIT =
    "Switch-level model: each transistor is an ideal on/off switch. Threshold voltages, transistor sizing, delay, power, noise margins and leakage are not modeled. This is a reasoning exercise, not a circuit simulation or signoff tool.";

  const modules = [
    {
      id: "boolean",
      title: "Boolean functions and truth tables",
      level: "Beginner",
      prereq:
        "None. Trying the AND, OR and NOT gates in the Digital Circuit Lab first helps.",
      objectives: [
        "Evaluate a Boolean expression for every input combination.",
        "Translate a written specification into a Boolean expression.",
        "Use a truth table as an exhaustive test of a design.",
      ],
      explanation: [
        "A combinational circuit's output depends only on its present inputs. With n binary inputs there are 2ⁿ input combinations, so a truth table with 2ⁿ rows describes the function completely.",
        "A Boolean expression is a compact description of the same function. A·B (AND) is 1 only when both operands are 1; A + B (OR) is 1 when at least one is 1; A′ (NOT) inverts. By convention NOT binds tightest, then AND, then OR, so A·B′ + C means (A·(B′)) + C.",
        "Two expressions are equivalent when they agree on every row of the truth table. Because a small function has few rows, every row can be checked: that exhaustive comparison is exactly how the exercises in this track are graded.",
      ],
      example:
        "Y = A·B′ + C with A = 1, B = 0, C = 0: B′ = 1, so A·B′ = 1, and Y = 1 + 0 = 1. With A = 1, B = 1, C = 0: A·B′ = 0 and C = 0, so Y = 0.",
      application:
        "Specifications for control logic — alarms, interlocks, enable signals — are usually written in words. Turning them into a truth table first exposes cases the wording left ambiguous.",
      sources: ["mit-6004-logic", "harris-ddca"],
      exercises: [
        {
          id: "table-abc",
          type: "table",
          prompt:
            "Complete the truth table for Y = A·B′ + C. Select each output cell to switch it between 0 and 1.",
          vars: ["A", "B", "C"],
          ref: "AB'+C",
        },
        {
          id: "alarm",
          type: "expr",
          prompt:
            "A door alarm sounds (Y = 1) when the door is open (A = 1) and at least one of these is true: the system is armed (B = 1), or it is night-time (C = 1). Write an expression for Y.",
          vars: ["A", "B", "C"],
          ref: "A(B+C)",
        },
      ],
    },
    {
      id: "minimize",
      title: "Sum-of-products and simplification",
      level: "Beginner",
      prereq: "Boolean functions and truth tables.",
      objectives: [
        "Write a sum-of-products (SOP) expression from a truth table.",
        "Simplify an SOP expression by combining adjacent terms or using a Karnaugh map.",
        "Use literal count as a first-order measure of implementation cost.",
      ],
      explanation: [
        "Each row where Y = 1 is a minterm: an AND of every input, each either true or complemented. ORing all minterms gives the canonical sum-of-products, which is always correct but usually larger than necessary.",
        "Terms that differ in exactly one variable combine: A·B·C + A·B·C′ = A·B. A Karnaugh map arranges the rows so that such pairs sit next to each other, making the largest groups easy to see.",
        "Fewer literals generally means fewer transistors in a two-level implementation. Literal count is a rough cost model only; real cost also depends on the available gates, sizing and timing, which this track does not model.",
      ],
      example:
        "Y = A′·B′ + A′·B has 4 literals. The two terms differ only in B, so Y = A′·(B′ + B) = A′: 1 literal.",
      application:
        "Synthesis tools perform this kind of optimisation automatically on much larger designs; understanding it by hand makes their results easier to read and question.",
      sources: ["mit-6004-logic", "harris-ddca"],
      exercises: [
        {
          id: "majority-sop",
          type: "expr",
          prompt:
            "Y is the majority function: 1 when at least two of A, B, C are 1 (truth table shown). Write a sum-of-products expression with at most 6 literals.",
          vars: ["A", "B", "C"],
          ref: "AB+AC+BC",
          showTable: true,
          sop: true,
          maxLiterals: 6,
        },
        {
          id: "minterms-sop",
          type: "expr",
          prompt:
            "Y = 1 for minterms 0, 2, 4, 5 and 6 (truth table shown). Write a minimal sum-of-products expression with at most 3 literals.",
          vars: ["A", "B", "C"],
          ref: "C'+AB'",
          showTable: true,
          sop: true,
          maxLiterals: 3,
        },
      ],
    },
    {
      id: "switches",
      title: "MOSFETs as switches: the CMOS inverter",
      level: "Beginner",
      prereq:
        "Boolean functions and truth tables. Basic idea of voltage as logic 1 (supply) and 0 (ground).",
      objectives: [
        "Describe NMOS and PMOS transistors as voltage-controlled switches.",
        "Explain why a CMOS inverter's output always connects to exactly one supply rail.",
        "Predict transistor states and output for each input.",
      ],
      explanation: [
        "In the switch-level model an NMOS transistor conducts (is ON) when its gate is at logic 1 and is OFF when its gate is 0. A PMOS transistor is the opposite: ON when its gate is 0, OFF when it is 1.",
        "A CMOS inverter places a PMOS transistor between the supply (VDD, logic 1) and the output, and an NMOS transistor between the output and ground (GND, logic 0). Both gates are driven by A. For either steady input exactly one transistor is ON, so the output connects to VDD or to GND, never both.",
        "NMOS transistors pass a strong 0 and PMOS transistors pass a strong 1, which is why NMOS devices form the pull-down network and PMOS devices the pull-up network.",
        "Real MOSFETs have threshold voltages, finite on-resistance, capacitance and leakage, so switching takes time and consumes energy. Device courses such as MIT 6.012 cover that behavior; this track deliberately abstracts it away.",
      ],
      example:
        "A = 1: the NMOS is ON and the PMOS is OFF, so the output is pulled to GND and Y = 0.",
      application:
        "The same pull-up/pull-down structure underlies every static CMOS logic gate, from inverters to the complex gates in standard-cell libraries.",
      sources: ["mit-6004-cmos", "harris-ddca", "mit-devices"],
      diagram: { pun: "A", pdn: "A", label: "CMOS inverter" },
      exercises: [
        {
          id: "inverter-states",
          type: "inverter",
          prompt:
            "For each value of A, choose the state of each transistor and the resulting output.",
        },
      ],
    },
    {
      id: "cmos-gates",
      title: "Designing static CMOS NAND and NOR gates",
      level: "Intermediate",
      prereq: "MOSFETs as switches: the CMOS inverter.",
      objectives: [
        "Design a pull-down network (PDN) that conducts exactly when the output should be 0.",
        "Derive the pull-up network (PUN) as the dual of the PDN.",
        "Verify that no input causes contention or a floating output.",
      ],
      explanation: [
        "A static CMOS gate has a pull-up network of PMOS transistors between VDD and the output and a pull-down network of NMOS transistors between the output and GND. The PDN must conduct exactly when the output should be 0, and the PUN exactly when it should be 1.",
        "NMOS transistors in series conduct only if all are ON (an AND condition); in parallel, if any is ON (an OR condition). A PDN of A and B in series pulls Y low when A·B = 1, giving Y = (A·B)′: a NAND gate.",
        "The PUN is the dual of the PDN: series becomes parallel and parallel becomes series. Because PMOS devices turn ON for 0 inputs, the dual network conducts exactly when the PDN does not.",
        "There are two failure modes. If both networks conduct, VDD is shorted to GND (contention). If neither conducts, the output floats and has no defined value. A correct static CMOS gate avoids both for every input.",
        "A single static CMOS stage is always inverting. NAND and NOR are built directly; AND and OR need an extra inverter stage.",
      ],
      example:
        "NOR2, Y = (A + B)′: the output must be 0 when A or B is 1, so the PDN is A + B (parallel). The PUN is the dual, A * B (series), which conducts only when A = 0 and B = 0.",
      application:
        "Standard-cell libraries used in chip design are built from gates like these; the PUN/PDN duality is the first step in drawing any cell's transistor schematic.",
      sources: ["mit-6004-cmos", "harris-ddca"],
      exercises: [
        {
          id: "nand2",
          type: "cmos",
          prompt:
            "Design a two-input NAND gate, Y = (A·B)′, using at most 4 transistors.",
          vars: ["A", "B"],
          ref: "(AB)'",
          refNet: { pun: "A+B", pdn: "A*B" },
          maxTransistors: 4,
        },
        {
          id: "nor2",
          type: "cmos",
          prompt:
            "Design a two-input NOR gate, Y = (A + B)′, using at most 4 transistors.",
          vars: ["A", "B"],
          ref: "(A+B)'",
          refNet: { pun: "A*B", pdn: "A+B" },
          maxTransistors: 4,
        },
      ],
    },
    {
      id: "complex-gates",
      title: "Complex gates: AND-OR-INVERT and OR-AND-INVERT",
      level: "Intermediate",
      prereq: "Designing static CMOS NAND and NOR gates.",
      objectives: [
        "Implement an inverted sum-of-products in a single CMOS stage.",
        "Construct a PUN for a nested series/parallel PDN using duality.",
        "Compare transistor counts with a multi-gate implementation.",
      ],
      explanation: [
        "Any function of the form (sum of products)′ or (product of sums)′ can be built in one static CMOS stage. The AND-OR-INVERT gate AOI21 computes Y = (A·B + C)′.",
        "Build the PDN directly from the expression inside the inversion: AND becomes series, OR becomes parallel. For AOI21 that is (A * B) + C. Then take the dual for the PUN, applying the swap at every level of nesting.",
        "AOI21 needs six transistors. Built from separate gates — an AND gate (NAND plus inverter, 6 transistors) feeding a NOR2 (4 transistors) — the same function needs 10 transistors and three stages.",
        "Long series stacks slow a gate because the on-resistances add, so designers limit stack height and size transistors to compensate. This track counts transistors but does not model delay or sizing.",
      ],
      example:
        "OAI21, Y = ((A + B)·C)′: the PDN is (A + B) * C and the PUN is its dual, (A * B) + C — six transistors.",
      application:
        "Complex gates let synthesis tools implement common logic patterns with fewer transistors and stages than chains of basic gates.",
      sources: ["mit-6004-cmos", "harris-ddca"],
      exercises: [
        {
          id: "aoi21",
          type: "cmos",
          prompt:
            "Design an AOI21 gate, Y = (A·B + C)′, using at most 6 transistors.",
          vars: ["A", "B", "C"],
          ref: "(AB+C)'",
          refNet: { pun: "(A+B)*C", pdn: "A*B+C" },
          maxTransistors: 6,
        },
        {
          id: "oai22",
          type: "cmos",
          prompt:
            "Design an OAI22 gate, Y = ((A + B)·(C + D))′, using at most 8 transistors.",
          vars: ["A", "B", "C", "D"],
          ref: "((A+B)(C+D))'",
          refNet: { pun: "A*B+C*D", pdn: "(A+B)*(C+D)" },
          maxTransistors: 8,
        },
      ],
    },
  ];
  const exercises = modules.flatMap((m) =>
    m.exercises.map((e) => ({ ...e, module: m.id })),
  );
  const exerciseById = (id) => exercises.find((e) => e.id === id);

  /* ---------------- Checkers ---------------- */
  // Each returns { pass, criteria: [{label, ok}], feedback, detail? }.
  const result = (criteria, feedback, detail) => ({
    pass: criteria.every((c) => c.ok),
    criteria,
    feedback,
    detail,
  });

  function checkTable(ex, answer) {
    const ref = parse(ex.ref, ex.vars),
      rs = rows(ex.vars),
      bits = String(answer || "");
    const wrong = rs.filter((env, k) => Number(bits[k]) !== evaluate(ref, env));
    return result(
      [
        {
          label: `All ${rs.length} rows correct`,
          ok: bits.length === rs.length && !wrong.length,
        },
      ],
      wrong.length
        ? `${wrong.length} row${wrong.length === 1 ? "" : "s"} incorrect, for example ${envText(wrong[0])}.`
        : "Every row matches.",
    );
  }

  function checkExpr(ex, answer) {
    let ast;
    try {
      ast = parse(answer, ex.vars);
    } catch (e) {
      return result([{ label: "Expression parses", ok: false }], e.message);
    }
    const ref = parse(ex.ref, ex.vars);
    const wrong = rows(ex.vars).find(
      (env) => evaluate(ast, env) !== evaluate(ref, env),
    );
    const criteria = [
      { label: "Expression parses", ok: true },
      {
        label: `Matches the specification on all ${2 ** ex.vars.length} rows`,
        ok: !wrong,
      },
    ];
    if (ex.sop)
      criteria.push({
        label: "Written in sum-of-products form",
        ok: isSop(ast),
      });
    const lits = literals(ast);
    if (ex.maxLiterals)
      criteria.push({
        label: `At most ${ex.maxLiterals} literals (yours: ${lits})`,
        ok: lits <= ex.maxLiterals,
      });
    let feedback;
    if (wrong)
      feedback = `For ${envText(wrong)} your expression gives ${evaluate(ast, wrong)}, but Y should be ${evaluate(ref, wrong)}.`;
    else if (ex.sop && !isSop(ast))
      feedback =
        "Equivalent, but not in sum-of-products form: expand it into an OR of AND terms with no parentheses.";
    else if (ex.maxLiterals && lits > ex.maxLiterals)
      feedback = `Equivalent, but uses ${lits} literals. Look for terms that combine.`;
    else feedback = "Correct on every row.";
    return result(criteria, feedback);
  }

  const INVERTER_KEY = [
    { p: "on", n: "off", y: "1" },
    { p: "off", n: "on", y: "0" },
  ];
  function checkInverter(ex, answer) {
    const given = String(answer || "")
      .split("|")
      .map((r) => {
        const [p, n, y] = r.split(",");
        return { p, n, y };
      });
    const criteria = [0, 1].map((a) => ({
      label: `A = ${a}: PMOS, NMOS and Y correct`,
      ok: ["p", "n", "y"].every((k) => given[a]?.[k] === INVERTER_KEY[a][k]),
    }));
    const firstBad = criteria.findIndex((c) => !c.ok);
    return result(
      criteria,
      firstBad < 0
        ? "Correct: exactly one transistor conducts for each input."
        : `Check the row for A = ${firstBad}. Remember: NMOS is ON for a 1 on its gate, PMOS for a 0.`,
    );
  }

  function checkCmos(ex, answer) {
    const a = answer && typeof answer === "object" ? answer : {};
    let pun, pdn;
    try {
      pun = parseNetwork(a.pun, ex.vars);
    } catch (e) {
      return result(
        [{ label: "Pull-up network parses", ok: false }],
        "Pull-up network: " + e.message,
      );
    }
    try {
      pdn = parseNetwork(a.pdn, ex.vars);
    } catch (e) {
      return result(
        [{ label: "Pull-down network parses", ok: false }],
        "Pull-down network: " + e.message,
      );
    }
    const ref = parse(ex.ref, ex.vars);
    const detail = rows(ex.vars).map((env) => ({
      env,
      ...switchLevel(pun, pdn, env),
      want: evaluate(ref, env),
    }));
    const contention = detail.filter((d) => d.out === "X"),
      floating = detail.filter((d) => d.out === "Z"),
      wrong = detail.filter((d) => d.out !== d.want);
    const count = literals(pun) + literals(pdn);
    const criteria = [
      { label: "Both networks parse", ok: true },
      {
        label: "No contention (VDD shorted to GND) for any input",
        ok: !contention.length,
      },
      { label: "No floating output for any input", ok: !floating.length },
      {
        label: `Output matches Y on all ${detail.length} rows`,
        ok: !wrong.length,
      },
      {
        label: `At most ${ex.maxTransistors} transistors (yours: ${count})`,
        ok: count <= ex.maxTransistors,
      },
    ];
    let feedback;
    if (contention.length)
      feedback = `Contention for ${envText(contention[0].env)}: both networks conduct. The PUN should be the dual of the PDN.`;
    else if (floating.length)
      feedback = `Floating output for ${envText(floating[0].env)}: neither network conducts. The PUN should be the dual of the PDN.`;
    else if (wrong.length)
      feedback = `For ${envText(wrong[0].env)} the gate outputs ${wrong[0].out} but Y should be ${wrong[0].want}. The PDN must conduct exactly when Y = 0.`;
    else if (count > ex.maxTransistors)
      feedback = `Functionally correct, but uses ${count} transistors. Each input needs only one NMOS and one PMOS here.`;
    else feedback = "Correct: a valid static CMOS gate for every input.";
    return result(criteria, feedback, { rows: detail, pun, pdn });
  }

  const checkers = {
    table: checkTable,
    expr: checkExpr,
    inverter: checkInverter,
    cmos: checkCmos,
  };
  function check(id, answer) {
    const ex = exerciseById(id);
    if (!ex) throw new Error("Unknown exercise: " + id);
    return checkers[ex.type](ex, answer);
  }

  /* ---------------- Evidence records ---------------- */
  // A record keeps the learner's latest answer; pass status is always
  // recomputed from that answer by the checker, never trusted from storage.
  const isIso = (s) =>
    typeof s === "string" && s.length <= 40 && !Number.isNaN(Date.parse(s));
  function cleanAnswer(ex, a) {
    if (ex.type === "cmos") {
      if (!a || typeof a !== "object") return { pun: "", pdn: "" };
      return {
        pun: String(a.pun ?? "").slice(0, MAX_INPUT),
        pdn: String(a.pdn ?? "").slice(0, MAX_INPUT),
      };
    }
    return String(a ?? "").slice(0, MAX_INPUT);
  }
  function sanitize(raw) {
    const out = { v: 1, records: {} };
    const recs =
      raw &&
      typeof raw === "object" &&
      raw.records &&
      typeof raw.records === "object"
        ? raw.records
        : {};
    for (const ex of exercises) {
      const r = recs[ex.id];
      if (!r || typeof r !== "object") continue;
      const attempts = Number.isInteger(r.attempts)
        ? Math.min(1e6, Math.max(0, r.attempts))
        : 0;
      if (!attempts) continue;
      const rec = {
        attempts,
        answer: cleanAnswer(ex, r.answer),
        firstAt: isIso(r.firstAt) ? r.firstAt : null,
      };
      const passAnswer = cleanAnswer(ex, r.passAnswer);
      if (isIso(r.passedAt) && check(ex.id, passAnswer).pass)
        Object.assign(rec, { passedAt: r.passedAt, passAnswer });
      if (isIso(r.lastAt)) rec.lastAt = r.lastAt;
      out.records[ex.id] = rec;
    }
    return out;
  }
  let state = { v: 1, records: {} };
  function load() {
    try {
      state = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      state = { v: 1, records: {} };
    }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
  function submit(id, answer, now = new Date().toISOString()) {
    const ex = exerciseById(id);
    if (!ex) throw new Error("Unknown exercise: " + id);
    const res = check(id, answer);
    const prev = state.records[id] || { attempts: 0, firstAt: now };
    const rec = {
      ...prev,
      attempts: prev.attempts + 1,
      answer: cleanAnswer(ex, answer),
      lastAt: now,
    };
    // The first passing answer is kept as evidence; later attempts (passing or
    // not) never remove it.
    if (res.pass && !prev.passedAt)
      Object.assign(rec, { passedAt: now, passAnswer: rec.answer });
    state.records[id] = rec;
    const saved = persist();
    return { ...res, record: rec, saved };
  }
  const passed = (id) => Boolean(state.records[id]?.passedAt);
  function moduleProgress(m) {
    const done = m.exercises.filter((e) => passed(e.id)).length;
    return { done, total: m.exercises.length };
  }
  function summary() {
    const done = exercises.filter((e) => passed(e.id)).length;
    return {
      done,
      total: exercises.length,
      attempted: Object.keys(state.records).length,
    };
  }
  const exportState = () => JSON.parse(JSON.stringify(state));
  function importState(raw) {
    state = sanitize(raw);
    persist();
  }
  function reset() {
    state = { v: 1, records: {} };
    persist();
  }

  function answerText(ex, a) {
    if (ex.type === "cmos")
      return `PUN = ${a.pun || "—"}; PDN = ${a.pdn || "—"}`;
    if (ex.type === "table")
      return `outputs (rows 0…${2 ** ex.vars.length - 1}) = ${a || "—"}`;
    if (ex.type === "inverter")
      return String(a || "")
        .split("|")
        .map((r, i) => `A=${i}: ${r || "—"}`)
        .join("; ");
    return a || "—";
  }
  function portfolio(resolveSource = () => null) {
    const s = summary();
    let md = `# SiliconPath practice evidence — Logic → CMOS\n\nGenerated ${new Date().toISOString().slice(0, 10)} from this browser's records.\n\n`;
    md += `${s.done} of ${s.total} exercises passed. Each result below was recomputed from the recorded answer by the same exhaustive checker the site uses; anyone can re-enter the answer to reproduce it.\n\n`;
    md += `> ${MODEL_LIMIT}\n>\n> Independent educational project. These records are self-generated practice evidence, not an assessment, grade or credential from any institution.\n\n`;
    for (const m of modules) {
      const p = moduleProgress(m);
      md += `## ${m.title} — ${p.done}/${p.total} passed\n\nObjectives:\n${m.objectives.map((o) => `- ${o}`).join("\n")}\n\n`;
      for (const ex of m.exercises) {
        const r = state.records[ex.id];
        md += `### ${ex.prompt}\n\n`;
        if (!r) {
          md += "Not attempted.\n\n";
          continue;
        }
        const shown = r.passedAt ? r.passAnswer : r.answer;
        const res = check(ex.id, shown);
        md += `- Status: ${r.passedAt ? `passed ${r.passedAt.slice(0, 10)}` : "not yet passed"}\n- Attempts: ${r.attempts}\n- ${r.passedAt ? "Passing answer" : "Latest answer"}: \`${answerText(ex, shown).replace(/`/g, "'")}\`\n${res.criteria.map((c) => `- [${c.ok ? "x" : " "}] ${c.label}`).join("\n")}\n\n`;
      }
      const refs = m.sources.map(resolveSource).filter(Boolean);
      if (refs.length)
        md += `References:\n${refs.map((r) => `- ${r.title} — ${r.provider}. ${r.url}`).join("\n")}\n\n`;
    }
    return md;
  }

  /* ---------------- Rendering ---------------- */
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const sourceLookup = () =>
    window.SiliconResource ? window.SiliconResource : () => null;

  function statusBadge(id) {
    const r = state.records[id];
    if (r?.passedAt)
      return `<span class="practice-badge pass">Passed · ${r.attempts} attempt${r.attempts === 1 ? "" : "s"}</span>`;
    if (r)
      return `<span class="practice-badge">In progress · ${r.attempts} attempt${r.attempts === 1 ? "" : "s"}</span>`;
    return `<span class="practice-badge todo">Not attempted</span>`;
  }

  function truthTable(vars, ast, caption) {
    return `<table class="practice-table"><caption>${caption}</caption><thead><tr>${vars.map((v) => `<th scope="col">${v}</th>`).join("")}<th scope="col">Y</th></tr></thead><tbody>${rows(
      vars,
    )
      .map(
        (env) =>
          `<tr>${vars.map((v) => `<td>${env[v]}</td>`).join("")}<td><strong>${evaluate(ast, env)}</strong></td></tr>`,
      )
      .join("")}</tbody></table>`;
  }

  function exerciseBody(ex) {
    const r = state.records[ex.id];
    const prev = r?.answer;
    if (ex.type === "table") {
      const bits =
        typeof prev === "string" && prev.length === 2 ** ex.vars.length
          ? prev
          : "0".repeat(2 ** ex.vars.length);
      return `<table class="practice-table"><caption>Your truth table</caption><thead><tr>${ex.vars.map((v) => `<th scope="col">${v}</th>`).join("")}<th scope="col">Y (select to change)</th></tr></thead><tbody>${rows(
        ex.vars,
      )
        .map(
          (env, k) =>
            `<tr>${ex.vars.map((v) => `<td>${env[v]}</td>`).join("")}<td><button type="button" class="practice-bit" data-bit="${k}" aria-pressed="${bits[k] === "1"}" aria-label="Y for ${envText(env)}">${bits[k]}</button></td></tr>`,
        )
        .join("")}</tbody></table>`;
    }
    if (ex.type === "expr") {
      const table = ex.showTable
        ? truthTable(ex.vars, parse(ex.ref, ex.vars), "Specification")
        : "";
      return `${table}<label class="practice-label" for="ans-${ex.id}">Y =</label><input id="ans-${ex.id}" class="practice-input" data-answer autocomplete="off" spellcheck="false" maxlength="${MAX_INPUT}" value="${esc(prev || "")}" aria-describedby="syntax-${ex.id}"><p class="subtle" id="syntax-${ex.id}">Inputs ${ex.vars.join(", ")}. AND: <code>*</code>, <code>·</code> or adjacency (<code>AB</code>). OR: <code>+</code>. NOT: <code>'</code> after or <code>!</code> before. XOR: <code>^</code>. Parentheses allowed.</p>`;
    }
    if (ex.type === "inverter") {
      const given = String(prev || "").split("|");
      const sel = (name, a, opts, cur) =>
        `<select data-inv="${name}" data-row="${a}" aria-label="${name === "y" ? "Output Y" : name === "p" ? "PMOS" : "NMOS"} when A = ${a}"><option value="">Choose…</option>${opts.map((o) => `<option value="${o}"${o === cur ? " selected" : ""}>${o === "on" ? "ON" : o === "off" ? "OFF" : o}</option>`).join("")}</select>`;
      return `<table class="practice-table"><caption>Inverter states</caption><thead><tr><th scope="col">A</th><th scope="col">PMOS</th><th scope="col">NMOS</th><th scope="col">Y</th></tr></thead><tbody>${[
        0, 1,
      ]
        .map((a) => {
          const [p, n, y] = (given[a] || "").split(",");
          return `<tr><td>${a}</td><td>${sel("p", a, ["on", "off"], p)}</td><td>${sel("n", a, ["on", "off"], n)}</td><td>${sel("y", a, ["0", "1"], y)}</td></tr>`;
        })
        .join("")}</tbody></table>`;
    }
    const a = prev && typeof prev === "object" ? prev : { pun: "", pdn: "" };
    return `<div class="practice-net"><div><label class="practice-label" for="pun-${ex.id}">Pull-up network (PMOS, VDD → Y)</label><input id="pun-${ex.id}" class="practice-input" data-pun autocomplete="off" spellcheck="false" maxlength="${MAX_INPUT}" value="${esc(a.pun)}" aria-describedby="netsyntax-${ex.id}"></div><div><label class="practice-label" for="pdn-${ex.id}">Pull-down network (NMOS, Y → GND)</label><input id="pdn-${ex.id}" class="practice-input" data-pdn autocomplete="off" spellcheck="false" maxlength="${MAX_INPUT}" value="${esc(a.pdn)}" aria-describedby="netsyntax-${ex.id}"></div></div><p class="subtle" id="netsyntax-${ex.id}">Inputs ${ex.vars.join(", ")}. Each input name is one transistor. <code>*</code> = series, <code>+</code> = parallel, parentheses group. Example: <code>A*(B+C)</code>.</p>`;
  }

  function resultHtml(ex, res) {
    let html = `<p class="practice-feedback ${res.pass ? "ok" : "bad"}"><strong>${res.pass ? "Passed." : "Not yet."}</strong> ${esc(res.feedback)}</p><ul class="practice-criteria">${res.criteria
      .map(
        (c) =>
          `<li class="${c.ok ? "ok" : "bad"}"><span aria-hidden="true">${c.ok ? "✓" : "✗"}</span> <span class="visually-hidden">${c.ok ? "Met:" : "Not met:"}</span> ${esc(c.label)}</li>`,
      )
      .join("")}</ul>`;
    if (ex.type === "cmos" && res.detail) {
      const { rows: rs, pun, pdn } = res.detail;
      const label = (o) =>
        o === "X" ? "contention" : o === "Z" ? "floating" : o;
      html += `<div class="practice-sim">${diagram(pun, pdn, "Your gate")}<table class="practice-table"><caption>Switch-level simulation of your gate</caption><thead><tr>${ex.vars.map((v) => `<th scope="col">${v}</th>`).join("")}<th scope="col">PUN</th><th scope="col">PDN</th><th scope="col">Output</th><th scope="col">Expected</th></tr></thead><tbody>${rs
        .map(
          (d) =>
            `<tr class="${d.out === d.want ? "" : "practice-row-bad"}">${ex.vars.map((v) => `<td>${d.env[v]}</td>`).join("")}<td>${d.up ? "on" : "off"}</td><td>${d.down ? "on" : "off"}</td><td><strong>${label(d.out)}</strong></td><td>${d.want}</td></tr>`,
        )
        .join("")}</tbody></table></div>`;
    }
    return html;
  }

  function exerciseHtml(ex, n) {
    return `<article class="panel practice-ex" data-exercise="${ex.id}"><div class="practice-ex-head"><span class="number">EXERCISE ${n}</span><span data-badge>${statusBadge(ex.id)}</span></div><p class="practice-prompt">${esc(ex.prompt)}</p><div data-body>${exerciseBody(ex)}</div><div class="actions"><button type="button" class="btn small" data-check="${ex.id}">Check answer</button></div><div class="practice-result" data-result role="status" aria-live="polite"></div></article>`;
  }

  function overview() {
    const s = summary();
    const lookup = sourceLookup();
    return `<div class="wrap practice-wrap"><nav class="practice-tracks" aria-label="Practice tracks"><a href="#practice" aria-current="page">Logic → CMOS</a><a href="#rtl">RTL → Synthesis</a></nav><div class="page-head"><div class="eyebrow">Practice track · Auto-checked exercises</div><h1>Logic → CMOS</h1><p class="lead">Go from truth tables to transistor-level gate design. Every answer is checked against every possible input, and your results build an evidence record you can export.</p></div>
<div class="practice-summary panel"><div><span class="eyebrow">Your evidence</span><div class="big-count">${s.done}/${s.total}</div><div class="progress"><span style="width:${(s.done / s.total) * 100}%"></span></div><p class="subtle">Exercises passed on this browser. Pass status is recomputed from your saved answers, not self-reported.</p></div><div class="actions"><button class="btn" data-practice-export>Export evidence portfolio ↓</button><button class="btn secondary small" data-practice-reset>Clear practice records</button></div></div>
<ol class="practice-modules">${modules
      .map((m, i) => {
        const p = moduleProgress(m);
        return `<li><a class="card" href="#practice/${m.id}"><span class="number">MODULE ${String(i + 1).padStart(2, "0")} · ${m.level.toUpperCase()}</span><h3>${esc(m.title)}</h3><p>${esc(m.objectives[0])}</p><div class="progress"><span style="width:${(p.done / p.total) * 100}%"></span></div><div class="bottom"><span>${p.done}/${p.total} exercises passed</span><span>↗</span></div></a></li>`;
      })
      .join("")}</ol>
<div class="callout"><b>What this track is — and is not.</b> ${esc(MODEL_LIMIT)} Content is original and aligned to the cited university and textbook sources; faculty review is pending. Records stay in this browser and are included in your study-desk backup.</div>
<p class="subtle">Main references: ${[
      "mit-6004-cmos",
      "mit-6004-logic",
      "harris-ddca",
    ]
      .map((id) => lookup(id))
      .filter(Boolean)
      .map(
        (r) =>
          `<a class="text-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a>`,
      )
      .join(" · ")}</p></div>`;
  }

  function modulePage(id) {
    const i = modules.findIndex((m) => m.id === id);
    if (i < 0) return overview();
    const m = modules[i],
      p = moduleProgress(m),
      lookup = sourceLookup();
    const prev = modules[i - 1],
      next = modules[i + 1];
    const refs = m.sources.map(lookup).filter(Boolean);
    const fig = m.diagram
      ? `<figure class="practice-figure">${diagram(parseNetwork(m.diagram.pun, ["A"]), parseNetwork(m.diagram.pdn, ["A"]), m.diagram.label)}<figcaption>${esc(m.diagram.label)}: PMOS (with bubble) from VDD to Y, NMOS from Y to GND, both gates driven by A. Schematic, not to scale.</figcaption></figure>`
      : "";
    return `<div class="wrap practice-wrap"><a class="text-link" href="#practice">← Logic → CMOS overview</a><div class="page-head"><div class="eyebrow">Module ${i + 1} of ${modules.length} · ${esc(m.level)}</div><h1>${esc(m.title)}</h1></div>
<div class="split"><aside class="sidebar"><h3>Module brief</h3><p class="subtle"><b>Prerequisites</b><br>${esc(m.prereq)}</p><p class="subtle"><b>You will be able to</b></p><ul class="practice-objectives">${m.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul><div class="progress"><span data-module-bar style="width:${(p.done / p.total) * 100}%"></span></div><p class="subtle" data-module-count>${p.done} of ${p.total} exercises passed</p><a class="text-link" href="#practice">Export evidence ↗</a></aside>
<section><article class="panel"><h2>Concept</h2>${m.explanation.map((t) => `<p>${esc(t)}</p>`).join("")}${fig}<h3>Worked example</h3><p>${esc(m.example)}</p><h3>Where this is used</h3><p>${esc(m.application)}</p></article>
${m.exercises.map((ex, k) => exerciseHtml(ex, k + 1)).join("")}
${m.exercises.some((e) => e.type === "cmos" || e.type === "inverter") ? `<div class="callout">${esc(MODEL_LIMIT)}</div>` : ""}
<article class="panel"><h2>References</h2>${refs.length ? `<ul>${refs.map((r) => `<li><a class="text-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a> — ${esc(r.provider)}${r.year ? `, ${esc(r.year)}` : ""}. <span class="subtle">${esc(r.review)}</span></li>`).join("")}</ul>` : "<p>References load with the catalog.</p>"}<p class="subtle">Explanations are original summaries of standard material; consult the references for full treatment.</p></article>
<nav class="practice-pager" aria-label="Module navigation">${prev ? `<a class="btn secondary" href="#practice/${prev.id}">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="btn" href="#practice/${next.id}">${esc(next.title)} →</a>` : `<a class="btn" href="#practice">Finish: export evidence →</a>`}</nav></section></div></div>`;
  }

  function page(sub) {
    load();
    return sub ? modulePage(sub) : overview();
  }

  function collect(card, ex) {
    if (ex.type === "table")
      return [...card.querySelectorAll("[data-bit]")]
        .map((b) => b.textContent.trim())
        .join("");
    if (ex.type === "expr") return card.querySelector("[data-answer]").value;
    if (ex.type === "inverter")
      return [0, 1]
        .map((a) =>
          ["p", "n", "y"]
            .map(
              (k) =>
                card.querySelector(`[data-inv="${k}"][data-row="${a}"]`).value,
            )
            .join(","),
        )
        .join("|");
    return {
      pun: card.querySelector("[data-pun]").value,
      pdn: card.querySelector("[data-pdn]").value,
    };
  }

  function bind() {
    const root = document.querySelector(".practice-wrap");
    if (!root) return;
    root.addEventListener("click", (e) => {
      const bit = e.target.closest("[data-bit]");
      if (bit) {
        const v = bit.textContent.trim() === "1" ? "0" : "1";
        bit.textContent = v;
        bit.setAttribute("aria-pressed", String(v === "1"));
        return;
      }
      const btn = e.target.closest("[data-check]");
      if (btn) {
        const ex = exerciseById(btn.dataset.check),
          card = btn.closest("[data-exercise]");
        const res = submit(ex.id, collect(card, ex));
        card.querySelector("[data-result]").innerHTML =
          resultHtml(ex, res) +
          (res.saved
            ? ""
            : '<p class="subtle">Browser storage is unavailable, so this result was not saved.</p>');
        card.querySelector("[data-badge]").innerHTML = statusBadge(ex.id);
        const m = modules.find((x) => x.id === ex.module),
          p = moduleProgress(m);
        const bar = root.querySelector("[data-module-bar]"),
          count = root.querySelector("[data-module-count]");
        if (bar) bar.style.width = `${(p.done / p.total) * 100}%`;
        if (count)
          count.textContent = `${p.done} of ${p.total} exercises passed`;
        return;
      }
      if (e.target.closest("[data-practice-export]")) {
        window.dispatchEvent(
          new CustomEvent("siliconpath-export", {
            detail: {
              name: "SiliconPath_Logic_to_CMOS_Evidence.md",
              text: portfolio(sourceLookup()),
            },
          }),
        );
        return;
      }
      if (
        e.target.closest("[data-practice-reset]") &&
        confirm("Delete all Logic → CMOS practice records on this browser?")
      ) {
        reset();
        root.outerHTML = overview();
        bind();
      }
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches(".practice-input")) {
        e.preventDefault();
        e.target
          .closest("[data-exercise]")
          .querySelector("[data-check]")
          .click();
      }
    });
  }

  load();
  return {
    parse,
    evaluate,
    literals,
    isSop,
    rows,
    parseNetwork,
    switchLevel,
    diagram,
    modules,
    exercises,
    check,
    submit,
    summary,
    moduleProgress,
    sanitize,
    exportState,
    importState,
    reset,
    load,
    portfolio,
    page,
    bind,
    MODEL_LIMIT,
  };
})();
