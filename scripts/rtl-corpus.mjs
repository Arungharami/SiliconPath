// Designs that exercise the RTL subset's semantics: width extension and
// truncation, operators, case/if, part selects, hierarchy and registers.
// scripts/rtl-crosscheck.mjs runs each one in the SiliconPath engine and in
// Icarus Verilog and requires identical outputs. `latch` states whether Yosys
// infers a latch (checked against Yosys when it is installed).
export const corpus = [
  {
    name: "width-context-not",
    src: `module t(input wire a, input wire [1:0] b, output wire [1:0] y, output wire [3:0] z);
  assign y = ~a;            // a is extended to 2 bits before inversion
  assign z = ~a + b;        // context width 4
endmodule`,
  },
  {
    name: "width-shift-truncation",
    src: `module t(input wire [3:0] a, input wire [3:0] b, output wire [3:0] y, output wire [4:0] z);
  assign y = (a + b) >> 1;  // sum truncated to 4 bits before the shift
  assign z = (a + b) >> 1;  // context width 5 keeps the carry
endmodule`,
  },
  {
    name: "concat-and-carry",
    src: `module t(input wire [2:0] a, input wire [2:0] b, input wire c, output wire [2:0] s, output wire co, output wire [5:0] cat);
  assign {co, s} = a + b + c;
  assign cat = {a, b} - 1;
endmodule`,
  },
  {
    name: "compare-and-logical",
    src: `module t(input wire [2:0] a, input wire [1:0] b, output wire lt, output wire eq, output wire ge, output wire l, output wire n);
  assign lt = a < b;
  assign eq = a == {1'b0, b};
  assign ge = a >= 3'd4;
  assign l = (a != 0) && !b[1];
  assign n = !a || b == 2'b11;
endmodule`,
  },
  {
    name: "reduction-and-replication",
    src: `module t(input wire [3:0] a, input wire b, output wire r_and, output wire r_or, output wire r_xor, output wire r_nand, output wire r_xnor, output wire [7:0] rep);
  assign r_and = &a;
  assign r_or = |a;
  assign r_xor = ^a;
  assign r_nand = ~&a;
  assign r_xnor = ~^a;
  assign rep = {2{a[1:0], b, ~b}};
endmodule`,
  },
  {
    name: "ternary-subtract-xnor",
    src: `module t(input wire [3:0] a, input wire [3:0] b, input wire s, output wire [3:0] y, output wire [3:0] d, output wire [3:0] x);
  assign y = s ? a : b;
  assign d = a - b;          // wraps modulo 16
  assign x = a ~^ b;
endmodule`,
  },
  {
    name: "variable-index-and-shift",
    src: `module t(input wire [3:0] a, input wire [1:0] i, output wire y, output wire [3:0] sh, output wire [3:0] sr);
  assign y = a[i];
  assign sh = a << i;
  assign sr = a >> (i + 1);
endmodule`,
  },
  {
    name: "comb-always-case-default",
    src: `module t(input wire [1:0] s, input wire [3:0] a, output reg [3:0] y);
  always @(*) begin
    case (s)
      2'd0: y = a;
      2'd1: y = ~a;
      2'd2, 2'd3: y = a ^ 4'b1010;
    endcase
  end
endmodule`,
  },
  {
    name: "comb-always-defaults-and-partial",
    src: `module t(input wire [2:0] a, input wire en, output reg [2:0] y, output reg v);
  always @(*) begin
    y = 3'b000;
    v = 1'b0;
    if (en) begin
      y[0] = a[2];
      y[2:1] = a[1:0];
      v = 1;
    end
  end
endmodule`,
  },
  {
    name: "blocking-temporaries",
    src: `module t(input wire [3:0] a, input wire [3:0] b, output reg [3:0] y);
  reg [3:0] t1;
  always @(*) begin
    t1 = a & b;
    y = t1 | (a >> 2);
  end
endmodule`,
  },
  {
    name: "hierarchy-full-adder",
    src: `module half_adder(input wire a, input wire b, output wire sum, output wire carry);
  assign sum = a ^ b;
  assign carry = a & b;
endmodule
module t(input wire a, input wire b, input wire cin, output wire sum, output wire cout);
  wire s1, c1, c2;
  half_adder h1 (.a(a), .b(b), .sum(s1), .carry(c1));
  half_adder h2 (.a(s1), .b(cin), .sum(sum), .carry(c2));
  assign cout = c1 | c2;
endmodule`,
  },
  {
    name: "hierarchy-width-adapt",
    src: `module inc(input wire [3:0] x, output wire [3:0] y);
  assign y = x + 1;
endmodule
module t(input wire [1:0] a, output wire [3:0] y, output wire [1:0] z);
  inc u1 (.x(a), .y(y));
  inc u2 (.x({2'b00, a}), .y());
  assign z = y[3:2];
endmodule`,
  },
  {
    name: "net-declaration-assign",
    src: `module t(input wire [3:0] a, output wire [3:0] y);
  wire [3:0] m = a ^ 4'hF;
  assign y = m + 4'd3;
endmodule`,
  },
  {
    name: "seq-counter-enable-reset",
    clock: "clk",
    src: `module t(input wire clk, input wire rst, input wire en, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 4'd0;
    else if (en) q <= q + 1;
  end
endmodule`,
  },
  {
    name: "seq-nonblocking-swap",
    clock: "clk",
    src: `module t(input wire clk, input wire load, input wire [1:0] d, output reg [1:0] a, output reg [1:0] b);
  always @(posedge clk) begin
    if (load) begin a <= d; b <= ~d; end
    else begin a <= b; b <= a; end
  end
endmodule`,
  },
  {
    name: "seq-shift-register-and-comb-output",
    clock: "clk",
    src: `module t(input wire clk, input wire rst, input wire d, output reg [3:0] s, output wire all1);
  always @(posedge clk)
    if (rst) s <= 0;
    else s <= {s[2:0], d};
  assign all1 = &s;
endmodule`,
  },
  {
    name: "seq-case-fsm",
    clock: "clk",
    src: `module t(input wire clk, input wire rst, input wire x, output reg [1:0] st, output wire hit);
  always @(posedge clk) begin
    if (rst) st <= 2'd0;
    else case (st)
      2'd0: st <= x ? 2'd1 : 2'd0;
      2'd1: st <= x ? 2'd2 : 2'd0;
      2'd2: st <= x ? 2'd2 : 2'd3;
      default: st <= 2'd0;
    endcase
  end
  assign hit = st == 2'd3;
endmodule`,
  },
  {
    name: "seq-hierarchy-register",
    clock: "clk",
    src: `module dff(input wire clk, input wire d, output reg q);
  always @(posedge clk) q <= d;
endmodule
module t(input wire clk, input wire rst, input wire d, output wire q2);
  wire q1, d1;
  assign d1 = rst ? 1'b0 : d;
  dff a (.clk(clk), .d(d1), .q(q1));
  dff b (.clk(clk), .d(rst ? 1'b0 : q1), .q(q2));
endmodule`,
  },
  // Latch inference (rejected by the engine; compared with Yosys).
  {
    name: "latch-if-without-else",
    latch: true,
    src: `module t(input wire en, input wire a, output reg y);
  always @(*) begin
    if (en) y = a;
  end
endmodule`,
  },
  {
    name: "latch-incomplete-case",
    latch: true,
    src: `module t(input wire [1:0] s, input wire a, output reg y);
  always @(*) case (s)
    2'b00: y = a;
    2'b01: y = ~a;
    2'b10: y = 1'b0;
  endcase
endmodule`,
  },
  {
    name: "no-latch-full-case",
    latch: false,
    src: `module t(input wire [1:0] s, input wire a, output reg y);
  always @(*) case (s)
    2'b00: y = a;
    2'b01: y = ~a;
    2'b10: y = 1'b0;
    2'b11: y = 1'b1;
  endcase
endmodule`,
  },
  {
    name: "latch-one-output-missing",
    latch: true,
    src: `module t(input wire s, input wire a, output reg y, output reg z);
  always @(*) begin
    if (s) begin y = a; z = 1'b1; end
    else y = ~a;
  end
endmodule`,
  },
];
