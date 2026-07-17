"use client";

import { curveMonotoneX, curveNatural } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { bisector } from "d3-array";
import {
  Children, createContext, isValidElement, useCallback, useContext,
  useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { createPortal } from "react-dom";

export const chartCssVars = {
  background: "var(--chart-background)",
  linePrimary: "var(--chart-line-primary)",
  lineSecondary: "var(--chart-line-secondary)",
  crosshair: "var(--chart-crosshair)",
  grid: "var(--chart-grid)",
  label: "var(--chart-label)",
};

const ChartContext = createContext(null);
function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used within AreaChart");
  return ctx;
}

// ── Interaction hook ────────────────────────────────────────────────────────
//
// ⚡ REWRITE — versi lama bikin lag pas di-drag karena 2 hal:
//   1. `setTooltipData` dipanggil di SETIAP gerakan mouse (per piksel), padahal
//      isinya cuma berubah kalau titik data yang ke-hover beda. Sekarang kita
//      simpan index terakhir di ref, dan cuma `setState` (yang men-trigger
//      render) kalau index-nya BENERAN ganti.
//   2. Posisi elemen (garis SVG) di-baca ulang tiap gerakan mouse pakai
//      `localPoint` (visx) yang menghitung CTM SVG — sekarang posisi kotak
//      chart di-cache sekali (saat mouse masuk / mouse down) dan dipakai
//      ulang, jadi tidak ada perhitungan layout berulang per piksel.
function useChartInteraction({ xScale, yScale, secondaryYScale, data, lines, margin, xAccessor, bisectDate, canInteract, containerRef }) {
  const [tooltipData, setTooltipData] = useState(null);
  const [selection, setSelection] = useState(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const lastIndexRef = useRef(-1);
  const rectRef = useRef(null);

  const findPoint = useCallback((pixelX) => {
    const x0 = xScale.invert(pixelX);
    const idx = bisectDate(data, x0, 1);
    const d0 = data[idx - 1], d1 = data[idx];
    if (!d0) return null;
    let d = d0, fi = idx - 1;
    if (d1 && x0.getTime() - xAccessor(d0).getTime() > xAccessor(d1).getTime() - x0.getTime()) { d = d1; fi = idx; }
    return { point: d, index: fi };
  }, [xScale, data, xAccessor, bisectDate]);

  const buildTooltip = useCallback((fi, d) => {
    const yPositions = {};
    for (const line of lines) {
      const v = d[line.dataKey];
      if (typeof v === "number") {
        const sc = line.secondary && secondaryYScale ? secondaryYScale : yScale;
        yPositions[line.dataKey] = sc(v) ?? 0;
      }
    }
    return { point: d, index: fi, x: xScale(xAccessor(d)) ?? 0, yPositions };
  }, [xScale, yScale, secondaryYScale, lines, xAccessor]);

  // Cache posisi kotak chart — dihitung sekali per interaksi (bukan per piksel).
  const measureRect = useCallback(() => {
    if (containerRef.current) rectRef.current = containerRef.current.getBoundingClientRect();
  }, [containerRef]);

  const getClientX = (e) => ("touches" in e ? e.touches[0]?.clientX : e.clientX);

  const pixelFromEvent = useCallback((e) => {
    const clientX = getClientX(e);
    if (clientX == null || !rectRef.current) return null;
    return clientX - rectRef.current.left - margin.left;
  }, [margin.left]);

  const onMouseEnter = useCallback(() => { measureRect(); }, [measureRect]);

  const onMouseMove = useCallback((e) => {
    if (!rectRef.current) measureRect();
    const x = pixelFromEvent(e);
    if (x === null) return;

    if (isDragging.current) {
      const s = Math.min(dragStartX.current, x), en = Math.max(dragStartX.current, x);
      const sp = findPoint(s), ep = findPoint(en);
      setSelection({ startX: s, endX: en, startIndex: sp?.index ?? 0, endIndex: ep?.index ?? 0, active: true });
      return;
    }

    const found = findPoint(x);
    if (!found || found.index === lastIndexRef.current) return; // ⚡ skip render kalau titik data sama
    lastIndexRef.current = found.index;
    setTooltipData(buildTooltip(found.index, found.point));
  }, [measureRect, pixelFromEvent, findPoint, buildTooltip]);

  const onMouseLeave = useCallback(() => {
    lastIndexRef.current = -1;
    isDragging.current = false;
    setTooltipData(null);
    setSelection(null);
  }, []);

  const onMouseDown = useCallback((e) => {
    measureRect();
    const x = pixelFromEvent(e);
    if (x === null) return;
    isDragging.current = true;
    dragStartX.current = x;
    lastIndexRef.current = -1;
    setTooltipData(null);
    setSelection(null);
  }, [measureRect, pixelFromEvent]);

  const onMouseUp = useCallback(() => { isDragging.current = false; setSelection(null); }, []);

  // ⚡ FIX — dulu ada `e.preventDefault()` di sini, tapi React attach
  // onTouchStart/onTouchMove sebagai PASSIVE listener secara default (demi
  // performa scroll), jadi preventDefault() dari synthetic event ini selalu
  // gagal dan browser nge-log "Unable to preventDefault inside passive event
  // listener invocation". preventDefault()-nya sebenarnya redundant: gesture
  // scroll/pan default browser di area chart ini sudah dicegah lewat CSS
  // `touchAction: "none"` (lihat interactionStyle di bawah & style container
  // di komponen AreaChart), jadi aman dihapus tanpa mengubah perilaku drag.
  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    measureRect();
    const x = pixelFromEvent(e);
    if (x === null) return;
    const found = findPoint(x);
    if (!found) return;
    lastIndexRef.current = found.index;
    setTooltipData(buildTooltip(found.index, found.point));
  }, [measureRect, pixelFromEvent, findPoint, buildTooltip]);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const x = pixelFromEvent(e);
    if (x === null) return;
    const found = findPoint(x);
    if (!found || found.index === lastIndexRef.current) return;
    lastIndexRef.current = found.index;
    setTooltipData(buildTooltip(found.index, found.point));
  }, [pixelFromEvent, findPoint, buildTooltip]);

  const onTouchEnd = useCallback(() => { lastIndexRef.current = -1; setTooltipData(null); setSelection(null); }, []);

  return {
    tooltipData, setTooltipData, selection,
    clearSelection: useCallback(() => setSelection(null), []),
    interactionHandlers: canInteract ? { onMouseEnter, onMouseMove, onMouseLeave, onMouseDown, onMouseUp, onTouchStart, onTouchMove, onTouchEnd } : {},
    interactionStyle: { cursor: canInteract ? "crosshair" : "default", touchAction: "none" },
  };
}

// ── Tooltip Components ────────────────────────────────────────────────────────
// ⚡ Semua animasi di bawah ini dulu pakai `framer-motion` (useSpring), yang
// artinya tiap elemen punya loop requestAnimationFrame SENDIRI yang jalan terus
// selama hover/drag. Sekarang diganti transisi CSS murni (`transform` +
// `transition`) — jauh lebih ringan karena dikerjakan compositor browser,
// bukan JS, dan cuma "hidup" pas nilainya berubah (bukan tiap frame).

function TooltipDot({ x, y, visible, color, size = 5 }) {
  if (!visible) return null;
  return (
    <circle
      r={size} fill={color} stroke="var(--chart-background)" strokeWidth={2}
      style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 150ms cubic-bezier(.22,.9,.32,1)", willChange: "transform" }}
    />
  );
}

function TooltipCrosshair({ x, height, visible }) {
  if (!visible) return null;
  return (
    <line
      x1={0} x2={0} y1={0} y2={height} stroke="var(--chart-crosshair)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7}
      style={{ transform: `translateX(${x}px)`, transition: "transform 150ms cubic-bezier(.22,.9,.32,1)", willChange: "transform" }}
    />
  );
}

function TooltipBox({ x, visible, containerRef, containerWidth, containerHeight, margin, children }) {
  const ref = useRef(null);
  const [tw, setTw] = useState(180), [th, setTh] = useState(80);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    if (w > 0 && w !== tw) setTw(w);
    if (h > 0 && h !== th) setTh(h);
  });

  const offset = 16;
  const flip = x + tw + offset > containerWidth;
  const targetX = flip ? x - offset - tw : x + offset;
  const targetY = Math.max(offset, Math.min(margin.top, containerHeight - th - offset));

  const container = containerRef.current;
  if (!(mounted && container && visible)) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "absolute", pointerEvents: "none", zIndex: 50, left: 0, top: 0,
        transform: `translate(${targetX}px, ${targetY}px)`,
        transition: "transform 150ms cubic-bezier(.22,.9,.32,1)",
        willChange: "transform",
        minWidth: 150, overflow: "hidden", borderRadius: 8,
        background: "var(--chart-tooltip-background)", color: "var(--chart-tooltip-foreground)",
        border: "1px solid var(--chart-tooltip-border, rgba(255,255,255,.08))",
        boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      }}
    >
      {children}
    </div>,
    container
  );
}

function TooltipContent({ title, rows }) {
  return (
    <div style={{ padding: "8px 12px" }}>
      {title && <div style={{ fontWeight: 700, fontSize: 11.5, color: "var(--chart-tooltip-foreground)", marginBottom: 6, opacity: 0.7 }}>{title}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((row) => (
          <div key={`${row.label}-${row.color}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 11.5, color: "var(--chart-tooltip-muted)" }}>{row.label}</span>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--chart-tooltip-foreground)", fontVariantNumeric: "tabular-nums" }}>
              {typeof row.value === "number" ? row.value.toLocaleString() : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatePill({ x, index, labels, visible }) {
  if (!visible || !labels[index]) return null;
  return (
    <div style={{
      position: "absolute", bottom: 4, left: 0, pointerEvents: "none", zIndex: 50,
      transform: `translateX(${x}px) translateX(-50%)`,
      transition: "transform 150ms cubic-bezier(.22,.9,.32,1)",
      willChange: "transform",
    }}>
      <div style={{ background: "#18181b", color: "#fff", borderRadius: 9999, padding: "3px 14px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
        {labels[index]}
      </div>
    </div>
  );
}

// ── Exported Chart Components ─────────────────────────────────────────────────

export function ChartTooltip({ showDatePill = true, showCrosshair = true, showDots = true, content, rows: rowsRenderer, children }) {
  const { tooltipData, width, height, innerHeight, margin, lines, xAccessor, dateLabels, containerRef } = useChart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const visible = tooltipData !== null;
  const x = tooltipData?.x ?? 0;
  const xWithMargin = x + margin.left;

  const tooltipRows = useMemo(() => {
    if (!tooltipData) return [];
    if (rowsRenderer) return rowsRenderer(tooltipData.point);
    return lines.map(line => ({ color: line.stroke, label: line.dataKey, value: tooltipData.point[line.dataKey] ?? 0 }));
  }, [tooltipData, lines, rowsRenderer]);

  const title = useMemo(() => {
    if (!tooltipData) return undefined;
    return xAccessor(tooltipData.point).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }, [tooltipData, xAccessor]);

  const container = containerRef.current;
  if (!(mounted && container)) return null;

  return createPortal(
    <>
      {showCrosshair && (
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", width: "100%", height: "100%" }}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            <TooltipCrosshair x={x} height={innerHeight} visible={visible} />
          </g>
        </svg>
      )}
      {showDots && visible && (
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", width: "100%", height: "100%" }}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {lines.map(line => (
              <TooltipDot key={line.dataKey} color={line.stroke} visible={visible}
                x={tooltipData?.x ?? x}
                y={tooltipData?.yPositions[line.dataKey] ?? 0}
              />
            ))}
          </g>
        </svg>
      )}
      <TooltipBox x={xWithMargin} visible={visible} containerRef={containerRef} containerWidth={width} containerHeight={height} margin={margin}>
        {content
          ? content({ point: tooltipData?.point ?? {}, index: tooltipData?.index ?? 0 })
          : <TooltipContent rows={tooltipRows} title={title}>{children}</TooltipContent>
        }
      </TooltipBox>
      {showDatePill && visible && (
        <DatePill x={xWithMargin} index={tooltipData?.index ?? 0} labels={dateLabels} visible={visible} />
      )}
    </>,
    container
  );
}

export function Grid({ horizontal = true, numTicksRows = 5, stroke = "var(--chart-grid)", strokeWidth = 1, strokeDasharray = "4,4" }) {
  const { yScale, innerWidth, innerHeight } = useChart();
  const uid = useId();
  const gId = `grid-fade-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={gId} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" style={{ stopColor: "white", stopOpacity: 0 }} />
          <stop offset="8%" style={{ stopColor: "white", stopOpacity: 1 }} />
          <stop offset="92%" style={{ stopColor: "white", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "white", stopOpacity: 0 }} />
        </linearGradient>
        <mask id={`${gId}-mask`}><rect fill={`url(#${gId})`} height={innerHeight} width={innerWidth} x="0" y="0" /></mask>
      </defs>
      {horizontal && (
        <g mask={`url(#${gId}-mask)`}>
          <GridRows numTicks={numTicksRows} scale={yScale} stroke={stroke} strokeDasharray={strokeDasharray} strokeWidth={strokeWidth} width={innerWidth} />
        </g>
      )}
    </g>
  );
}

export function XAxis({ numTicks = 6 }) {
  const { xScale, margin, tooltipData, containerRef } = useChart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const labels = useMemo(() => {
    const [start, end] = xScale.domain();
    if (!start || !end) return [];
    const st = start.getTime(), et = end.getTime(), range = et - st;
    const count = Math.max(2, numTicks);
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(st + (i / (count - 1)) * range);
      return { x: (xScale(date) ?? 0) + margin.left, label: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) };
    });
  }, [xScale, margin.left, numTicks]);

  const isHovering = tooltipData !== null;
  const crossX = tooltipData ? tooltipData.x + margin.left : null;
  const container = containerRef.current;
  if (!(mounted && container)) return null;

  return createPortal(
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {labels.map((item) => {
        let opacity = 1;
        if (isHovering && crossX !== null) {
          const dist = Math.abs(item.x - crossX);
          if (dist < 50) opacity = 0;
          else if (dist < 70) opacity = (dist - 50) / 20;
        }
        return (
          <div key={`${item.label}-${item.x}`} style={{ position: "absolute", left: item.x, bottom: 8, width: 0, display: "flex", justifyContent: "center" }}>
            <span style={{ opacity, transition: "opacity 200ms ease", fontSize: 11, color: "var(--chart-label)", whiteSpace: "nowrap", fontWeight: 500, display: "block" }}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>,
    container
  );
}

export function YAxis({ numTicks = 5, formatValue, secondary = false }) {
  const { yScale, secondaryYScale, margin, containerRef, width } = useChart();
  const scale = secondary ? (secondaryYScale || yScale) : yScale;
  const [container, setContainer] = useState(null);
  useEffect(() => { setContainer(containerRef.current); }, [containerRef]);

  const ticks = useMemo(() => {
    const [min, max] = scale.domain();
    const step = (max - min) / (numTicks - 1);
    return Array.from({ length: numTicks }, (_, i) => {
      const value = min + step * i;
      return {
        value, y: (scale(value) ?? 0) + margin.top,
        label: formatValue ? formatValue(value) : value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}k` : Math.round(value).toLocaleString(),
      };
    });
  }, [scale, margin.top, numTicks, formatValue]);

  if (!container) return null;
  return createPortal(
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {ticks.map(tick => (
        <div key={tick.value} style={secondary
          ? { position: "absolute", left: width - margin.right + 6, top: tick.y, width: margin.right - 8, display: "flex", justifyContent: "flex-start", transform: "translateY(-50%)" }
          : { position: "absolute", left: 0, top: tick.y, width: margin.left - 6, display: "flex", justifyContent: "flex-end", transform: "translateY(-50%)" }}>
          <span style={{ fontSize: 10, color: "var(--chart-label)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{tick.label}</span>
        </div>
      ))}
    </div>,
    container
  );
}

export function Area({ dataKey, fill = "var(--chart-line-primary)", fillOpacity = 0.15, stroke, strokeWidth = 2, curve = curveNatural, animate = true, showHighlight = true, gradientToOpacity = 0, secondary = false }) {
  const { data, xScale, yScale, secondaryYScale, innerHeight, innerWidth, tooltipData, selection, isLoaded, animationDuration, xAccessor } = useChart();
  const activeYScale = secondary && secondaryYScale ? secondaryYScale : yScale;
  const [clipW, setClipW] = useState(0);
  const gradId = useId();
  const strokeGradId = useId();
  const highlightClipId = useId();
  const resolvedStroke = stroke || fill;

  useEffect(() => {
    if (animate && !isLoaded) requestAnimationFrame(() => setClipW(innerWidth));
  }, [animate, innerWidth, isLoaded]);

  const getY = useCallback((d) => { const v = d[dataKey]; return typeof v === "number" ? (activeYScale(v) ?? 0) : 0; }, [dataKey, activeYScale]);

  // ⚡ REWRITE — segmen highlight dulu dihitung pakai `path.getPointAtLength()`
  // (binary search ~30-40 iterasi PER update, dipanggil tiap gerakan mouse saat
  // drag = puluhan ribu operasi SVG per detik → ini biang lag utamanya).
  // Kurva default (`curveNatural`, sebelumnya `curveMonotoneX`) sama-sama
  // menggambar y sebagai FUNGSI dari x yang urut ascending (bukan kurva
  // parametrik yang bisa balik arah) — jadi clip berbasis piksel-X saja masih
  // akurat secara visual, tidak perlu arc-length sama sekali. Cuma pakai
  // xScale (matematika biasa, hampir gratis).
  const highlightRange = useMemo(() => {
    if (selection?.active) return { x: selection.startX, width: Math.max(0, selection.endX - selection.startX) };
    if (!tooltipData) return null;
    const sp = data[Math.max(0, tooltipData.index - 1)];
    const ep = data[Math.min(data.length - 1, tooltipData.index + 1)];
    if (!sp || !ep) return null;
    const sx = xScale(xAccessor(sp)) ?? 0;
    const ex = xScale(xAccessor(ep)) ?? 0;
    return { x: sx, width: Math.max(0, ex - sx) };
  }, [tooltipData, selection, data, xScale, xAccessor]);

  const isHovering = tooltipData !== null || selection?.active === true;
  const easing = "cubic-bezier(0.85, 0, 0.15, 1)";

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: fill, stopOpacity: fillOpacity }} />
          <stop offset="100%" style={{ stopColor: fill, stopOpacity: gradientToOpacity }} />
        </linearGradient>
        <linearGradient id={strokeGradId} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" style={{ stopColor: resolvedStroke, stopOpacity: 0 }} />
          <stop offset="12%" style={{ stopColor: resolvedStroke, stopOpacity: 1 }} />
          <stop offset="88%" style={{ stopColor: resolvedStroke, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: resolvedStroke, stopOpacity: 0 }} />
        </linearGradient>
        {animate && (
          <clipPath id={`clip-${gradId}`}>
            <rect height={innerHeight + 20} x={0} y={0} width={isLoaded ? innerWidth : clipW}
              style={{ transition: !isLoaded && clipW > 0 ? `width ${animationDuration}ms ${easing}` : "none" }} />
          </clipPath>
        )}
        {showHighlight && highlightRange && (
          <clipPath id={highlightClipId}>
            <rect x={highlightRange.x} y={-10} width={highlightRange.width} height={innerHeight + 20} />
          </clipPath>
        )}
      </defs>
      <g clipPath={animate ? `url(#clip-${gradId})` : undefined}>
        <g style={{ opacity: isHovering && showHighlight ? 0.55 : 1, transition: "opacity 200ms ease" }}>
          <AreaClosed curve={curve} data={data} fill={`url(#${gradId})`} x={(d) => xScale(xAccessor(d)) ?? 0} y={getY} yScale={activeYScale} />
          <LinePath curve={curve} data={data} stroke={`url(#${strokeGradId})`} strokeLinecap="round" strokeWidth={strokeWidth} x={(d) => xScale(xAccessor(d)) ?? 0} y={getY} />
        </g>
        {showHighlight && highlightRange && (
          <g clipPath={`url(#${highlightClipId})`}>
            <LinePath curve={curve} data={data} stroke={resolvedStroke} strokeLinecap="round" strokeWidth={strokeWidth} x={(d) => xScale(xAccessor(d)) ?? 0} y={getY} />
          </g>
        )}
      </g>
    </>
  );
}

// ── Chart Inner ───────────────────────────────────────────────────────────────

function extractLineConfigs(children) {
  const configs = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const name = typeof child.type === "function" ? (child.type.displayName || child.type.name || "") : "";
    const props = child.props;
    if ((name === "Area" || child.type === Area) && props?.dataKey) {
      configs.push({ dataKey: props.dataKey, stroke: props.stroke || props.fill || "var(--chart-line-primary)", strokeWidth: props.strokeWidth || 2, secondary: !!props.secondary });
    }
  });
  return configs;
}

const DEFAULT_MARGIN = { top: 20, right: 20, bottom: 36, left: 55 };

function ChartInner({ width, height, data, xDataKey, margin, animationDuration, children, containerRef }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const lines = useMemo(() => extractLineConfigs(children), [children]);
  const iW = width - margin.left - margin.right;
  const iH = height - margin.top - margin.bottom;

  const xAccessor = useCallback((d) => { const v = d[xDataKey]; return v instanceof Date ? v : new Date(v); }, [xDataKey]);

  // ⚡ FIX — sort defensif berdasarkan tanggal. Tiga hal di bawah ini diam-diam
  // MENGASUMSIKAN data sudah terurut kronologis, dan kalau tidak, hasilnya jadi
  // "acak-acak" (garis nyeret balik, kurva liar):
  //   1. `bisector(...).left` (d3-array) — binary search ini butuh array ascending,
  //      dipakai untuk cari titik saat hover/drag. Kalau data tidak urut, titik
  //      yang ditemukan bisa salah.
  //   2. `LinePath`/`AreaClosed` menggambar garis mengikuti URUTAN ARRAY apa
  //      adanya, bukan urutan tanggal — kalau array-nya tidak urut, garis akan
  //      "loncat" ke kiri lalu nyambung lagi, keliatan seperti zigzag acak.
  //   3. Kurva spline (`curveNatural`/`curveMonotoneX`) secara matematis cuma
  //      valid untuk X yang monoton naik;
  //      kalau tidak, interpolasinya bisa overshoot/berosilasi liar.
  // Sort di sini bikin komponen aman dipakai walau data dari luar (misal hasil
  // gabungan beberapa response API) urutannya belum tentu kronologis.
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => xAccessor(a).getTime() - xAccessor(b).getTime());
  }, [data, xAccessor]);

  const bisectDate = useMemo(() => bisector((d) => xAccessor(d)).left, [xAccessor]);

  const xScale = useMemo(() => {
    const dates = sortedData.map(xAccessor);
    return scaleTime({ range: [0, iW], domain: [Math.min(...dates.map(d => d.getTime())), Math.max(...dates.map(d => d.getTime()))] });
  }, [iW, sortedData, xAccessor]);

  const yScale = useMemo(() => {
    let max = 0;
    for (const line of lines) { if (line.secondary) continue; for (const d of sortedData) { const v = d[line.dataKey]; if (typeof v === "number" && v > max) max = v; } }
    if (max === 0) max = 100;
    return scaleLinear({ range: [iH, 0], domain: [0, max * 1.15], nice: true });
  }, [iH, sortedData, lines]);

  const hasSecondary = useMemo(() => lines.some(l => l.secondary), [lines]);
  const secondaryYScale = useMemo(() => {
    if (!hasSecondary) return null;
    let max = 0;
    for (const line of lines) { if (!line.secondary) continue; for (const d of sortedData) { const v = d[line.dataKey]; if (typeof v === "number" && v > max) max = v; } }
    if (max === 0) max = 100;
    return scaleLinear({ range: [iH, 0], domain: [0, max * 1.15], nice: true });
  }, [iH, sortedData, lines, hasSecondary]);

  const columnWidth = useMemo(() => sortedData.length < 2 ? 0 : iW / (sortedData.length - 1), [iW, sortedData.length]);
  const dateLabels = useMemo(() => sortedData.map(d => xAccessor(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" })), [sortedData, xAccessor]);

  useEffect(() => { const t = setTimeout(() => setIsLoaded(true), animationDuration); return () => clearTimeout(t); }, [animationDuration]);

  // ⚡ Penting: pakai `sortedData` di sini, bukan `data` mentah — supaya index
  // yang dihasilkan bisector/findPoint konsisten dengan urutan yang dipakai
  // untuk menggambar garis dan dateLabels di atas.
  const { tooltipData, setTooltipData, selection, clearSelection, interactionHandlers, interactionStyle } = useChartInteraction({
    xScale, yScale, secondaryYScale, data: sortedData, lines, margin, xAccessor, bisectDate, canInteract: isLoaded, containerRef,
  });

  // ⚡ Memo context value — dulu object literal ini dibuat ULANG SETIAP render,
  // jadi semua consumer (Grid/XAxis/YAxis/ChartTooltip/Area) ikut re-render tiap
  // kali ada perubahan apa pun. Sekarang cuma berubah kalau salah satu depedency
  // di bawah beneran berubah.
  const ctxValue = useMemo(() => ({
    data: sortedData, xScale, yScale, secondaryYScale, width, height, innerWidth: iW, innerHeight: iH,
    margin, columnWidth, tooltipData, setTooltipData, containerRef, lines, isLoaded,
    animationDuration, xAccessor, dateLabels, selection, clearSelection,
  }), [sortedData, xScale, yScale, secondaryYScale, width, height, iW, iH, margin, columnWidth,
    tooltipData, containerRef, lines, isLoaded, animationDuration, xAccessor, dateLabels, selection, clearSelection]);

  if (width < 10 || height < 10) return null;

  return (
    <ChartContext.Provider value={ctxValue}>
      <svg width={width} height={height} aria-hidden="true">
        <rect fill="transparent" width={width} height={height} />
        <g transform={`translate(${margin.left},${margin.top})`} {...interactionHandlers} style={interactionStyle}>
          <rect fill="transparent" width={iW} height={iH} />
          {children}
        </g>
      </svg>
    </ChartContext.Provider>
  );
}

// ── AreaChart (public) ────────────────────────────────────────────────────────

export function AreaChart({ data, xDataKey = "date", margin: marginProp, animationDuration = 1000, aspectRatio = "3 / 1", className = "", children }) {
  const containerRef = useRef(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  return (
    <div ref={containerRef} className={className} style={{ position: "relative", width: "100%", aspectRatio, touchAction: "none" }}>
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <ChartInner width={width} height={height} data={data} xDataKey={xDataKey} margin={margin} animationDuration={animationDuration} containerRef={containerRef}>
            {children}
          </ChartInner>
        )}
      </ParentSize>
    </div>
  );
}

export default AreaChart;