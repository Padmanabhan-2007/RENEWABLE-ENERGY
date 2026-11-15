import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Activity,
  Box,
  Clock,
  Cloud,
  Image as ImageIcon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Wind,
  Zap,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════════════
   RenewableScene3D — interactive digital twin of a wind + solar site.

   Layout guarantee (no overlapping graphics):
   • ONE WebGL canvas. Every control, label and stat lives OUTSIDE the canvas.
   • Every object is placed through a footprint registry (roads, pads, solar
     field, substation, pylons) so trees, grass and cables can never intersect
     the equipment.
   • Every object sits on the same terrain height function, so nothing floats
     or sinks.
   • Clouds fade out when they would sit between the camera and the model.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───────────────────────────── types ───────────────────────────── */

type V3 = [number, number, number];
type AssetKey = "turbine-0" | "turbine-1" | "turbine-2" | "solar" | "substation";
type PresetKey = "overview" | "wind" | "solar" | "grid";
type ViewMode = "3d" | "render";

interface SceneApi {
  goTo: (preset: PresetKey) => void;
  focus: (asset: AssetKey) => void;
}

interface LiveParams {
  windSpeed: number;
  hour: number;
  cloud: number;
  isPlaying: boolean;
  showFlow: boolean;
  selected: AssetKey | null;
  viewMode: ViewMode;
  reducedMotion: boolean;
}

interface TurbineDef {
  id: AssetKey;
  name: string;
  x: number;
  z: number;
  scale: number;
  phase: number;
}

interface Metrics {
  turbineKw: number[];
  windKw: number;
  solarKw: number;
  totalKw: number;
  sunElevationDeg: number;
  irradiance: number;
  trackerDeg: number;
  rotorRpm: number;
  isDay: boolean;
  co2Kg: number;
}

export interface RenewableScene3DProps {
  /** Optional reference render shown by the "Rendered view" toggle. */
  renderImageSrc?: string;
  className?: string;
}

/* ───────────────────────────── site layout ───────────────────────────── */

const TURBINES: TurbineDef[] = [
  { id: "turbine-0", name: "WTG-01", x: -16, z: -13, scale: 0.95, phase: 0.0 },
  { id: "turbine-1", name: "WTG-02", x: -4, z: -17, scale: 0.86, phase: 2.1 },
  { id: "turbine-2", name: "WTG-03", x: 9, z: -14, scale: 0.92, phase: 4.2 },
];

const SUBSTATION = { x: -8, z: 3, w: 7.2, d: 6.2 };

const SOLAR = {
  cx: 10,
  cz: 4,
  cols: 4,
  tablesPerCol: 3,
  pitchX: 3.4,
  tableLen: 4.0,
  tableGap: 0.4,
  tableW: 1.7,
  pivotY: 1.35,
};
const SOLAR_FIELD = { w: 12.4, d: 13.6 };

const TOWER_H = 10.4;
const HUB_Y = TOWER_H + 0.34;
const BLADE_ROOT = 0.3;
const BLADE_TIP = 5.4;

const ROADS: { pts: [number, number][]; w: number }[] = [
  { w: 2.1, pts: [[24, 36], [15, 26], [5, 19], [-3, 14.5], [-8, 10], [-8, 6.4]] },
  { w: 1.5, pts: [[5, 19], [11, 16.6], [18, 15.4], [23, 14]] },
  { w: 1.5, pts: [[-8, -0.2], [-8, -3], [-7, -7], [-4.5, -11], [-4, -15.4]] },
  { w: 1.3, pts: [[-7, -7], [-12, -9], [-15, -10.5], [-15.9, -11.2]] },
  { w: 1.3, pts: [[-4.5, -11], [1, -11.4], [6, -11.8], [8.7, -12]] },
];

const PYLONS: [number, number][] = [[-19, 3.2], [-32, 4.2], [-45, 5.6]];

const SHOTS: Record<PresetKey, { pos: V3; target: V3 }> = {
  overview: { pos: [27, 19, 37], target: [-1, 3, -3] },
  wind: { pos: [8, 10, 4], target: [-4, 6, -15] },
  solar: { pos: [27, 11, 25], target: [10, 0.8, 4] },
  grid: { pos: [0, 9, 18], target: [-12, 2.5, 3] },
};

/* ───────────────────────────── energy model ───────────────────────────── */

const RATED_KW = 3000;
const SOLAR_PEAK_KW = 2400;
const WAKE = [1, 0.96, 0.91];
const TOTAL_PEAK_KW = RATED_KW * TURBINES.length + SOLAR_PEAK_KW;

const windPowerKw = (v: number): number => {
  if (v < 3 || v >= 25) return 0;
  if (v >= 12) return RATED_KW;
  const t = (v - 3) / 9;
  return RATED_KW * t * t * t;
};

/** Wind at a given turbine. Plant-wide storm cut-out is judged on free-stream wind. */
const hubWind = (speed: number, i: number): number => (speed >= 25 ? speed : speed * WAKE[i]);

const rotorRpm = (v: number): number => {
  if (v >= 25) return 0;
  // Below cut-in the animation shows a slow freewheel so low wind is visible;
  // the electrical power curve remains at zero until 3 m/s.
  if (v < 3) return v > 0.5 ? 6 : 0;
  return Math.min(v, 12) * 1.2;
};

/* ───────────────────────────── math helpers ───────────────────────────── */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Sun path: rises east (+x) at 06:00, sets west (-x) at 18:00. */
const sunDirection = (hour: number, out = new THREE.Vector3()): THREE.Vector3 => {
  const p = ((hour - 6) / 12) * Math.PI;
  return out.set(Math.cos(p), Math.sin(p) * 0.92, 0.28).normalize();
};

const computeMetrics = (windSpeed: number, hour: number, cloud: number): Metrics => {
  const turbineKw = WAKE.map((_, i) => windPowerKw(hubWind(windSpeed, i)));
  const windKw = turbineKw.reduce((a, b) => a + b, 0);
  const dir = sunDirection(hour);
  const sinEl = Math.max(0, dir.y);
  const irradiance = 1000 * Math.pow(sinEl, 1.15) * (1 - 0.78 * cloud);
  const solarKw = SOLAR_PEAK_KW * (irradiance / 1000) * 0.92;
  const totalKw = windKw + solarKw;
  const trackerDeg = dir.y > 0.02 ? THREE.MathUtils.radToDeg(clamp(Math.atan2(dir.x, dir.y), -1.05, 1.05)) : 0;
  return {
    turbineKw,
    windKw,
    solarKw,
    totalKw,
    sunElevationDeg: THREE.MathUtils.radToDeg(Math.asin(clamp(dir.y, -1, 1))),
    irradiance,
    trackerDeg,
    rotorRpm: rotorRpm(windSpeed),
    isDay: dir.y > 0.02,
    co2Kg: totalKw * 0.71,
  };
};

const fmtPower = (kw: number) => (kw >= 1000 ? `${(kw / 1000).toFixed(2)} MW` : `${Math.round(kw)} kW`);
const fmtHour = (h: number) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const windStatus = (v: number) =>
  v < 3 ? "Below cut-in · idle spin only" : v < 12 ? "Ramping to rated speed" : v < 25 ? "Rated speed · pitch regulated" : "Storm cut-out · brake active";

/* ───────────────────────────── sky palette ───────────────────────────── */

const PAL = {
  nightTop: new THREE.Color("#050a1e"),
  nightHor: new THREE.Color("#18233f"),
  twiTop: new THREE.Color("#3b5188"),
  twiHor: new THREE.Color("#f2a56b"),
  dayTop: new THREE.Color("#5f9bd8"),
  dayHor: new THREE.Color("#dfeaf0"),
  haze: new THREE.Color("#a9b3ba"),
};

const skyPalette = (sunY: number, cloud: number) => {
  const t1 = smoothstep(-0.14, 0.06, sunY);
  const t2 = smoothstep(0.04, 0.42, sunY);
  const top = PAL.nightTop.clone().lerp(PAL.twiTop, t1).lerp(PAL.dayTop, t2);
  const horizon = PAL.nightHor.clone().lerp(PAL.twiHor, t1).lerp(PAL.dayHor, t2);
  top.lerp(PAL.haze, cloud * 0.28 * t2);
  horizon.lerp(PAL.haze, cloud * 0.3 * t2);
  return {
    top,
    horizon,
    dayF: smoothstep(-0.04, 0.28, sunY),
    nightF: 1 - smoothstep(-0.2, 0.02, sunY),
  };
};

/* ───────────────────────────── terrain ───────────────────────────── */

/** Single source of truth for ground height — everything is placed through it. */
const terrainHeight = (x: number, z: number): number => {
  const r = Math.hypot(x, z);
  const roll =
    Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.11 - 0.4) * 0.5 +
    Math.sin(x * 0.21 + z * 0.17 + 2.1) * 0.3 +
    Math.sin(x * 0.37 - z * 0.29) * 0.12;
  const site = 0.28 * roll;
  const edge = smoothstep(32, 95, r);
  const hills =
    3.5 + 3.2 * Math.sin(x * 0.045 + 0.6) * Math.cos(z * 0.05 - 1.1) + 2.2 * Math.sin(x * 0.09 + z * 0.07 + 1.7);
  const backdrop = 9 * smoothstep(-24, -85, z) * (0.65 + 0.35 * Math.sin(x * 0.05 + 0.4));
  const rim = 1 - smoothstep(125, 170, r);
  return (site * (1 - edge) + hills * edge + backdrop) * rim;
};

/* ───────────────────────────── footprint registry ───────────────────────────── */

class Footprints {
  private circles: { x: number; z: number; r: number }[] = [];
  private boxes: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  private lines: { pts: THREE.Vector2[]; r: number }[] = [];

  addCircle(x: number, z: number, r: number) {
    this.circles.push({ x, z, r });
  }
  addBox(cx: number, cz: number, w: number, d: number, margin = 0) {
    this.boxes.push({
      minX: cx - w / 2 - margin,
      maxX: cx + w / 2 + margin,
      minZ: cz - d / 2 - margin,
      maxZ: cz + d / 2 + margin,
    });
  }
  addLine(pts: THREE.Vector2[], r: number) {
    this.lines.push({ pts, r });
  }

  private static segDist(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1);
    return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
  }

  isFree(x: number, z: number, radius: number): boolean {
    for (const c of this.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return false;
    for (const b of this.boxes) {
      if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) return false;
    }
    const p = new THREE.Vector2(x, z);
    for (const l of this.lines) {
      for (let i = 0; i < l.pts.length - 1; i += 1) {
        if (Footprints.segDist(p, l.pts[i], l.pts[i + 1]) < l.r + radius) return false;
      }
    }
    return true;
  }
}

/* ───────────────────────────── procedural textures ───────────────────────────── */

const canvas2d = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
};

const finishTexture = (tex: THREE.CanvasTexture, aniso: number, repeat = false) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
};

const makeGrassTexture = (aniso: number) => {
  const { c, ctx } = canvas2d(256, 256);
  if (ctx) {
    ctx.fillStyle = "#d4dcc0";
    ctx.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(731);
    for (let i = 0; i < 11000; i += 1) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(70,100,58,0.16)" : "rgba(245,232,186,0.2)";
      ctx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 3);
    }
  }
  const tex = finishTexture(new THREE.CanvasTexture(c), aniso, true);
  tex.repeat.set(70, 70);
  return tex;
};

const makeRoadTexture = (aniso: number) => {
  const { c, ctx } = canvas2d(128, 256);
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, "#b4ae9d");
    g.addColorStop(0.08, "#d6cfbd");
    g.addColorStop(0.3, "#c3bca9");
    g.addColorStop(0.5, "#cfc8b6");
    g.addColorStop(0.7, "#c3bca9");
    g.addColorStop(0.92, "#d6cfbd");
    g.addColorStop(1, "#b4ae9d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
    const rnd = mulberry32(42);
    for (let i = 0; i < 3200; i += 1) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(90,84,70,0.18)" : "rgba(255,250,235,0.22)";
      ctx.fillRect(rnd() * 128, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }
  return finishTexture(new THREE.CanvasTexture(c), aniso, true);
};

const makePanelTexture = (aniso: number) => {
  const W = 256;
  const H = 640;
  const { c, ctx } = canvas2d(W, H);
  if (ctx) {
    ctx.fillStyle = "#c9d1d6";
    ctx.fillRect(0, 0, W, H);
    const inset = 7;
    const cols = 6;
    const rows = 16;
    const cw = (W - inset * 2) / cols;
    const ch = (H - inset * 2) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = inset + col * cw;
        const y = inset + r * ch;
        const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, "#1b3f69");
        g.addColorStop(0.55, "#16345a");
        g.addColorStop(1, "#1e4a7a");
        ctx.fillStyle = g;
        ctx.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
        ctx.fillStyle = "rgba(190,212,228,0.5)";
        ctx.fillRect(x + cw * 0.33, y + 1.5, 1, ch - 3);
        ctx.fillRect(x + cw * 0.66, y + 1.5, 1, ch - 3);
      }
    }
  }
  return finishTexture(new THREE.CanvasTexture(c), aniso);
};

const makeGlowTexture = () => {
  const { c, ctx } = canvas2d(128, 128);
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const makeDiscTexture = () => {
  const { c, ctx } = canvas2d(128, 128);
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.86, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/* ───────────────────────────── geometry builders ───────────────────────────── */

/** Twisted, tapered airfoil blade: round root blending into a thin NACA-style tip. */
const buildBladeGeometry = (): THREE.BufferGeometry => {
  const stations = 26;
  const P = 14;
  const N = P * 2;
  const pos: number[] = [];
  const idx: number[] = [];

  for (let s = 0; s <= stations; s += 1) {
    const f = s / stations;
    const r = lerp(BLADE_ROOT, BLADE_TIP, f);
    const chord =
      f < 0.14 ? lerp(0.5, 0.66, smoothstep(0, 0.14, f)) : lerp(0.66, 0.07, Math.pow((f - 0.14) / 0.86, 0.85));
    const thick = lerp(0.34, 0.1, Math.pow(f, 0.6));
    const twist = THREE.MathUtils.degToRad(lerp(17, 0.5, Math.pow(f, 0.55)));
    const circle = 1 - smoothstep(0, 0.12, f);

    for (let k = 0; k < N; k += 1) {
      const upper = k <= P;
      const u = upper ? (k / P) * Math.PI : ((N - k) / P) * Math.PI;
      const c = 0.5 * (1 - Math.cos(u));
      const yt =
        5 * thick * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1015 * c ** 4);
      let px = (c - 0.28) * chord;
      let pz = (upper ? 1 : -1) * yt * chord;
      if (circle > 0) {
        const ang = Math.PI - (k / P) * Math.PI;
        px = lerp(px, 0.3 * Math.cos(ang), circle);
        pz = lerp(pz, 0.3 * Math.sin(ang), circle);
      }
      const tx = px * Math.cos(twist) + pz * Math.sin(twist);
      const tz = -px * Math.sin(twist) + pz * Math.cos(twist);
      pos.push(tx, r, tz);
    }
  }

  for (let s = 0; s < stations; s += 1) {
    for (let k = 0; k < N; k += 1) {
      const a = s * N + k;
      const b = s * N + ((k + 1) % N);
      const c2 = (s + 1) * N + k;
      const d = (s + 1) * N + ((k + 1) % N);
      idx.push(a, b, c2, b, d, c2);
    }
  }

  // tip cap
  const tipCenter = (stations + 1) * N;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let k = 0; k < N; k += 1) {
    const i = (stations * N + k) * 3;
    cx += pos[i];
    cy += pos[i + 1];
    cz += pos[i + 2];
  }
  pos.push(cx / N, cy / N, cz / N);
  for (let k = 0; k < N; k += 1) idx.push(tipCenter, stations * N + ((k + 1) % N), stations * N + k);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** Puffy cloud: displaced sphere with smooth analytic normals. */
const buildCloudGeometry = (seed: number): THREE.BufferGeometry => {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  const normals = new Float32Array(p.count * 3);
  const rnd = mulberry32(seed);
  const o = [rnd() * 6, rnd() * 6, rnd() * 6];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i).normalize();
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
    const n =
      Math.sin(v.x * 3.1 + o[0]) * Math.sin(v.y * 3.7 + o[1]) * 0.24 +
      Math.sin(v.z * 4.3 + o[2] + v.x * 2) * 0.17 +
      Math.sin(v.x * 7.9 + v.y * 6.1 + o[1]) * 0.07;
    v.multiplyScalar(1 + n);
    if (v.y < 0) v.y *= 0.45;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return g;
};

const buildRoadMesh = (pts: [number, number][], width: number, mat: THREE.Material) => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
  );
  const len = curve.getLength();
  const n = Math.max(8, Math.ceil(len / 0.5));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nx = -tan.z;
    const nz = tan.x;
    const l = Math.hypot(nx, nz) || 1;
    const ox = (nx / l) * (width / 2);
    const oz = (nz / l) * (width / 2);
    const v = (t * len) / (width * 3);
    pos.push(p.x + ox, terrainHeight(p.x + ox, p.z + oz) + 0.05, p.z + oz);
    pos.push(p.x - ox, terrainHeight(p.x - ox, p.z - oz) + 0.05, p.z - oz);
    uv.push(0, v, 1, v);
  }
  for (let i = 0; i < n; i += 1) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  const flat = curve.getSpacedPoints(Math.ceil(len / 1.2)).map((p) => new THREE.Vector2(p.x, p.z));
  return { mesh, flat };
};

const catenary = (a: THREE.Vector3, b: THREE.Vector3, sag: number, segs = 16): THREE.Vector3[] => {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    out.push(p);
  }
  return out;
};

const rectOutline = (w: number, d: number, t: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2);
  s.lineTo(w / 2, -d / 2);
  s.lineTo(w / 2, d / 2);
  s.lineTo(-w / 2, d / 2);
  s.closePath();
  const h = new THREE.Path();
  h.moveTo(-w / 2 + t, -d / 2 + t);
  h.lineTo(-w / 2 + t, d / 2 - t);
  h.lineTo(w / 2 - t, d / 2 - t);
  h.lineTo(w / 2 - t, -d / 2 + t);
  h.closePath();
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
};

/* ───────────────────────────── disposal ───────────────────────────── */

const disposeTree = (root: THREE.Object3D) => {
  root.traverse((obj) => {
    const o = obj as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
      dispose?: () => void;
    };
    o.geometry?.dispose();
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => {
        Object.values(m as unknown as Record<string, unknown>).forEach((val) => {
          if (val instanceof THREE.Texture) val.dispose();
        });
        m.dispose();
      });
    }
    if (obj instanceof THREE.InstancedMesh) obj.dispose();
  });
};

/* ───────────────────────────── styles ───────────────────────────── */

const CSS = `
.rs3d{--rs-card:#fcfbf8;--rs-ink:#1f2a24;--rs-mute:#69746c;--rs-line:#e3ded2;--rs-soft:#f3f0e8;--rs-wind:#1f8a8f;--rs-solar:#d8920f;--rs-grid:#6a5bd0;--rs-accent:#2f7a55;
  color:var(--rs-ink);background:var(--rs-card);border:1px solid var(--rs-line);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:14px;
  box-shadow:0 1px 2px rgba(31,42,36,.04),0 14px 36px -20px rgba(31,42,36,.28);font-family:inherit}
.rs3d *,.rs3d *::before,.rs3d *::after{box-sizing:border-box}
.rs3d [hidden]{display:none!important}
.rs3d-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
.rs3d-kicker{margin:0 0 4px;font-size:11px;letter-spacing:.14em;font-weight:600;color:var(--rs-mute);text-transform:uppercase}
.rs3d-title{margin:0;font-size:clamp(18px,2.2vw,24px);line-height:1.2;font-weight:650}
.rs3d-seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border:1px solid var(--rs-line);border-radius:12px;background:var(--rs-soft)}
.rs3d-btn{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:var(--rs-ink);font:inherit;font-size:13px;font-weight:550;
  padding:7px 11px;border-radius:9px;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}
.rs3d-btn:hover{background:rgba(31,42,36,.07)}
.rs3d-btn:focus-visible,.rs3d-chip:focus-visible{outline:2px solid var(--rs-accent);outline-offset:2px}
.rs3d-btn[aria-pressed="true"]{background:#fff;box-shadow:0 1px 3px rgba(31,42,36,.16);color:var(--rs-accent)}
.rs3d-body{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media(min-width:980px){.rs3d-body{grid-template-columns:minmax(0,1fr) 312px}}
.rs3d-stage{position:relative;overflow:hidden;border-radius:14px;background:#dfe7e3;aspect-ratio:16/10;min-height:340px}
.rs3d-canvas{position:absolute;inset:0}
.rs3d-canvas canvas{display:block;width:100%;height:100%;touch-action:none;outline:none}
.rs3d-render{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rs3d-note{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:var(--rs-mute);font-size:14px}
.rs3d-side{display:flex;flex-direction:column;gap:10px;min-width:0}
.rs3d-card{border:1px solid var(--rs-line);background:#fff;border-radius:14px;padding:13px 14px}
.rs3d-label{margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--rs-mute);font-weight:600}
.rs3d-big{font-size:30px;font-weight:700;line-height:1.05;letter-spacing:-.02em}
.rs3d-sub{margin-top:3px;font-size:12.5px;color:var(--rs-mute)}
.rs3d-bar{display:flex;height:9px;margin-top:11px;border-radius:99px;overflow:hidden;background:var(--rs-soft)}
.rs3d-bar i{display:block;height:100%;transition:width .3s}
.rs3d-split{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:12.5px}
.rs3d-split b{font-weight:650}
.rs3d-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.rs3d-chips{display:flex;flex-wrap:wrap;gap:6px}
.rs3d-chip{border:1px solid var(--rs-line);background:var(--rs-soft);color:var(--rs-ink);font:inherit;font-size:12.5px;font-weight:550;padding:6px 10px;border-radius:99px;cursor:pointer;transition:all .15s}
.rs3d-chip:hover{background:#fff;border-color:#cfc9b8}
.rs3d-chip[aria-pressed="true"]{background:var(--rs-ink);border-color:var(--rs-ink);color:#fff}
.rs3d-rows{margin:0;display:grid;gap:7px}
.rs3d-rows div{display:flex;justify-content:space-between;gap:10px;font-size:13px;border-bottom:1px dashed var(--rs-line);padding-bottom:6px}
.rs3d-rows div:last-child{border-bottom:0;padding-bottom:0}
.rs3d-rows dt{color:var(--rs-mute)}
.rs3d-rows dd{margin:0;font-weight:620;text-align:right}
.rs3d-asset-title{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:15px;font-weight:650}
.rs3d-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;padding:14px;border:1px solid var(--rs-line);border-radius:14px;background:var(--rs-soft)}
.rs3d-slider{display:flex;flex-direction:column;gap:7px;min-width:0}
.rs3d-hint{font-size:11px;line-height:1.4;color:var(--rs-mute)}
.rs3d-slider-head{display:flex;align-items:center;gap:7px;font-size:13px}
.rs3d-slider-head b{font-weight:620}
.rs3d-slider-head output{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--rs-mute)}
.rs3d-slider input{width:100%;accent-color:var(--rs-accent);cursor:pointer}
.rs3d-foot{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:space-between;font-size:12.5px;color:var(--rs-mute)}
.rs3d-legend{display:flex;flex-wrap:wrap;gap:6px 14px}
.rs3d-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
`;

/* ───────────────────────────── component ───────────────────────────── */

export const RenewableScene3D: React.FC<RenewableScene3DProps> = ({
  renderImageSrc = "/renewable-site-render.png",
  className = "",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [windSpeed, setWindSpeed] = useState(9.5);
  const [hour, setHour] = useState(13.5);
  const [cloud, setCloud] = useState(0.25);
  const [showFlow, setShowFlow] = useState(true);
  const [autoDay, setAutoDay] = useState(false);
  const [selected, setSelected] = useState<AssetKey | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const paramsRef = useRef<LiveParams>({
    windSpeed, hour, cloud, isPlaying, showFlow, selected, viewMode, reducedMotion,
  });
  useEffect(() => {
    paramsRef.current = { windSpeed, hour, cloud, isPlaying, showFlow, selected, viewMode, reducedMotion };
  });

  const onSelectRef = useRef<(a: AssetKey | null) => void>(() => undefined);
  onSelectRef.current = setSelected;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(media.matches);
      if (media.matches) setIsPlaying(false);
    };
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (!autoDay || !isPlaying || reducedMotion) return undefined;
    const id = window.setInterval(() => setHour((h) => (h + 0.04) % 24), 100);
    return () => window.clearInterval(id);
  }, [autoDay, isPlaying, reducedMotion]);

  /* ───────────── the Three.js scene (built once) ───────────── */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setWebglFailed(true);
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Interactive 3D model of a wind and solar generation site");
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dfeaf0");
    scene.fog = new THREE.Fog("#dfeaf0", 55, 150);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
    camera.position.set(...SHOTS.overview.pos);

    /* ── sky dome (canvas gradient), stars, sun & moon sprites ── */
    const skyCanvas = canvas2d(4, 512);
    const skyTex = new THREE.CanvasTexture(skyCanvas.c);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(280, 48, 32), skyMat);
    skyDome.renderOrder = -10;
    scene.add(skyDome);

    const paintSky = (top: THREE.Color, hor: THREE.Color) => {
      const ctx = skyCanvas.ctx;
      if (!ctx) return;
      const mix = (t: number) => `#${top.clone().lerp(hor, t).getHexString()}`;
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, `#${top.getHexString()}`);
      g.addColorStop(0.14, mix(0.25));
      g.addColorStop(0.3, mix(0.62));
      g.addColorStop(0.44, mix(0.93));
      g.addColorStop(0.5, `#${hor.getHexString()}`);
      g.addColorStop(1, `#${hor.getHexString()}`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 512);
      skyTex.needsUpdate = true;
    };

    const glowTex = makeGlowTexture();
    const discTex = makeDiscTexture();
    const spriteBase = { transparent: true, depthWrite: false, fog: false, toneMapped: false } as const;
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ ...spriteBase, map: glowTex, color: "#ffd9a0", blending: THREE.AdditiveBlending }));
    sunGlow.scale.setScalar(150);
    sunGlow.renderOrder = -9;
    const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ ...spriteBase, map: discTex, color: "#fff6e0" }));
    sunCore.scale.setScalar(20);
    sunCore.renderOrder = -8;
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ ...spriteBase, map: discTex, color: "#dfe7ff" }));
    moon.scale.setScalar(11);
    moon.renderOrder = -8;
    scene.add(sunGlow, sunCore, moon);

    const starRnd = mulberry32(5);
    const starPos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i += 1) {
      const th = starRnd() * Math.PI * 2;
      const ph = Math.acos(0.04 + starRnd() * 0.96);
      starPos[i * 3] = 270 * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = 270 * Math.cos(ph);
      starPos[i * 3 + 2] = 270 * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }),
    );
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    scene.add(stars);

    /* ── image-based lighting from the live sky ── */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
    const envGroundMat = new THREE.MeshBasicMaterial({ color: "#6f7f58", side: THREE.BackSide });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(48, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), envGroundMat));
    const envSunMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const envSun = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 8), envSunMat);
    envScene.add(envSun);
    let envRT: THREE.WebGLRenderTarget | null = null;
    const rebuildEnv = () => {
      const next = pmrem.fromScene(envScene, 0.02);
      envRT?.dispose();
      envRT = next;
      scene.environment = next.texture;
    };

    /* ── lights ── */
    const hemi = new THREE.HemisphereLight("#cfe3f5", "#6c7a58", 0.5);
    const sun = new THREE.DirectionalLight("#fff2d8", 3.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 160 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04;
    const moonLight = new THREE.DirectionalLight("#9fb4ff", 0);
    scene.add(hemi, sun, moonLight);

    /* ── terrain ── */
    const terrainGeo = new THREE.PlaneGeometry(340, 340, 240, 240);
    terrainGeo.rotateX(-Math.PI / 2);
    {
      const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const meadow = new THREE.Color("#a9bb88");
      const deep = new THREE.Color("#76905f");
      const dry = new THREE.Color("#c1b88f");
      const rock = new THREE.Color("#8d9181");
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = terrainHeight(x, z);
        pos.setY(i, y);
        const n = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.cos(z * 0.27 - x * 0.11);
        const far = smoothstep(30, 100, Math.hypot(x, z));
        c.copy(meadow).lerp(dry, n * 0.32).lerp(deep, far * 0.7).lerp(rock, smoothstep(4.5, 9, y) * 0.55);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      terrainGeo.computeVertexNormals();
    }
    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({ map: makeGrassTexture(aniso), vertexColors: true, roughness: 1, metalness: 0 }),
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    /* ── registries ── */
    const footprints = new Footprints();
    const pickables: THREE.Mesh[] = [];
    const tag = (root: THREE.Object3D, asset: AssetKey) => {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.userData.asset = asset;
          pickables.push(o);
        }
      });
    };
    const nightSprites: { sprite: THREE.Sprite; base: number; blink: boolean }[] = [];
    const windowMats: THREE.MeshStandardMaterial[] = [];
    const lampLights: THREE.PointLight[] = [];
    const makeGlow = (color: string, size: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
      s.scale.setScalar(size);
      s.renderOrder = 5;
      return s;
    };

    /* ── roads ── */
    const roadMat = new THREE.MeshStandardMaterial({
      map: makeRoadTexture(aniso), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    ROADS.forEach((road) => {
      const { mesh, flat } = buildRoadMesh(road.pts, road.w, roadMat);
      scene.add(mesh);
      footprints.addLine(flat, road.w / 2 + 1.1);
    });

    /* ── shared materials ── */
    const concrete = new THREE.MeshStandardMaterial({ color: "#cfcdc4", roughness: 0.95 });
    const towerMat = new THREE.MeshStandardMaterial({ color: "#f6f5f0", roughness: 0.38, metalness: 0.12 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#fbfaf6", roughness: 0.34, metalness: 0.05, side: THREE.DoubleSide });
    const nacelleMat = new THREE.MeshStandardMaterial({ color: "#e8e9e3", roughness: 0.42, metalness: 0.15 });
    const accentMat = new THREE.MeshStandardMaterial({ color: "#b78b24", roughness: 0.35, metalness: 0.35 });
    const steel = new THREE.MeshStandardMaterial({ color: "#8d958f", metalness: 0.7, roughness: 0.36 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: "#59615c", metalness: 0.6, roughness: 0.5 });
    const porcelain = new THREE.MeshStandardMaterial({ color: "#e4e2dc", roughness: 0.3 });

    /* ── wind turbines ── */
    const bladeGeo = buildBladeGeometry();
    interface Rig {
      def: TurbineDef;
      yaw: THREE.Group;
      rotor: THREE.Group;
      cups: THREE.Group;
      beaconMat: THREE.MeshStandardMaterial;
      omega: number;
      yawNow: number;
      base: THREE.Vector3;
    }
    const rigs: Rig[] = TURBINES.map((def) => {
      const y0 = terrainHeight(def.x, def.z);
      const root = new THREE.Group();
      root.position.set(def.x, y0, def.z);
      root.scale.setScalar(def.scale);

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.8, 48), concrete);
      pad.position.y = -0.24;
      pad.receiveShadow = true;
      root.add(pad);

      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.52, 0.34, 36), darkSteel);
      flange.position.y = 0.33;
      flange.castShadow = true;
      root.add(flange);

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.4, TOWER_H, 40, 4), towerMat);
      tower.position.y = TOWER_H / 2;
      tower.castShadow = true;
      tower.receiveShadow = true;
      root.add(tower);

      for (const jy of [3.1, 6.2, 9.0]) {
        const rr = 0.4 - 0.23 * (jy / TOWER_H) + 0.012;
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.05, 40), darkSteel);
        ring.position.y = jy;
        root.add(ring);
      }
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.06), darkSteel);
      door.position.set(0, 0.95, 0.385);
      root.add(door);

      const yaw = new THREE.Group();
      yaw.position.y = HUB_Y;
      root.add(yaw);

      const nacelle = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 8, 24), nacelleMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.z = 0.15;
      nacelle.castShadow = true;
      yaw.add(nacelle);

      const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.55), darkSteel);
      cooler.position.set(0, 0.38, -0.2);
      cooler.castShadow = true;
      yaw.add(cooler);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 8), darkSteel);
      mast.position.set(0, 0.62, -0.45);
      yaw.add(mast);
      const cups = new THREE.Group();
      cups.position.set(0, 0.86, -0.45);
      for (let i = 0; i < 3; i += 1) {
        const a = (i * Math.PI * 2) / 3;
        const cup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), accentMat);
        cup.position.set(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16);
        cups.add(cup);
      }
      yaw.add(cups);

      const beaconMat = new THREE.MeshStandardMaterial({ color: "#7a1010", emissive: "#ff2a2a", emissiveIntensity: 0.2 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), beaconMat);
      beacon.position.set(0.17, 0.42, -0.62);
      yaw.add(beacon);
      const glow = makeGlow("#ff3b30", 1.1);
      glow.position.copy(beacon.position);
      yaw.add(glow);
      nightSprites.push({ sprite: glow, base: 0.9, blink: true });

      const rotor = new THREE.Group();
      rotor.position.set(0, 0, 1.14);
      yaw.add(rotor);
      const spinner = new THREE.Mesh(new THREE.SphereGeometry(0.4, 36, 24), towerMat);
      spinner.scale.set(1, 1, 1.55);
      spinner.position.z = 0.22;
      spinner.castShadow = true;
      rotor.add(spinner);
      const hubRing = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.18, 32), accentMat);
      hubRing.rotation.x = Math.PI / 2;
      hubRing.position.z = -0.08;
      rotor.add(hubRing);
      for (let i = 0; i < 3; i += 1) {
        const pivot = new THREE.Group();
        pivot.rotation.z = (i * Math.PI * 2) / 3;
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.x = 0.06;
        blade.castShadow = true;
        pivot.add(blade);
        rotor.add(pivot);
      }

      scene.add(root);
      tag(root, def.id);
      footprints.addCircle(def.x, def.z, 4.2 * def.scale + 0.6);
      return { def, yaw, rotor, cups, beaconMat, omega: 0, yawNow: 0.22, base: new THREE.Vector3(def.x, y0, def.z) };
    });

    /* ── solar field (single-axis trackers) ── */
    const trackers: { pivot: THREE.Group; angle: number }[] = [];
    {
      const group = new THREE.Group();
      const y0 = terrainHeight(SOLAR.cx, SOLAR.cz);
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(SOLAR_FIELD.w, 0.7, SOLAR_FIELD.d),
        new THREE.MeshStandardMaterial({ color: "#b8bda0", roughness: 1 }),
      );
      slab.position.set(SOLAR.cx, y0 - 0.32, SOLAR.cz);
      slab.receiveShadow = true;
      group.add(slab);

      const panelTex = makePanelTexture(aniso);
      const topMat = new THREE.MeshPhysicalMaterial({
        map: panelTex, roughness: 0.2, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3,
      });
      const frameMat = new THREE.MeshStandardMaterial({ color: "#aeb6bb", metalness: 0.75, roughness: 0.35 });
      const panelMats = [frameMat, frameMat, topMat, darkSteel, frameMat, frameMat];
      const panelGeo = new THREE.BoxGeometry(SOLAR.tableW, 0.07, SOLAR.tableLen);
      const tubeGeo = new THREE.CylinderGeometry(0.05, 0.05, SOLAR.tableLen + 0.1, 12);
      tubeGeo.rotateX(Math.PI / 2);
      const postGeo = new THREE.CylinderGeometry(0.06, 0.07, SOLAR.pivotY + 0.3, 10);

      for (let c = 0; c < SOLAR.cols; c += 1) {
        const x = SOLAR.cx + (c - (SOLAR.cols - 1) / 2) * SOLAR.pitchX;
        for (let r = 0; r < SOLAR.tablesPerCol; r += 1) {
          const z = SOLAR.cz + (r - (SOLAR.tablesPerCol - 1) / 2) * (SOLAR.tableLen + SOLAR.tableGap);
          const gy = terrainHeight(x, z);
          const pivot = new THREE.Group();
          pivot.position.set(x, gy + SOLAR.pivotY, z);
          const panel = new THREE.Mesh(panelGeo, panelMats);
          panel.castShadow = true;
          panel.receiveShadow = true;
          pivot.add(panel);
          const tube = new THREE.Mesh(tubeGeo, steel);
          tube.position.y = -0.07;
          pivot.add(tube);
          group.add(pivot);
          trackers.push({ pivot, angle: 0 });
          for (const dz of [-SOLAR.tableLen * 0.32, SOLAR.tableLen * 0.32]) {
            const post = new THREE.Mesh(postGeo, steel);
            post.position.set(x, gy + (SOLAR.pivotY - 0.1) / 2 - 0.0, z + dz);
            post.scale.y = (SOLAR.pivotY - 0.1) / (SOLAR.pivotY + 0.3);
            post.castShadow = true;
            group.add(post);
          }
        }
      }
      scene.add(group);
      tag(group, "solar");
      footprints.addBox(SOLAR.cx, SOLAR.cz, SOLAR_FIELD.w, SOLAR_FIELD.d, 1.4);
    }

    /* ── substation ── */
    {
      const g = new THREE.Group();
      const y0 = terrainHeight(SUBSTATION.x, SUBSTATION.z);
      g.position.set(SUBSTATION.x, y0, SUBSTATION.z);
      const top = 0.16;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(SUBSTATION.w, 0.6, SUBSTATION.d),
        new THREE.MeshStandardMaterial({ color: "#aeaca0", roughness: 1 }),
      );
      slab.position.y = top - 0.3;
      slab.receiveShadow = true;
      g.add(slab);

      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = shadow;
        m.receiveShadow = true;
        g.add(m);
        return m;
      };

      // gantry on the west edge
      for (const gz of [-1.6, 1.6]) mk(new THREE.BoxGeometry(0.18, 3.5, 0.18), steel, -2.9, top + 1.75, gz);
      mk(new THREE.BoxGeometry(0.14, 0.14, 3.8), steel, -2.9, top + 3.45, 0);
      for (const gz of [-1.1, 0, 1.1]) mk(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), porcelain, -2.9, top + 3.2, gz);

      // transformers
      const trafoMat = new THREE.MeshStandardMaterial({ color: "#6f8a7a", roughness: 0.55, metalness: 0.3 });
      const radMat = new THREE.MeshStandardMaterial({ color: "#7b9788", roughness: 0.6, metalness: 0.25 });
      for (const tz of [-1.5, 1.5]) {
        mk(new THREE.BoxGeometry(1.6, 1.3, 1.3), trafoMat, -0.4, top + 0.65, tz);
        mk(new THREE.BoxGeometry(1.7, 0.1, 1.4), darkSteel, -0.4, top + 1.35, tz);
        for (let i = 0; i < 5; i += 1) mk(new THREE.BoxGeometry(0.07, 0.95, 0.18), radMat, 0.5, top + 0.62, tz - 0.5 + i * 0.25);
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 20), radMat);
        tank.rotation.z = Math.PI / 2;
        tank.position.set(-0.4, top + 1.7, tz);
        tank.castShadow = true;
        g.add(tank);
        for (const bz of [-0.38, 0, 0.38]) mk(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 12), porcelain, -0.9, top + 1.7, tz + bz);
      }

      // control building
      const wallMat = new THREE.MeshStandardMaterial({ color: "#e9e5da", roughness: 0.8 });
      mk(new THREE.BoxGeometry(1.9, 1.6, 2.4), wallMat, 2.4, top + 0.8, 0);
      mk(new THREE.BoxGeometry(2.1, 0.1, 2.6), darkSteel, 2.4, top + 1.65, 0);
      mk(new THREE.BoxGeometry(0.05, 0.9, 0.5), darkSteel, 1.44, top + 0.45, 0.8, false);
      for (const wz of [-0.6, 0.0]) {
        const wm = new THREE.MeshStandardMaterial({ color: "#2b3a45", emissive: "#ffd48a", emissiveIntensity: 0, roughness: 0.2 });
        windowMats.push(wm);
        mk(new THREE.BoxGeometry(0.04, 0.4, 0.5), wm, 1.44, top + 1.05, wz - 0.1, false);
      }

      // lamp posts
      for (const [lx, lz] of [[3.15, -2.65], [-3.2, 2.6]] as [number, number][]) {
        mk(new THREE.CylinderGeometry(0.04, 0.05, 2.8, 8), darkSteel, lx, top + 1.4, lz);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffe2a8", toneMapped: false }));
        bulb.position.set(lx, top + 2.85, lz);
        g.add(bulb);
        const glow = makeGlow("#ffcf80", 1.8);
        glow.position.copy(bulb.position);
        g.add(glow);
        nightSprites.push({ sprite: glow, base: 0.85, blink: false });
        const pl = new THREE.PointLight("#ffd9a0", 0, 14, 2);
        pl.position.copy(bulb.position);
        g.add(pl);
        lampLights.push(pl);
      }

      // perimeter fence (south gate left open for the access road)
      const fx = SUBSTATION.w / 2 - 0.1;
      const fz = SUBSTATION.d / 2 - 0.1;
      const postG = new THREE.BoxGeometry(0.06, 0.9, 0.06);
      const railM = new THREE.MeshStandardMaterial({ color: "#7d857f", metalness: 0.5, roughness: 0.5 });
      const addRail = (x1: number, z1: number, x2: number, z2: number) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        for (const ry of [0.3, 0.8]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, 0.035), railM);
          rail.position.set((x1 + x2) / 2, top + ry, (z1 + z2) / 2);
          rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
          g.add(rail);
        }
        const count = Math.max(1, Math.round(len / 1.2));
        for (let i = 0; i <= count; i += 1) {
          const t = i / count;
          const p = new THREE.Mesh(postG, railM);
          p.position.set(lerp(x1, x2, t), top + 0.45, lerp(z1, z2, t));
          g.add(p);
        }
      };
      addRail(-fx, -fz, fx, -fz);
      addRail(-fx, -fz, -fx, fz);
      addRail(fx, -fz, fx, fz);
      addRail(-fx, fz, -1.2, fz);
      addRail(1.2, fz, fx, fz);

      scene.add(g);
      tag(g, "substation");
      footprints.addBox(SUBSTATION.x, SUBSTATION.z, SUBSTATION.w, SUBSTATION.d, 1.2);
    }

    /* ── transmission line (steel monopoles + catenary wires) ── */
    const gantryAttach = (dz: number) =>
      new THREE.Vector3(SUBSTATION.x - 2.9, terrainHeight(SUBSTATION.x, SUBSTATION.z) + 3.11, SUBSTATION.z + dz);
    const gridPath: THREE.Vector3[] = [];
    {
      const g = new THREE.Group();
      const wireMat = new THREE.MeshStandardMaterial({ color: "#2f3532", metalness: 0.8, roughness: 0.4 });
      const offsets = [-1.1, 0, 1.1];
      const poleOffsets = [-1.45, 0, 1.45];
      const poleH = 7;
      const attach: THREE.Vector3[][] = [offsets.map(gantryAttach)];
      PYLONS.forEach(([px, pz]) => {
        const y0 = terrainHeight(px, pz);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.26, poleH, 14), steel);
        pole.position.set(px, y0 + poleH / 2, pz);
        pole.castShadow = true;
        g.add(pole);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.5, 20), concrete);
        foot.position.set(px, y0 + 0.05, pz);
        g.add(foot);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.7), steel);
        arm.position.set(px, y0 + poleH - 0.3, pz);
        arm.castShadow = true;
        g.add(arm);
        const row: THREE.Vector3[] = [];
        poleOffsets.forEach((dz) => {
          const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 10), porcelain);
          ins.position.set(px, y0 + poleH - 0.55, pz + dz);
          g.add(ins);
          row.push(new THREE.Vector3(px, y0 + poleH - 0.8, pz + dz));
        });
        attach.push(row);
        footprints.addCircle(px, pz, 1.6);
      });
      for (let s = 0; s < attach.length - 1; s += 1) {
        for (let w = 0; w < 3; w += 1) {
          const a = attach[s][w];
          const b = attach[s + 1][w];
          const pts = catenary(a, b, a.distanceTo(b) * 0.012 + 0.12, 18);
          const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.028, 5, false), wireMat);
          tube.castShadow = true;
          g.add(tube);
          if (w === 1) gridPath.push(...(s === 0 ? pts : pts.slice(1)));
        }
      }
      scene.add(g);
      tag(g, "substation");
      footprints.addLine([new THREE.Vector2(SUBSTATION.x - 4, SUBSTATION.z), new THREE.Vector2(PYLONS[2][0], PYLONS[2][1])], 3.2);
    }

    /* ── energy-flow cables & particles ── */
    interface Flow {
      curve: THREE.CatmullRomCurve3;
      points: THREE.Points;
      attr: THREE.BufferAttribute;
      cable: THREE.Mesh | null;
      maxCount: number;
    }
    const flowTmp = new THREE.Vector3();
    const groundCurve = (xz: [number, number][], lift: number) => {
      const base = new THREE.CatmullRomCurve3(xz.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
      const pts = base.getSpacedPoints(Math.max(12, Math.ceil(base.getLength() / 0.6))).map((p) => {
        p.y = terrainHeight(p.x, p.z) + lift;
        return p;
      });
      return new THREE.CatmullRomCurve3(pts, false, "centripetal");
    };
    const makeFlow = (curve: THREE.CatmullRomCurve3, color: string, maxCount: number, cableCurve: THREE.CatmullRomCurve3 | null): Flow => {
      // Keep animation resilient if a hand-built transmission route contains
      // duplicate or invalid points (CatmullRomCurve3 otherwise throws per frame).
      const safeCurve = (source: THREE.CatmullRomCurve3) => {
        const points = source.points.filter((p): p is THREE.Vector3 =>
          p instanceof THREE.Vector3 && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
        );
        const unique: THREE.Vector3[] = [];
        for (const point of points) {
          const previous = unique[unique.length - 1];
          if (!previous || point.distanceToSquared(previous) > 1e-8) unique.push(point);
        }
        if (unique.length < 2) {
          const first = unique[0] ?? new THREE.Vector3();
          unique.push(first.clone().add(new THREE.Vector3(1, 0, 0)));
        }
        return new THREE.CatmullRomCurve3(unique, false, "centripetal");
      };
      curve = safeCurve(curve);
      const safeCableCurve = cableCurve ? safeCurve(cableCurve) : null;
      const arr = new Float32Array(maxCount * 3);
      const geo = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(arr, 3);
      geo.setAttribute("position", attr);
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ map: glowTex, color, size: 0.75, sizeAttenuation: true, transparent: true, depthWrite: false, toneMapped: false }),
      );
      pts.frustumCulled = false;
      pts.renderOrder = 4;
      scene.add(pts);
      let cableMesh: THREE.Mesh | null = null;
      if (safeCableCurve) {
        cableMesh = new THREE.Mesh(
          new THREE.TubeGeometry(safeCableCurve, Math.ceil(safeCableCurve.getLength() * 2), 0.045, 6, false),
          new THREE.MeshStandardMaterial({ color: "#44514c", roughness: 0.8, transparent: true, opacity: 0.55 }),
        );
        scene.add(cableMesh);
      }
      return { curve, points: pts, attr, cable: cableMesh, maxCount };
    };

    const groundFlow = (xz: [number, number][], color: string, maxCount: number) =>
      makeFlow(groundCurve(xz, 0.36), color, maxCount, groundCurve(xz, 0.1));
    const windFlows = [
      groundFlow([[-17.7, -12.5], [-16.6, -6.5], [-12.8, -2.8], [-10.2, -0.5]], "#1fb5b9", 22),
      groundFlow([[-2.3, -15.5], [-3.4, -9], [-5.8, -4], [-6.9, -0.5]], "#1fb5b9", 22),
      groundFlow([[11.1, -13.6], [11.0, -9.5], [4, -7.5], [-3, -4.5], [-5.4, -0.5]], "#1fb5b9", 26),
    ];
    const solarFlow = groundFlow([[3.8, 3], [0, 3], [-4.2, 3]], "#f0a81a", 22);
    const gridFlow = makeFlow(new THREE.CatmullRomCurve3(gridPath, false, "centripetal"), "#8f7cf0", 34, null);
    const allFlows = [...windFlows, solarFlow, gridFlow];
    const updateFlow = (f: Flow, share: number, speed: number, t: number) => {
      const n = Math.round(f.maxCount * clamp(share, 0, 1));
      f.points.geometry.setDrawRange(0, n);
      const path = f.curve.points;
      if (path.length < 2) return;
      for (let i = 0; i < n; i += 1) {
        const progress = ((i / Math.max(n, 1)) + t * speed) % 1;
        const scaled = progress * (path.length - 1);
        const segment = Math.min(path.length - 2, Math.floor(scaled));
        const from = path[segment];
        const to = path[segment + 1];
        if (!from || !to) continue;
        flowTmp.copy(from).lerp(to, scaled - segment);
        f.attr.setXYZ(i, flowTmp.x, flowTmp.y, flowTmp.z);
      }
      f.attr.needsUpdate = true;
    };

    /* ── vegetation (instanced, collision-aware) ── */
    {
      const rnd = mulberry32(11);
      type Tree = { x: number; z: number; s: number; round: boolean; rot: number };
      const trees: Tree[] = [];
      for (let attempt = 0; attempt < 900 && trees.length < 110; attempt += 1) {
        const r = 21 + rnd() * 34;
        const th = rnd() * Math.PI * 2;
        const x = Math.cos(th) * r;
        const z = Math.sin(th) * r;
        if (!footprints.isFree(x, z, 1.8)) continue;
        if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
        trees.push({ x, z, s: 0.8 + rnd() * 0.7, round: rnd() > 0.62, rot: rnd() * Math.PI * 2 });
      }
      const pines = trees.filter((t) => !t.round);
      const rounds = trees.filter((t) => t.round);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      const greens = ["#5f755d", "#6d8663", "#587052", "#74876a"].map((c) => new THREE.Color(c));
      const lights = ["#86a15c", "#7c9a58", "#98a85f"].map((c) => new THREE.Color(c));

      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1.3, 7), new THREE.MeshStandardMaterial({ color: "#75634b", roughness: 1 }), trees.length);
      const pineA = new THREE.InstancedMesh(new THREE.ConeGeometry(0.95, 2.4, 9), new THREE.MeshStandardMaterial({ roughness: 1 }), pines.length);
      const pineB = new THREE.InstancedMesh(new THREE.ConeGeometry(0.68, 1.9, 9), new THREE.MeshStandardMaterial({ roughness: 1 }), pines.length);
      const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.05, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), rounds.length);

      trees.forEach((t, i) => {
        const y = terrainHeight(t.x, t.z);
        dummy.position.set(t.x, y + 0.6 * t.s, t.z);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
      });
      pines.forEach((t, i) => {
        const y = terrainHeight(t.x, t.z);
        col.copy(greens[i % greens.length]);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.setScalar(t.s);
        dummy.position.set(t.x, y + 1.7 * t.s, t.z);
        dummy.updateMatrix();
        pineA.setMatrixAt(i, dummy.matrix);
        pineA.setColorAt(i, col);
        dummy.position.set(t.x, y + 2.95 * t.s, t.z);
        dummy.updateMatrix();
        pineB.setMatrixAt(i, dummy.matrix);
        pineB.setColorAt(i, col);
      });
      rounds.forEach((t, i) => {
        const y = terrainHeight(t.x, t.z);
        col.copy(lights[i % lights.length]);
        dummy.rotation.set(0, t.rot, 0);
        dummy.scale.set(t.s * 1.1, t.s * 0.95, t.s * 1.1);
        dummy.position.set(t.x, y + 2.0 * t.s, t.z);
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
        crowns.setColorAt(i, col);
      });
      [trunks, pineA, pineB, crowns].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        scene.add(m);
      });

      // grass tufts
      const tuftGeo = new THREE.ConeGeometry(0.07, 0.5, 5);
      tuftGeo.translate(0, 0.25, 0);
      const tufts: { x: number; z: number; s: number; rot: number; lean: number }[] = [];
      for (let attempt = 0; attempt < 5000 && tufts.length < 1800; attempt += 1) {
        const r = Math.sqrt(rnd()) * 40;
        const th = rnd() * Math.PI * 2;
        const x = Math.cos(th) * r;
        const z = Math.sin(th) * r;
        if (!footprints.isFree(x, z, 0.5)) continue;
        tufts.push({ x, z, s: 0.6 + rnd() * 1.1, rot: rnd() * 6.28, lean: (rnd() - 0.5) * 0.4 });
      }
      const tuftMesh = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), tufts.length);
      const tuftCols = ["#8aa36a", "#7a965e", "#a1b274", "#6e8a56"].map((c) => new THREE.Color(c));
      tufts.forEach((t, i) => {
        dummy.position.set(t.x, terrainHeight(t.x, t.z) - 0.02, t.z);
        dummy.rotation.set(t.lean, t.rot, t.lean * 0.6);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();
        tuftMesh.setMatrixAt(i, dummy.matrix);
        tuftMesh.setColorAt(i, tuftCols[i % tuftCols.length]);
      });
      tuftMesh.instanceMatrix.needsUpdate = true;
      if (tuftMesh.instanceColor) tuftMesh.instanceColor.needsUpdate = true;
      scene.add(tuftMesh);
    }

    /* ── clouds (fade when they would block the view of the model) ── */
    interface CloudRig {
      mesh: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
      radius: number;
      baseScale: THREE.Vector3;
    }
    const clouds: CloudRig[] = [];
    {
      const rnd = mulberry32(77);
      for (let i = 0; i < 10; i += 1) {
        const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.9, emissive: "#ffffff", emissiveIntensity: 0.1 });
        const mesh = new THREE.Mesh(buildCloudGeometry(100 + i), mat);
        const sx = 7 + rnd() * 6;
        const baseScale = new THREE.Vector3(sx, 2.4 + rnd() * 1.2, sx * (0.6 + rnd() * 0.3));
        mesh.scale.copy(baseScale);
        mesh.position.set(-100 + rnd() * 200, 32 + rnd() * 12, -95 + rnd() * 135);
        mesh.visible = false;
        scene.add(mesh);
        clouds.push({ mesh, mat, radius: sx, baseScale });
      }
    }

    /* ── hover / selection rings ── */
    const ringMats: Record<AssetKey, THREE.MeshBasicMaterial> = {} as Record<AssetKey, THREE.MeshBasicMaterial>;
    const ringMeshes: Record<AssetKey, THREE.Mesh> = {} as Record<AssetKey, THREE.Mesh>;
    {
      const mkRing = (key: AssetKey, geo: THREE.BufferGeometry, x: number, z: number, color: string) => {
        const mat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
          polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, terrainHeight(x, z) + 0.09, z);
        m.renderOrder = 3;
        m.visible = false;
        scene.add(m);
        ringMats[key] = mat;
        ringMeshes[key] = m;
      };
      const circleGeo = new THREE.RingGeometry(3.1, 3.38, 72);
      circleGeo.rotateX(-Math.PI / 2);
      TURBINES.forEach((t) => mkRing(t.id, circleGeo, t.x, t.z, "#1fb5b9"));
      mkRing("solar", rectOutline(SOLAR_FIELD.w + 2.4, SOLAR_FIELD.d + 2.4, 0.4), SOLAR.cx, SOLAR.cz, "#f0a81a");
      mkRing("substation", rectOutline(SUBSTATION.w + 1.6, SUBSTATION.d + 1.6, 0.34), SUBSTATION.x, SUBSTATION.z, "#8f7cf0");
    }

    /* ── controls & camera tween ── */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...SHOTS.overview.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 8;
    controls.maxDistance = 56;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.screenSpacePanning = false;
    controls.update();

    const tween = {
      active: false,
      t: 0,
      duration: 1.3,
      fromPos: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
    };
    const startTween = (pos: V3, target: V3) => {
      tween.fromPos.copy(camera.position);
      tween.fromTarget.copy(controls.target);
      tween.toPos.set(...pos);
      tween.toTarget.set(...target);
      tween.t = 0;
      tween.active = true;
    };
    controls.addEventListener("start", () => {
      tween.active = false;
    });

    apiRef.current = {
      goTo: (preset) => startTween(SHOTS[preset].pos, SHOTS[preset].target),
      focus: (asset) => {
        if (asset === "solar") return startTween(SHOTS.solar.pos, SHOTS.solar.target);
        if (asset === "substation") return startTween(SHOTS.grid.pos, SHOTS.grid.target);
        const def = TURBINES.find((t) => t.id === asset);
        if (!def) return undefined;
        return startTween([def.x + 11, 8, def.z + 17], [def.x, 6.4 * def.scale, def.z]);
      },
    };

    /* ── picking ── */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (cx: number, cy: number): AssetKey | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return hit ? (hit.object.userData.asset as AssetKey) : null;
    };
    let hovered: AssetKey | null = null;
    let pendingMove: { x: number; y: number } | null = null;
    let downAt: { x: number; y: number } | null = null;
    const el = renderer.domElement;
    const onMove = (e: PointerEvent) => {
      if (e.buttons === 0) pendingMove = { x: e.clientX, y: e.clientY };
    };
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5) {
        onSelectRef.current(pick(e.clientX, e.clientY));
      }
      downAt = null;
    };
    const onLeave = () => {
      pendingMove = null;
      hovered = null;
      el.style.cursor = "grab";
    };
    const onContextLost = (e: Event) => e.preventDefault();
    el.style.cursor = "grab";
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("webglcontextlost", onContextLost);

    /* ── sizing & visibility ── */
    mount.appendChild(el);
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();
    let inView = true;
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
    });
    io.observe(mount);

    /* ── time-of-day application ── */
    const sunDir = new THREE.Vector3();
    let nightF = 0;
    let appliedHour = Number.NaN;
    let appliedCloud = Number.NaN;
    let envDirty = true;
    let lastEnv = 0;
    const warmLow = new THREE.Color("#ff8a45");
    const warmHigh = new THREE.Color("#fff2d8");
    const applyTimeOfDay = (hour: number, cloud: number) => {
      sunDirection(hour, sunDir);
      const pal = skyPalette(sunDir.y, cloud);
      paintSky(pal.top, pal.horizon);
      (scene.background as THREE.Color).copy(pal.horizon);
      (scene.fog as THREE.Fog).color.copy(pal.horizon);
      nightF = pal.nightF;

      sun.color.copy(warmLow).lerp(warmHigh, smoothstep(0.02, 0.42, sunDir.y));
      sun.position.copy(sunDir).multiplyScalar(80);
      sun.intensity = 3.6 * pal.dayF * (1 - 0.62 * cloud);
      moonLight.position.set(-sunDir.x * 60, Math.max(-sunDir.y, 0.35) * 60, 18);
      moonLight.intensity = 0.55 * pal.nightF;
      hemi.color.copy(pal.top).lerp(PAL.haze, 0.3);
      hemi.intensity = lerp(0.1, 0.5, pal.dayF);
      renderer.toneMappingExposure = lerp(0.95, 1.05, pal.dayF);
      (scene as unknown as { environmentIntensity?: number }).environmentIntensity = lerp(0.35, 1, pal.dayF);

      sunGlow.position.copy(sunDir).multiplyScalar(250);
      sunCore.position.copy(sunDir).multiplyScalar(250);
      const sunVis = smoothstep(-0.16, 0.02, sunDir.y);
      (sunGlow.material as THREE.SpriteMaterial).opacity = sunVis * (1 - cloud * 0.55);
      (sunCore.material as THREE.SpriteMaterial).opacity = sunVis * (1 - cloud * 0.85);
      (sunGlow.material as THREE.SpriteMaterial).color.copy(sun.color);
      moon.position.set(-sunDir.x * 240, Math.max(-sunDir.y, 0.3) * 240, 70);
      (moon.material as THREE.SpriteMaterial).opacity = pal.nightF * (1 - cloud * 0.8);
      (stars.material as THREE.PointsMaterial).opacity = pal.nightF * (1 - cloud * 0.8);

      envSun.position.copy(sunDir).multiplyScalar(44);
      const k = 7 * pal.dayF * (1 - 0.7 * cloud);
      envSunMat.color.setRGB(sun.color.r * k, sun.color.g * k, sun.color.b * k);
      envGroundMat.color.set("#6f7f58").multiplyScalar(0.12 + 0.88 * pal.dayF);

      clouds.forEach((c) => {
        c.mat.color.set("#ffffff").lerp(new THREE.Color("#25304a"), pal.nightF * 0.85).lerp(new THREE.Color("#ffd2b0"), (1 - pal.dayF) * (1 - pal.nightF) * 0.5);
        c.mat.emissiveIntensity = 0.12 * pal.dayF;
      });
      envDirty = true;
    };

    /* ── main loop ── */
    let raf = 0;
    let last = performance.now();
    let simTime = 0;
    const camTarget = new THREE.Vector3();
    const line = new THREE.Line3();
    const closest = new THREE.Vector3();

    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const live = paramsRef.current;
      if (!inView || document.hidden || live.viewMode !== "3d") {
        last = now;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const moving = live.isPlaying && !live.reducedMotion;
      if (moving) simTime += dt;

      if (live.hour !== appliedHour || live.cloud !== appliedCloud) {
        appliedHour = live.hour;
        appliedCloud = live.cloud;
        applyTimeOfDay(live.hour, live.cloud);
      }
      if (envDirty && now - lastEnv > 180) {
        rebuildEnv();
        envDirty = false;
        lastEnv = now;
      }

      // camera tween
      if (tween.active) {
        tween.t = Math.min(1, tween.t + dt / tween.duration);
        const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
        camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
        if (tween.t >= 1) tween.active = false;
      }

      // turbines
      rigs.forEach((rig, i) => {
        const v = hubWind(live.windSpeed, i);
        const targetOmega = rotorRpm(v) * ((Math.PI * 2) / 60) * 1.3;
        rig.omega = lerp(rig.omega, targetOmega, 1 - Math.exp(-dt * 0.9));
        if (moving) {
          rig.rotor.rotation.z -= rig.omega * dt;
          rig.cups.rotation.y += Math.min(v, 25) * 1.1 * dt;
        }
        const yawTarget = 0.22 + 0.2 * Math.sin(simTime * 0.09 + rig.def.phase);
        rig.yawNow = lerp(rig.yawNow, yawTarget, 1 - Math.exp(-dt * 0.6));
        rig.yaw.rotation.y = rig.yawNow;
        rig.beaconMat.emissiveIntensity = Math.sin(now * 0.004 + i) > 0.55 ? 3 : 0.25;
      });

      // trackers follow the sun, stow flat at night
      const trackTarget = sunDir.y > 0.02 ? clamp(Math.atan2(sunDir.x, sunDir.y), -1.05, 1.05) : 0;
      trackers.forEach((t) => {
        t.angle = lerp(t.angle, trackTarget, 1 - Math.exp(-dt * 1.6));
        t.pivot.rotation.z = -t.angle;
      });

      // night lighting
      windowMats.forEach((m) => {
        m.emissiveIntensity = nightF * 1.8;
      });
      lampLights.forEach((l) => {
        l.intensity = nightF * 14;
      });
      nightSprites.forEach((s) => {
        const mat = s.sprite.material as THREE.SpriteMaterial;
        const blink = s.blink ? (Math.sin(now * 0.004) > 0.55 ? 1 : 0.35) : 1;
        mat.opacity = clamp(0.25 + nightF * 0.75, 0, 1) * s.base * blink;
      });

      // clouds drift with the wind and fade out of the line of sight
      camTarget.copy(controls.target);
      line.set(camera.position, camTarget);
      const cover = live.cloud * clouds.length;
      clouds.forEach((c, i) => {
        const amount = clamp(cover - i, 0, 1);
        c.mesh.visible = amount > 0.02;
        if (!c.mesh.visible) return;
        if (moving) {
          c.mesh.position.x += (0.6 + live.windSpeed * 0.12) * dt;
          if (c.mesh.position.x > 115) c.mesh.position.x = -115;
        }
        const s = Math.sqrt(amount);
        c.mesh.scale.copy(c.baseScale).multiplyScalar(0.55 + 0.45 * s);
        line.closestPointToPoint(c.mesh.position, true, closest);
        const d = closest.distanceTo(c.mesh.position);
        const fade = smoothstep(c.radius * 0.5, c.radius * 1.4 + 6, d);
        c.mat.opacity = 0.92 * fade * s;
        c.mat.depthWrite = c.mat.opacity > 0.85;
      });

      // energy flows
      const wind = TURBINES.map((_, i) => windPowerKw(hubWind(live.windSpeed, i)));
      const solar = SOLAR_PEAK_KW * (Math.max(0, sunDir.y) ** 1.15) * (1 - 0.78 * live.cloud) * 0.92;
      const total = wind.reduce((a, b) => a + b, 0) + solar;
      allFlows.forEach((f) => {
        f.points.visible = live.showFlow;
        if (f.cable) f.cable.visible = live.showFlow;
      });
      if (live.showFlow) {
        const ft = simTime;
        windFlows.forEach((f, i) => updateFlow(f, wind[i] / RATED_KW, 0.07 + (wind[i] / RATED_KW) * 0.1, ft));
        updateFlow(solarFlow, solar / SOLAR_PEAK_KW, 0.07 + (solar / SOLAR_PEAK_KW) * 0.1, ft);
        updateFlow(gridFlow, total / TOTAL_PEAK_KW, 0.05 + (total / TOTAL_PEAK_KW) * 0.08, ft);
      }

      // hover
      if (pendingMove && !tween.active) {
        hovered = pick(pendingMove.x, pendingMove.y);
        el.style.cursor = hovered ? "pointer" : "grab";
        pendingMove = null;
      }
      (Object.keys(ringMats) as AssetKey[]).forEach((key) => {
        const mat = ringMats[key];
        const target = live.selected === key ? 0.6 + 0.3 * Math.sin(now * 0.004) : hovered === key ? 0.5 : 0;
        mat.opacity += (target - mat.opacity) * 0.2;
        ringMeshes[key].visible = mat.opacity > 0.015;
      });

      controls.update();

      // keep the camera over the site and above the ground
      const tx = clamp(controls.target.x, -32, 32);
      const tz = clamp(controls.target.z, -32, 32);
      const ty = clamp(controls.target.y, 0, 16);
      if (tx !== controls.target.x || tz !== controls.target.z || ty !== controls.target.y) {
        camera.position.add(new THREE.Vector3(tx - controls.target.x, ty - controls.target.y, tz - controls.target.z));
        controls.target.set(tx, ty, tz);
      }
      const minY = terrainHeight(camera.position.x, camera.position.z) + 1.4;
      if (camera.position.y < minY) camera.position.y = minY;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      apiRef.current = null;
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("webglcontextlost", onContextLost);
      controls.dispose();
      disposeTree(scene);
      disposeTree(envScene);
      [skyTex, glowTex, discTex].forEach((t) => t.dispose());
      envRT?.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.remove();
    };
  }, []);

  useEffect(() => {
    if (selected) apiRef.current?.focus(selected);
  }, [selected]);

  /* ───────────── derived numbers for the side panel ───────────── */
  const metrics = useMemo(() => computeMetrics(windSpeed, hour, cloud), [windSpeed, hour, cloud]);
  const windShare = metrics.totalKw > 0 ? (metrics.windKw / metrics.totalKw) * 100 : 0;
  const solarShare = metrics.totalKw > 0 ? 100 - windShare : 0;
  const motionOn = isPlaying && !reducedMotion;

  const assetCard = useMemo(() => {
    if (!selected) return null;
    if (selected === "solar") {
      return {
        title: "Solar tracker array",
        color: "var(--rs-solar)",
        rows: [
          ["Output", fmtPower(metrics.solarKw)],
          ["Irradiance", `${Math.round(metrics.irradiance)} W/m²`],
          ["Tracker angle", metrics.isDay ? `${metrics.trackerDeg.toFixed(0)}°` : "Stowed flat"],
          ["Sun elevation", `${Math.max(0, metrics.sunElevationDeg).toFixed(0)}°`],
          ["Tables / peak", `${SOLAR.cols * SOLAR.tablesPerCol} · ${(SOLAR_PEAK_KW / 1000).toFixed(1)} MW`],
        ] as [string, string][],
      };
    }
    if (selected === "substation") {
      return {
        title: "Substation & grid export",
        color: "var(--rs-grid)",
        rows: [
          ["Export power", fmtPower(metrics.totalKw)],
          ["Plant load", `${((metrics.totalKw / TOTAL_PEAK_KW) * 100).toFixed(0)}% of peak`],
          ["Step-up", "33 kV → 132 kV"],
          ["CO₂ equivalent (assumed)", `${(metrics.co2Kg / 1000).toFixed(2)} t/h`],
          ["Transformers", "2 × power"],
        ] as [string, string][],
      };
    }
    const idx = TURBINES.findIndex((t) => t.id === selected);
    const def = TURBINES[idx];
    const v = hubWind(windSpeed, idx);
    return {
      title: `${def.name} wind turbine`,
      color: "var(--rs-wind)",
      rows: [
        ["Output", fmtPower(metrics.turbineKw[idx])],
        ["Wind at hub", `${v.toFixed(1)} m/s`],
        ["Rotor speed", `${rotorRpm(v).toFixed(1)} rpm`],
        ["Status", windStatus(v)],
        ["Rated / hub (≈)", `${RATED_KW / 1000} MW · ${Math.round((HUB_Y * def.scale) * 8.8)} m`],
      ] as [string, string][],
    };
  }, [selected, metrics, windSpeed]);

  const reset = () => {
    setSelected(null);
    apiRef.current?.goTo("overview");
  };
  const preset = (p: PresetKey) => {
    setSelected(null);
    apiRef.current?.goTo(p);
  };
  const toggleAsset = (a: AssetKey) => setSelected((cur) => (cur === a ? null : a));

  const assetChips: { key: AssetKey; label: string }[] = [
    ...TURBINES.map((t) => ({ key: t.id, label: t.name })),
    { key: "solar", label: "Solar array" },
    { key: "substation", label: "Substation" },
  ];

  return (
    <section className={`rs3d ${className}`} aria-label="Renewable infrastructure digital twin">
      <style>{CSS}</style>

      <header className="rs3d-head">
        <div>
          <p className="rs3d-kicker">Illustrative site model · interactive 3D</p>
          <h3 className="rs3d-title">Solar and wind generation landscape</h3>
        </div>
        <div className="rs3d-seg" role="group" aria-label="View mode">
          <button type="button" className="rs3d-btn" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>
            <Box size={15} /> Interactive 3D
          </button>
          <button type="button" className="rs3d-btn" aria-pressed={viewMode === "render"} onClick={() => setViewMode("render")}>
            <ImageIcon size={15} /> Rendered view
          </button>
        </div>
      </header>

      <div className="rs3d-body">
        <div className="rs3d-stage">
          <div className="rs3d-canvas" ref={mountRef} hidden={viewMode !== "3d"} />
          {webglFailed && viewMode === "3d" && (
            <div className="rs3d-note" role="status">3D preview is unavailable in this browser. The numbers beside it remain live.</div>
          )}
          {viewMode === "render" &&
            (imageFailed ? (
              <div className="rs3d-note" role="status">Reference render not found. Switch back to Interactive 3D.</div>
            ) : (
              <img
                className="rs3d-render"
                src={renderImageSrc}
                alt="Illustrative rendering of a renewable energy site with wind turbines, solar panels and trees"
                onError={() => setImageFailed(true)}
              />
            ))}
        </div>

        <aside className="rs3d-side" aria-label="Site readout">
          <div className="rs3d-card">
            <p className="rs3d-label">Illustrative scenario output</p>
            <div className="rs3d-big">{fmtPower(metrics.totalKw)}</div>
            <div className="rs3d-sub">{((metrics.totalKw / TOTAL_PEAK_KW) * 100).toFixed(0)}% of {(TOTAL_PEAK_KW / 1000).toFixed(1)} MW peak · {fmtHour(hour)}</div>
            <div className="rs3d-bar" aria-hidden="true">
              <i style={{ width: `${windShare}%`, background: "var(--rs-wind)" }} />
              <i style={{ width: `${solarShare}%`, background: "var(--rs-solar)" }} />
            </div>
            <div className="rs3d-split">
              <span><span className="rs3d-dot" style={{ background: "var(--rs-wind)" }} />Wind <b>{fmtPower(metrics.windKw)}</b></span>
              <span><span className="rs3d-dot" style={{ background: "var(--rs-solar)" }} />Solar <b>{fmtPower(metrics.solarKw)}</b></span>
            </div>
          </div>

          <div className="rs3d-card">
            <p className="rs3d-label">Inspect an asset</p>
            <div className="rs3d-chips">
              {assetChips.map((c) => (
                <button key={c.key} type="button" className="rs3d-chip" aria-pressed={selected === c.key} onClick={() => toggleAsset(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rs3d-card" aria-live="polite">
            {assetCard ? (
              <>
                <h4 className="rs3d-asset-title"><span className="rs3d-dot" style={{ background: assetCard.color, margin: 0 }} />{assetCard.title}</h4>
                <dl className="rs3d-rows">
                  {assetCard.rows.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <p className="rs3d-label">Site conditions</p>
                <dl className="rs3d-rows">
                  <div><dt>Wind</dt><dd>{windSpeed.toFixed(1)} m/s · {windStatus(windSpeed)}</dd></div>
                  <div><dt>Sun elevation</dt><dd>{metrics.isDay ? `${metrics.sunElevationDeg.toFixed(0)}°` : "Below horizon"}</dd></div>
                  <div><dt>Irradiance</dt><dd>{Math.round(metrics.irradiance)} W/m²</dd></div>
                  <div><dt>CO₂ equivalent (assumed)</dt><dd>{(metrics.co2Kg / 1000).toFixed(2)} t/h</dd></div>
                </dl>
              </>
            )}
          </div>
        </aside>
      </div>

      <div className="rs3d-toolbar">
        <div className="rs3d-seg" role="group" aria-label="Camera views">
          <button type="button" className="rs3d-btn" onClick={reset} title="Reset camera"><RotateCcw size={15} /> Overview</button>
          <button type="button" className="rs3d-btn" onClick={() => preset("wind")}><Wind size={15} /> Wind</button>
          <button type="button" className="rs3d-btn" onClick={() => preset("solar")}><Sun size={15} /> Solar</button>
          <button type="button" className="rs3d-btn" onClick={() => preset("grid")}><Zap size={15} /> Grid</button>
        </div>
        <div className="rs3d-seg" role="group" aria-label="Simulation">
          <button type="button" className="rs3d-btn" onClick={() => setIsPlaying((p) => !p)} aria-label={motionOn ? "Pause simulation" : "Resume simulation"}>
            {motionOn ? <Pause size={15} /> : <Play size={15} />} {motionOn ? "Pause" : "Play"}
          </button>
          <button type="button" className="rs3d-btn" aria-pressed={autoDay} onClick={() => setAutoDay((a) => !a)}>
            <Clock size={15} /> Day cycle
          </button>
          <button type="button" className="rs3d-btn" aria-pressed={showFlow} onClick={() => setShowFlow((s) => !s)}>
            <Activity size={15} /> Energy flow
          </button>
        </div>
      </div>

      <div className="rs3d-controls">
        <label className="rs3d-slider">
          <span className="rs3d-slider-head"><Wind size={15} /><b>Wind speed</b><output>{windSpeed.toFixed(1)} m/s</output></span>
          <input type="range" min={0} max={28} step={0.5} value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} />
          <small className="rs3d-hint">Below 3 m/s: idle, no generation · 12–25 m/s: rated rotor speed · 25+ m/s: storm brake</small>
        </label>
        <label className="rs3d-slider">
          <span className="rs3d-slider-head"><Clock size={15} /><b>Time of day</b><output>{fmtHour(hour)}</output></span>
          <input type="range" min={0} max={23.9} step={0.1} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
        </label>
        <label className="rs3d-slider">
          <span className="rs3d-slider-head"><Cloud size={15} /><b>Cloud cover</b><output>{Math.round(cloud * 100)}%</output></span>
          <input type="range" min={0} max={1} step={0.01} value={cloud} onChange={(e) => setCloud(Number(e.target.value))} />
        </label>
      </div>

      <footer className="rs3d-foot">
        <span>{viewMode === "3d" ? "Drag to orbit · scroll to zoom · right-drag to pan · click an asset to inspect" : "Rendered visual · switch to Interactive 3D to orbit the model"}</span>
        <span className="rs3d-sub">Illustrative engineering scenario · not observed CAISO output or a forecast</span>
        <span className="rs3d-legend">
          <span><span className="rs3d-dot" style={{ background: "var(--rs-wind)" }} />{TURBINES.length} wind turbines</span>
          <span><span className="rs3d-dot" style={{ background: "var(--rs-solar)" }} />{SOLAR.cols * SOLAR.tablesPerCol} tracking PV tables</span>
          <span><span className="rs3d-dot" style={{ background: "var(--rs-grid)" }} />132 kV export</span>
          <span>2019–2021 data</span>
        </span>
      </footer>
      {reducedMotion && <span className="rs3d-sub">Reduced motion is on</span>}
    </section>
  );
};

export default RenewableScene3D;
