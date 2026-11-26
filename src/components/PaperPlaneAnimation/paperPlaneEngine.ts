// @ts-nocheck
/* Paper plane animation engine (from PaperPlaneAnimation.zip, logic unchanged).
   Plain math on number arrays; type checking is skipped for this file only. */
/**
 * paperPlaneEngine.js
 * ------------------------------------------------------------------
 * Pure-JS engine for the "document → paper airplane" animation.
 * No dependencies. Works in any framework (React, Vue, plain JS).
 *
 * How it works:
 *  - The sheet is a flat polygon in "paper space" (x 140–260, y 115–285).
 *  - Each fold step cuts the faces along a crease line (polygon clipping)
 *    and rotates the moving part around the crease in real 3D.
 *  - After the last table fold, the sheet is split into 4 rigid parts
 *    (2 keel halves + 2 wings) and posed into a 3D paper plane.
 *  - Everything is projected with a simple perspective camera and
 *    drawn as SVG polygons, sorted back-to-front.
 *
 * Main API:
 *   frame(t, palette) -> everything needed to draw one frame at time t
 *   TOTAL             -> length of one loop in seconds (5)
 *   PALETTES          -> 'gradient' | 'flat' | 'soft'
 * ------------------------------------------------------------------
 */

// Paper space: x right, y toward the tail (nose = small y), z = up off the table.
const TOTAL = 5.0;
const BASE = 3.0; // timeline below is written for 3s and stretched to TOTAL
const SHEET = [[140,115],[260,115],[260,285],[140,285]];
// document details, in paper space (sheet: x 140–260, y 115–285)
const wave = (x0, x1, y, amp, len) => { const pts = []; for (let x = x0; x <= x1 + 0.01; x += 2) pts.push([x, y + amp * Math.sin((x - x0) / len * Math.PI * 2)]); return pts; };
const rrect = (x0, y0, x1, y1, r) => { const pts = []; [[x1-r,y0+r,-90],[x1-r,y1-r,0],[x0+r,y1-r,90],[x0+r,y0+r,180]].forEach(([cx,cy,a0]) => { for (let a = 0; a <= 90; a += 18) { const t = (a0 + a) * Math.PI / 180; pts.push([cx + r*Math.cos(t), cy + r*Math.sin(t)]); } }); return pts; };
const circle = (cx, cy, r) => { const pts = []; for (let a = 0; a < 360; a += 20) pts.push([cx + r*Math.cos(a*Math.PI/180), cy + r*Math.sin(a*Math.PI/180)]); return pts; };
const DOC = [
  { kind:'poly', pts:[[236.5,112.5],[262.5,112.5],[262.5,138.5]], fill:'cover' },
  { kind:'poly', pts:[[238,115],[238,137],[260,137]], fill:'url(#dpEar)', ink:true },
  { kind:'line', pts:[[238,115],[260,137]], stroke:'inkOnly', sw:2 },
  { kind:'poly', pts:rrect(152,127,188,142,7.5), fill:'url(#dpPink)' },
  { kind:'line', pts:[[196,134.5],[226,134.5]], stroke:'lineCol', sw:4 },
  { kind:'line', pts:[[154,162],[246,162]], stroke:'lineCol', sw:3.4 },
  { kind:'line', pts:[[154,179],[236,179]], stroke:'lineCol', sw:3.4 },
  { kind:'line', pts:[[154,196],[246,196]], stroke:'lineCol', sw:3.4 },
  { kind:'line', pts:[[154,213],[214,213]], stroke:'lineCol', sw:3.4 },
  { kind:'line', pts:[[154,230],[240,230]], stroke:'lineCol', sw:3.4 },
  { kind:'line', pts:wave(154,196,262,4.5,11), stroke:'sigCol', sw:2.6 }
];
const WING_A = [200,185], WING_B = [187,285];
const OPS = [
  // 2. top corners to the centre line
  { ops: [{ a:[200,115], b:[140,175], mov:[140,115], dir:1 }, { a:[200,115], b:[260,175], mov:[260,115], dir:1 }] },
  // 3. fold the triangle down
  { ops: [{ a:[0,185], b:[400,185], mov:[200,115], dir:1, tag:'tip' }] },
  // 4. top corners to the centre again
  { ops: [{ a:[200,185], b:[140,245], mov:[140,185], dir:1 }, { a:[200,185], b:[260,245], mov:[260,185], dir:1 }] },
  // 5. small tip up to lock the flaps
  { ops: [{ a:[0,245], b:[400,245], mov:[200,254], dir:1, filter:(f) => f.tag === 'tip' }] },
];
// timeline (seconds)
const T_IDLE = 0.2, T_LAY = [0.2, 0.6];
// whole loop = 3 seconds
const STEP_T = [[0.65,0.9],[0.95,1.15],[1.2,1.45],[1.5,1.65]];
const T_STAND = [1.7, 2.1], T_WING = [2.0, 2.3], T_FLY = [2.38, 2.78], T_POP = [2.8, 3.0];

const sideOf = (a, b, p) => (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]);
function clipPoly(poly, a, b, sgn) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i+1) % poly.length];
    const sp = sideOf(a,b,p)*sgn, sq = sideOf(a,b,q)*sgn;
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t]); }
  }
  return out;
}
const area = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i+1)%pts.length]; s += p[0]*q[1] - q[0]*p[1]; } return s/2; };
function reflect2(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1], L = dx*dx + dy*dy;
  const t = ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L;
  return [2*(a[0] + dx*t) - p[0], 2*(a[1] + dy*t) - p[1]];
}
function buildStep(faces, step) {
  let items = faces.map((f) => ({ ...f, op: -1 }));
  step.ops.forEach((op, j) => {
    const sg = Math.sign(sideOf(op.a, op.b, op.mov));
    const next = [];
    items.forEach((it) => {
      if (it.op >= 0 || (op.filter && !op.filter(it))) { next.push(it); return; }
      const mv = op.all ? it.pts : clipPoly(it.pts, op.a, op.b, sg), fx = op.all ? [] : clipPoly(it.pts, op.a, op.b, -sg);
      if (fx.length > 2 && Math.abs(area(fx)) > 0.5) next.push({ ...it, pts: fx });
      if (Math.abs(area(mv)) > 0.5) next.push({ ...it, pts: mv, op: j });
    });
    items = next;
  });
  const zs = items.map((i) => i.z), maxZ = Math.max(...zs), minZ = Math.min(...zs);
  step.ops.forEach((op, j) => {
    const mz = items.filter((i) => i.op === j).map((i) => i.z);
    if (!mz.length) return;
    const hi = Math.max(...mz), lo = Math.min(...mz);
    items.forEach((i) => { if (i.op === j) i.zF = op.dir > 0 ? maxZ + 1 + (hi - i.z) : minZ - 1 - (i.z - lo); });
  });
  items.forEach((i) => { if (i.op < 0) i.zF = i.z; });
  const after = step.bounce ? faces : items.map((i) => {
    if (i.op < 0) return { pts: i.pts, back: i.back, z: i.z, tag: i.tag };
    const op = step.ops[i.op];
    return { pts: i.pts.map((p) => reflect2(p, op.a, op.b)), back: !i.back, z: i.zF, tag: op.tag || i.tag };
  });
  return { items, after };
}
const STATES = [[{ pts: SHEET, back: false, z: 0, tag: '' }]];
const BUILT = OPS.map((s, i) => { const b = buildStep(STATES[i], s); STATES.push(b.after); return b; });
// the locked sheet, cut into rigid parts: left/right half x keel/wing
const WING_L = { a:[200,185], b:[187,285], mov:[140,250], dir:1 };
const WING_R = { a:[200,185], b:[213,285], mov:[260,250], dir:1 };
const PLANE_ITEMS = (() => {
  const faces = STATES[4];
  const zs = [...new Set(faces.map((f) => f.z))].sort((a, b) => a - b);
  const out = [];
  faces.forEach((f) => {
    [['L', -1, WING_L], ['R', 1, WING_R]].forEach(([side, sg, W]) => {
      const half = clipPoly(f.pts, [200,0], [200,400], -sg);
      if (half.length < 3 || Math.abs(area(half)) < 0.5) return;
      const ws = Math.sign(sideOf(W.a, W.b, W.mov));
      const wing = clipPoly(half, W.a, W.b, ws), keel = clipPoly(half, W.a, W.b, -ws);
      const base = { back: f.back, z: f.z, zg: zs.indexOf(f.z) * 0.25, side };
      if (keel.length > 2 && Math.abs(area(keel)) > 0.5) out.push({ ...base, pts: keel, wing: null, group: side + 'k' });
      if (wing.length > 2 && Math.abs(area(wing)) > 0.5) out.push({ ...base, pts: wing, wing: W, group: side + 'w' });
    });
  });
  return out;
})();

function rot3(p, op, th) {
  const a = op.a, dx = op.b[0]-a[0], dy = op.b[1]-a[1], L = Math.hypot(dx, dy), ux = dx/L, uy = dy/L;
  const t = (p[0]-a[0])*ux + (p[1]-a[1])*uy;
  const fx = a[0] + ux*t, fy = a[1] + uy*t;
  const vx = p[0]-fx, vy = p[1]-fy, vz = p[2] || 0;
  const c = Math.cos(th*op.dir), s = Math.sin(th*op.dir);
  const cx = uy*vz, cy = -ux*vz, cz = ux*vy - uy*vx, dot = ux*vx + uy*vy;
  const sg = Math.sign((ux*(op.mov[1]-fy) - uy*(op.mov[0]-fx)) || 1), ss = s * sg;
  return [fx + vx*c + cx*ss + ux*dot*(1-c), fy + vy*c + cy*ss + uy*dot*(1-c), vz*c + cz*ss];
}
const clamp = (x) => Math.max(0, Math.min(1, x));
const seg = (t, r) => clamp((t - r[0]) / (r[1] - r[0]));
const ease = (k) => k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;
const easeIn = (k) => k*k*k;
const easeOut = (k) => 1 - Math.pow(1-k, 3);
const back = (k) => { const c = 1.7; return 1 + (c+1)*Math.pow(k-1,3) + c*Math.pow(k-1,2); };
const lerp = (a, b, k) => a + (b - a)*k;
function matMul(A, B) { const R = [[0,0,0],[0,0,0],[0,0,0]]; for (let i=0;i<3;i++) for (let j=0;j<3;j++) R[i][j] = A[i][0]*B[0][j] + A[i][1]*B[1][j] + A[i][2]*B[2][j]; return R; }
const Rx = (a) => [[1,0,0],[0,Math.cos(a),-Math.sin(a)],[0,Math.sin(a),Math.cos(a)]];
const Rz = (a) => [[Math.cos(a),-Math.sin(a),0],[Math.sin(a),Math.cos(a),0],[0,0,1]];
function toQ(m) {
  const tr = m[0][0] + m[1][1] + m[2][2]; let w, x, y, z;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s/4; x = (m[2][1]-m[1][2])/s; y = (m[0][2]-m[2][0])/s; z = (m[1][0]-m[0][1])/s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1]-m[1][2])/s; x = s/4; y = (m[0][1]+m[1][0])/s; z = (m[0][2]+m[2][0])/s; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2]-m[2][0])/s; x = (m[0][1]+m[1][0])/s; y = s/4; z = (m[1][2]+m[2][1])/s; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0]-m[0][1])/s; x = (m[0][2]+m[2][0])/s; y = (m[1][2]+m[2][1])/s; z = s/4; }
  return [w, x, y, z];
}
function fromQ(q) { const [w,x,y,z] = q; return [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],[2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],[2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]; }
function slerp(a, b, t) {
  let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if (d < 0) { b = b.map((v) => -v); d = -d; }
  if (d > 0.9995) { const r = a.map((v, i) => v + (b[i]-v)*t); const n = Math.hypot(...r); return r.map((v) => v/n); }
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (Math.sin((1-t)*th)*v + Math.sin(t*th)*b[i]) / s);
}
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x/n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
// camera: paper upright (icon) and paper lying on the table, nose pointing right
const M_UP = [[1,0,0],[0,1,0],[0,0,1]];
const M_TABLE = matMul(Rx(0.88), Rz(1.32));
const Q_UP = toQ(M_UP), Q_TABLE = toQ(M_TABLE);
const LIGHT = norm([-0.3, -0.6, 0.75]);
const K_UP = 1.3, K_TABLE = 1.65, K_PLANE = 1.9;
const PLANE_C = [200, 235]; // centre of the folded plane in paper space

// one part of the sheet, posed in 3D: wings out, halves folded down (flaps outside), body rolled upright
function planePoint(p, it, P) {
  let q = [p[0], p[1], it.zg];
  if (it.wing) q = rot3(q, it.wing, P.wing);
  let X = q[0] - 200, Z = q[2];
  const a = (it.side === 'L' ? 1 : -1) * P.half / 2;
  [X, Z] = [X*Math.cos(a) - Z*Math.sin(a), X*Math.sin(a) + Z*Math.cos(a)];
  const r = P.roll;
  [X, Z] = [X*Math.cos(r) - Z*Math.sin(r), X*Math.sin(r) + Z*Math.cos(r)];
  let Y = q[1] - PLANE_C[1];
  const ps = P.pitch;
  [Y, Z] = [Y*Math.cos(ps) - Z*Math.sin(ps), Y*Math.sin(ps) + Z*Math.cos(ps)];
  return [200 + X + P.sx, PLANE_C[1] + Y + P.sy, Z + P.lift];
}

function frame(t, pal, fly = 1) {
  t = t * BASE / TOTAL;
  let polys = [];
  let cx = 200, cy = 200, k = K_UP, q = Q_UP, tx = 0, ty = 0, op = 1, mode = 'stack', lines = 0, trail = 0, shadow = 0;
  const flat = (faces) => faces.map((f) => ({ p3: f.pts.map((p) => [p[0], p[1], 0]), back: f.back, key: f.z, o: Math.sign(area(f.pts)) }));
  let P = null;
  if (t < STEP_T[0][0] || t >= T_POP[0]) {
    polys = flat(STATES[0]);
    lines = t >= T_POP[0] ? clamp((t - T_POP[0]) * 8) : 1 - seg(t, [0.58, 0.68]);
    if (t < T_IDLE) { ty = -5 * Math.sin(seg(t, [0, T_IDLE]) * Math.PI); shadow = 1; }
    else if (t < STEP_T[0][0]) { const e = ease(seg(t, T_LAY)); q = slerp(Q_UP, Q_TABLE, e); k = lerp(K_UP, K_TABLE, e); shadow = 1 - e; ty = -14 * Math.sin(e * Math.PI); }
    if (t >= T_POP[0]) { const e = seg(t, T_POP); k = K_UP * (0.4 + 0.6*back(e)); op = clamp(e * 3); ty = 16 * (1 - e); shadow = e; }
  } else if (t < T_STAND[0]) {
    q = Q_TABLE; k = K_TABLE;
    let i = 0; while (i < STEP_T.length - 1 && t >= STEP_T[i+1][0]) i++;
    const r = STEP_T[i], B = BUILT[i];
    if (t <= r[1]) {
      const kk = ease(seg(t, r));
      const th = OPS[i].bounce ? Math.PI * 0.94 * Math.sin(kk * Math.PI) : Math.PI * kk;
      polys = B.items.map((it) => {
        const opx = it.op >= 0 ? OPS[i].ops[it.op] : null;
        const lift = OPS[i].flip ? 40 * Math.sin(kk * Math.PI) : 0;
        const p3 = it.pts.map((p) => { const r3 = opx ? rot3([p[0], p[1], 0], opx, th) : [p[0], p[1], 0]; r3[2] += lift; return r3; });
        const key = opx ? 1000 + (th < Math.PI/2 ? it.z : it.zF) : it.z;
        return { p3, back: it.back, key, o: Math.sign(area(it.pts)) };
      });
    } else polys = flat(STATES[i+1]);
  } else {
    // the folded body stands up on its spine, wings open, then it flies
    const s = ease(seg(t, T_STAND)), w = ease(seg(t, T_WING));
    const rl = easeOut(seg(t, [T_STAND[0] + 0.05, T_STAND[1]]));
    P = { half: s * (Math.PI - 0.3), roll: rl * Math.PI, wing: w * (Math.PI/2 - 0.06), pitch: 0, lift: 34 * s + 12 * Math.sin(Math.PI * seg(t, T_STAND)), sx: 0, sy: 0 };
    q = Q_TABLE;
    k = lerp(K_TABLE, K_PLANE, s);
    cx = 200; cy = lerp(200, PLANE_C[1] - 18 * Math.sin(Math.PI * s), s);
    shadow = s;
    if (t >= T_WING[1]) {
      const a1 = ease(seg(t, [T_WING[1], T_FLY[0]]));      // tilt nose up, small pull back
      const f = easeIn(seg(t, T_FLY));
      P.pitch = -0.22 * a1 - 0.12 * f;
      P.sy = 10 * a1 - 520 * f;                              // forward = toward the nose (-y)
      P.lift += -4 * a1 + 150 * f;
      // fly > 1: also travel across the screen (up and to the right) so the
      // plane leaves the screen instead of only shrinking into the distance.
      if (fly > 1) { tx = 330 * fly * f; ty = -165 * fly * f; }
      shadow = 1 - seg(t, [T_FLY[0], T_FLY[0] + 0.2]);
      trail = seg(t, [T_FLY[0] + 0.03, T_FLY[0] + 0.08]) * (1 - seg(t, [T_FLY[1] - 0.08, T_FLY[1]]));
    }
    if (t >= T_FLY[1]) op = 0;
    mode = 'groups';
    polys = PLANE_ITEMS.map((it) => ({ p3: it.pts.map((p) => planePoint(p, it, P)), back: it.back, key: it.z, o: Math.sign(area(it.pts)), group: it.group }));
  }
  // --- project
  const M = fromQ(q), D = 750;
  const view = (p) => { const x = (p[0]-cx)*k, y = (p[1]-cy)*k, z = (p[2]||0)*k; return [M[0][0]*x+M[0][1]*y+M[0][2]*z, M[1][0]*x+M[1][1]*y+M[1][2]*z, M[2][0]*x+M[2][1]*y+M[2][2]*z]; };
  const proj = (p) => { const v = view(p); const s = D / (D - v[2]); return [200 + v[0]*s + tx, 200 + v[1]*s + ty, v[2]]; };
  let out = polys.map((pl) => {
    const P2 = pl.p3.map(proj), W = pl.p3.map(view);
    const pa = area(P2);
    const seeTop = Math.sign(pa) === pl.o;
    const showBack = seeTop ? pl.back : !pl.back;
    let n = norm(cross([W[1][0]-W[0][0], W[1][1]-W[0][1], W[1][2]-W[0][2]], [W[2][0]-W[0][0], W[2][1]-W[0][1], W[2][2]-W[0][2]]));
    if (n[2] < 0) n = n.map((v) => -v);
    const lit = Math.max(0, n[0]*LIGHT[0] + n[1]*LIGHT[1] + n[2]*LIGHT[2]);
    const sh = pal.shadeMin + (1 - pal.shadeMin) * lit;
    const col = showBack ? 'url(#dpB)' : 'url(#dpF)';
    const dz = W.reduce((s, p) => s + p[2], 0) / W.length;
    return { pts: P2.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), fill: col, shade: Math.max(0, (1 - sh) * 0.85 - 0.06).toFixed(3), key: pl.key, dz, seeTop, group: pl.group, ok: Math.abs(pa) > 0.3 };
  }).filter((p) => p.ok);
  if (mode === 'groups') {
    // order the four rigid parts (two keel halves, two wings) by depth, layers inside each by which side faces us
    const G = {};
    out.forEach((f) => { (G[f.group] = G[f.group] || { list: [], dz: 0, up: 0 }); G[f.group].list.push(f); G[f.group].dz += f.dz; G[f.group].up += f.seeTop ? 1 : -1; });
    const order = Object.values(G).map((g) => ({ ...g, dz: g.dz / g.list.length })).sort((a, b) => a.dz - b.dz);
    out = [];
    order.forEach((g) => { g.list.sort((a, b) => g.up >= 0 ? a.key - b.key : b.key - a.key); out.push(...g.list); });
  } else out.sort((a, b) => a.key - b.key);
  const ptsStr = (arr) => arr.map((p) => proj([p[0], p[1], 0.4])).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const decalPolys = [], decalLines = [];
  if (lines > 0) DOC.forEach((d) => {
    if (d.kind === 'poly') decalPolys.push({ pts: ptsStr(d.pts), fill: d.fill === 'cover' ? pal.bg : d.fill, stroke: d.ink && pal.ink ? pal.ink : 'none' });
    else if (d.stroke !== 'inkOnly' || pal.ink) decalLines.push({ pts: ptsStr(d.pts), stroke: d.stroke === 'inkOnly' ? pal.ink : pal[d.stroke], sw: (d.sw * k * 0.95).toFixed(2) });
  });
  // gradient runs top → bottom of whatever is on screen
  let gy0 = 1e9, gy1 = -1e9, gx0 = 1e9, gx1 = -1e9;
  out.forEach((f) => f.pts.split(' ').forEach((pp) => { const [x, y] = pp.split(',').map(Number); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y); gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); }));
  const g = out.length ? { x: ((gx0 + gx1) / 2).toFixed(1), y1: gy0.toFixed(1), y2: Math.max(gy1, gy0 + 1).toFixed(1) } : { x: 200, y1: 0, y2: 400 };
  // trail: streaks behind the tail, along the flight line
  let trail1 = 'M0 0', trail2 = 'M0 0';
  if (P && trail > 0) {
    const it = PLANE_ITEMS.find((i) => !i.wing) || PLANE_ITEMS[0];
    const nose = proj(planePoint([200, 185], it, P)), tail = proj(planePoint([200, 285], it, P));
    const d = norm([nose[0]-tail[0], nose[1]-tail[1]]), pp = [-d[1], d[0]];
    const ln = (o, a, b) => 'M' + (tail[0] - d[0]*a + pp[0]*o).toFixed(1) + ' ' + (tail[1] - d[1]*a + pp[1]*o).toFixed(1) + ' L' + (tail[0] - d[0]*b + pp[0]*o).toFixed(1) + ' ' + (tail[1] - d[1]*b + pp[1]*o).toFixed(1);
    trail1 = ln(-26, 10, 70); trail2 = ln(6, 18, 52);
  }
  const shY = t < STEP_T[0][0] || t >= T_POP[0] ? 312 : 300;
  return { faces: out, decalPolys, decalLines, g, lineOp: lines, op, trail, trail1, trail2, shOp: shadow * pal.shadowOp, shX: 200, shY, shRx: P ? 80 : 70 };
}

// ===== colour palettes =====
export const PALETTES = {
  flat: { bg:'#1C98FF', f0:'#FFFFFF', f1:'#FFFFFF', b0:'#D6E8FF', b1:'#D6E8FF', shadeCol:'#0B2540', ink:'#0B0B0B', sw:2,
          ear0:'#0B0B0B', ear1:'#0B0B0B', pink0:'#0B0B0B', pink1:'#0B0B0B', green0:'#0B0B0B', green1:'#0B0B0B',
          lineCol:'#0B0B0B', sigCol:'#0B0B0B', checkCol:'#FFFFFF', trail:'#FFFFFF', shadow:'#0B0B0B', shadeMin:0.84, shadowOp:0.85 },
  gradient: { bg:'#FFFDF7', f0:'#DDEBFF', f1:'#CBEFBC', b0:'#7DBDFF', b1:'#2C7CF2', shadeCol:'#163B37', ink:null, sw:0.8,
          ear0:'#A9D4FF', ear1:'#258EFB', pink0:'#FFC9DF', pink1:'#F7609E', green0:'#A6E66F', green1:'#12AD2B',
          lineCol:'#2F80ED', sigCol:'#163B37', checkCol:'#FFFFFF', trail:'#7DBDFF', shadow:'#163B37', shadeMin:0.62, shadowOp:0.16 },
  soft: { bg:'#8FA9C4', f0:'#F7F7F4', f1:'#F7F7F4', b0:'#E8C24A', b1:'#E8C24A', shadeCol:'#2B2A25', ink:null, sw:0.8,
          ear0:'#F2D27A', ear1:'#E8C24A', pink0:'#E8C24A', pink1:'#E8C24A', green0:'#9AA7B5', green1:'#9AA7B5',
          lineCol:'#9AA7B5', sigCol:'#6B7785', checkCol:'#FFFFFF', trail:'#FFFFFF', shadow:'#2B3A4A', shadeMin:0.66, shadowOp:0.3 }
};

export { frame, TOTAL };
