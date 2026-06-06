"use client";

import { localPoint } from "@visx/event";
import { curveMonotoneX } from "@visx/curve";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { bisector } from "d3-array";
import { AnimatePresence, motion, useMotionTemplate, useSpring } from "motion/react";
import {
  Children, createContext, isValidElement, useCallback, useContext,
  useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import useMeasure from "react-use-measure";
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

// ── Interaction hook ──────────────────────────────────────────────────────────

function useChartInteraction({ xScale, yScale, secondaryYScale, data, lines, margin, xAccessor, bisectDate, canInteract }) {
  const [tooltipData, setTooltipData] = useState(null);
  const [selection, setSelection] = useState(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);

  const resolveTooltip = useCallback((pixelX) => {
    const x0 = xScale.invert(pixelX);
    const idx = bisectDate(data, x0, 1);
    const d0 = data[idx - 1], d1 = data[idx];
    if (!d0) return null;
    let d = d0, fi = idx - 1;
    if (d1 && x0.getTime() - xAccessor(d0).getTime() > xAccessor(d1).getTime() - x0.getTime()) { d = d1; fi = idx; }
    const yPositions = {};
    for (const line of lines) { const v = d[line.dataKey]; if (typeof v === "number") { const sc = line.secondary && secondaryYScale ? secondaryYScale : yScale; yPositions[line.dataKey] = sc(v) ?? 0; } }
    return { point: d, index: fi, x: xScale(xAccessor(d)) ?? 0, yPositions };
  }, [xScale, yScale, secondaryYScale, data, lines, xAccessor, bisectDate]);

  const resolveIndex = useCallback((pixelX) => {
    const x0 = xScale.invert(pixelX);
    const idx = bisectDate(data, x0, 1);
    const d0 = data[idx - 1], d1 = data[idx];
    if (!d0) return 0;
    if (d1 && x0.getTime() - xAccessor(d0).getTime() > xAccessor(d1).getTime() - x0.getTime()) return idx;
    return idx - 1;
  }, [xScale, data, xAccessor, bisectDate]);

  const getX = useCallback((event, ti = 0) => {
    let pt = null;
    if ("touches" in event) {
      const t = event.touches[ti]; if (!t) return null;
      const svg = event.currentTarget.ownerSVGElement; if (!svg) return null;
      pt = localPoint(svg, t);
    } else pt = localPoint(event);
    return pt ? pt.x - margin.left : null;
  }, [margin.left]);

  const onMouseMove = useCallback((e) => {
    const x = getX(e); if (x === null) return;
    if (isDragging.current) {
      const s = Math.min(dragStartX.current, x), en = Math.max(dragStartX.current, x);
      setSelection({ startX: s, endX: en, startIndex: resolveIndex(s), endIndex: resolveIndex(en), active: true });
      return;
    }
    const t = resolveTooltip(x); if (t) setTooltipData(t);
  }, [getX, resolveTooltip, resolveIndex]);

  const onMouseLeave = useCallback(() => { setTooltipData(null); isDragging.current = false; setSelection(null); }, []);
  const onMouseDown = useCallback((e) => { const x = getX(e); if (x === null) return; isDragging.current = true; dragStartX.current = x; setTooltipData(null); setSelection(null); }, [getX]);
  const onMouseUp = useCallback(() => { isDragging.current = false; setSelection(null); }, []);
  const onTouchStart = useCallback((e) => { if (e.touches.length === 1) { e.preventDefault(); const x = getX(e, 0); if (x === null) return; const t = resolveTooltip(x); if (t) setTooltipData(t); } }, [getX, resolveTooltip]);
  const onTouchMove = useCallback((e) => { if (e.touches.length === 1) { e.preventDefault(); const x = getX(e, 0); if (x === null) return; const t = resolveTooltip(x); if (t) setTooltipData(t); } }, [getX, resolveTooltip]);
  const onTouchEnd = useCallback(() => { setTooltipData(null); setSelection(null); }, []);

  return {
    tooltipData, setTooltipData, selection,
    clearSelection: useCallback(() => setSelection(null), []),
    interactionHandlers: canInteract ? { onMouseMove, onMouseLeave, onMouseDown, onMouseUp, onTouchStart, onTouchMove, onTouchEnd } : {},
    interactionStyle: { cursor: canInteract ? "crosshair" : "default", touchAction: "none" },
  };
}

// ── Tooltip Components ────────────────────────────────────────────────────────

function TooltipDot({ x, y, visible, color, size = 5 }) {
  const cfg = { stiffness: 300, damping: 30 };
  const ax = useSpring(x, cfg), ay = useSpring(y, cfg);
  useEffect(() => { ax.set(x); ay.set(y); }, [x, y, ax, ay]);
  if (!visible) return null;
  return <motion.circle cx={ax} cy={ay} fill={color} r={size} stroke="var(--chart-background)" strokeWidth={2} />;
}

function TooltipCrosshair({ x, height, visible }) {
  const cfg = { stiffness: 300, damping: 30 };
  const ax = useSpring(x, cfg);
  useEffect(() => { ax.set(x); }, [x, ax]);
  if (!visible) return null;
  return <motion.line x1={ax} x2={ax} y1={0} y2={height} stroke="var(--chart-crosshair)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />;
}

function TooltipBox({ x, visible, containerRef, containerWidth, containerHeight, margin, children }) {
  const ref = useRef(null);
  const [tw, setTw] = useState(180), [th, setTh] = useState(80);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useLayoutEffect(() => {
    if (ref.current) { const w = ref.current.offsetWidth, h = ref.current.offsetHeight; if (w > 0) setTw(w); if (h > 0) setTh(h); }
  });

  const offset = 16;
  const flip = x + tw + offset > containerWidth;
  const targetX = flip ? x - offset - tw : x + offset;
  const targetY = Math.max(offset, Math.min(margin.top, containerHeight - th - offset));
  const [fk, setFk] = useState(0);
  const prevFlip = useRef(flip);
  useEffect(() => { if (prevFlip.current !== flip) { setFk(k => k + 1); prevFlip.current = flip; } }, [flip]);

  const cfg = { stiffness: 100, damping: 20 };
  const al = useSpring(targetX, cfg), at = useSpring(targetY, cfg);
  useEffect(() => { al.set(targetX); }, [targetX, al]);
  useEffect(() => { at.set(targetY); }, [targetY, at]);

  const container = containerRef.current;
  if (!(mounted && container && visible)) return null;

  return createPortal(
    <motion.div ref={ref} animate={{ opacity: 1 }} initial={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
      style={{ position: "absolute", pointerEvents: "none", zIndex: 50, left: al, top: at }}>
      <motion.div key={fk} animate={{ scale: 1, opacity: 1, x: 0 }} initial={{ scale: 0.88, opacity: 0, x: flip ? 16 : -16 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{ minWidth: 150, overflow: "hidden", borderRadius: 10, background: "var(--chart-tooltip-background)", color: "var(--chart-tooltip-foreground)", boxShadow: "0 8px 32px rgba(0,0,0,.2)", backdropFilter: "blur(8px)", transformOrigin: flip ? "right top" : "left top" }}>
        {children}
      </motion.div>
    </motion.div>,
    container
  );
}

function TooltipContent({ title, rows }) {
  return (
    <div style={{ padding: "10px 14px" }}>
      {title && <div style={{ fontWeight: 700, fontSize: 12, color: "var(--chart-tooltip-foreground)", marginBottom: 8, opacity: 0.7 }}>{title}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row) => (
          <div key={`${row.label}-${row.color}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "var(--chart-tooltip-muted)" }}>{row.label}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--chart-tooltip-foreground)", fontVariantNumeric: "tabular-nums" }}>
              {typeof row.value === "number" ? row.value.toLocaleString() : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatePill({ x, index, labels, visible }) {
  const cfg = { stiffness: 300, damping: 30 };
  const ax = useSpring(x, cfg);
  useEffect(() => { ax.set(x); }, [x, ax]);
  if (!visible || !labels[index]) return null;
  return (
    <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}
      style={{ position: "absolute", bottom: 4, left: ax, transform: "translateX(-50%)", pointerEvents: "none", zIndex: 50 }}>
      <div style={{ background: "#18181b", color: "#fff", borderRadius: 9999, padding: "3px 14px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
        {labels[index]}
      </div>
    </motion.div>
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
                x={tooltipData?.xPositions?.[line.dataKey] ?? x}
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
            <motion.span animate={{ opacity }} initial={{ opacity: 1 }} transition={{ duration: 0.3 }}
              style={{ fontSize: 11, color: "var(--chart-label)", whiteSpace: "nowrap", fontWeight: 500, display: "block" }}>
              {item.label}
            </motion.span>
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

export function Area({ dataKey, fill = "var(--chart-line-primary)", fillOpacity = 0.15, stroke, strokeWidth = 2, curve = curveMonotoneX, animate = true, showHighlight = true, gradientToOpacity = 0, secondary = false }) {
  const { data, xScale, yScale, secondaryYScale, innerHeight, innerWidth, tooltipData, selection, isLoaded, animationDuration, xAccessor } = useChart();
  const activeYScale = secondary && secondaryYScale ? secondaryYScale : yScale;
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);
  const [clipW, setClipW] = useState(0);
  const gradId = useId();
  const strokeGradId = useId();
  const resolvedStroke = stroke || fill;

  useEffect(() => {
    if (pathRef.current && animate) {
      const len = pathRef.current.getTotalLength();
      if (len > 0) { setPathLength(len); if (!isLoaded) requestAnimationFrame(() => setClipW(innerWidth)); }
    }
  }, [animate, innerWidth, isLoaded]);

  const findLenAtX = useCallback((tx) => {
    const path = pathRef.current;
    if (!path || pathLength === 0) return 0;
    let lo = 0, hi = pathLength;
    while (hi - lo > 0.5) { const mid = (lo + hi) / 2; if (path.getPointAtLength(mid).x < tx) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }, [pathLength]);

  const segBounds = useMemo(() => {
    if (!pathRef.current || pathLength === 0) return { startLength: 0, segmentLength: 0 };
    if (selection?.active) {
      const s = findLenAtX(selection.startX), e = findLenAtX(selection.endX);
      return { startLength: s, segmentLength: e - s };
    }
    if (!tooltipData) return { startLength: 0, segmentLength: 0 };
    const sp = data[Math.max(0, tooltipData.index - 1)], ep = data[Math.min(data.length - 1, tooltipData.index + 1)];
    if (!sp || !ep) return { startLength: 0, segmentLength: 0 };
    return { startLength: findLenAtX(xScale(xAccessor(sp)) ?? 0), segmentLength: findLenAtX(xScale(xAccessor(ep)) ?? 0) - findLenAtX(xScale(xAccessor(sp)) ?? 0) };
  }, [tooltipData, selection, data, xScale, pathLength, xAccessor, findLenAtX]);

  const scfg = { stiffness: 180, damping: 28 };
  const offSpring = useSpring(0, scfg), lenSpring = useSpring(0, scfg);
  const animDash = useMotionTemplate`${lenSpring} ${pathLength}`;
  useEffect(() => { offSpring.set(-segBounds.startLength); lenSpring.set(segBounds.segmentLength); }, [segBounds.startLength, segBounds.segmentLength, offSpring, lenSpring]);

  const getY = useCallback((d) => { const v = d[dataKey]; return typeof v === "number" ? (activeYScale(v) ?? 0) : 0; }, [dataKey, activeYScale]);
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
      </defs>
      {animate && (
        <defs>
          <clipPath id={`clip-${gradId}`}>
            <rect height={innerHeight + 20} x={0} y={0} width={isLoaded ? innerWidth : clipW}
              style={{ transition: !isLoaded && clipW > 0 ? `width ${animationDuration}ms ${easing}` : "none" }} />
          </clipPath>
        </defs>
      )}
      <g clipPath={animate ? `url(#clip-${gradId})` : undefined}>
        <motion.g animate={{ opacity: isHovering && showHighlight ? 0.55 : 1 }} initial={{ opacity: 1 }} transition={{ duration: 0.35 }}>
          <AreaClosed curve={curve} data={data} fill={`url(#${gradId})`} x={(d) => xScale(xAccessor(d)) ?? 0} y={getY} yScale={activeYScale} />
          <LinePath curve={curve} data={data} innerRef={pathRef} stroke={`url(#${strokeGradId})`} strokeLinecap="round" strokeWidth={strokeWidth} x={(d) => xScale(xAccessor(d)) ?? 0} y={getY} />
        </motion.g>
      </g>
      {isHovering && isLoaded && pathRef.current && (
        <motion.path animate={{ opacity: 1 }} initial={{ opacity: 0 }} d={pathRef.current.getAttribute("d") || ""} fill="none" stroke={resolvedStroke} strokeLinecap="round" strokeWidth={strokeWidth} style={{ strokeDasharray: animDash, strokeDashoffset: offSpring }} transition={{ duration: 0.35 }} />
      )}
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
  const bisectDate = useMemo(() => bisector((d) => xAccessor(d)).left, [xAccessor]);

  const xScale = useMemo(() => {
    const dates = data.map(xAccessor);
    return scaleTime({ range: [0, iW], domain: [Math.min(...dates.map(d => d.getTime())), Math.max(...dates.map(d => d.getTime()))] });
  }, [iW, data, xAccessor]);

  const yScale = useMemo(() => {
    let max = 0;
    for (const line of lines) { if (line.secondary) continue; for (const d of data) { const v = d[line.dataKey]; if (typeof v === "number" && v > max) max = v; } }
    if (max === 0) max = 100;
    return scaleLinear({ range: [iH, 0], domain: [0, max * 1.15], nice: true });
  }, [iH, data, lines]);

  const hasSecondary = useMemo(() => lines.some(l => l.secondary), [lines]);
  const secondaryYScale = useMemo(() => {
    if (!hasSecondary) return null;
    let max = 0;
    for (const line of lines) { if (!line.secondary) continue; for (const d of data) { const v = d[line.dataKey]; if (typeof v === "number" && v > max) max = v; } }
    if (max === 0) max = 100;
    return scaleLinear({ range: [iH, 0], domain: [0, max * 1.15], nice: true });
  }, [iH, data, lines, hasSecondary]);

  const columnWidth = useMemo(() => data.length < 2 ? 0 : iW / (data.length - 1), [iW, data.length]);
  const dateLabels = useMemo(() => data.map(d => xAccessor(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" })), [data, xAccessor]);

  useEffect(() => { const t = setTimeout(() => setIsLoaded(true), animationDuration); return () => clearTimeout(t); }, [animationDuration]);

  const { tooltipData, setTooltipData, selection, clearSelection, interactionHandlers, interactionStyle } = useChartInteraction({
    xScale, yScale, secondaryYScale, data, lines, margin, xAccessor, bisectDate, canInteract: isLoaded,
  });

  if (width < 10 || height < 10) return null;

  return (
    <ChartContext.Provider value={{ data, xScale, yScale, secondaryYScale, width, height, innerWidth: iW, innerHeight: iH, margin, columnWidth, tooltipData, setTooltipData, containerRef, lines, isLoaded, animationDuration, xAccessor, dateLabels, selection, clearSelection }}>
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
    <div ref={containerRef} style={{ position: "relative", width: "100%", aspectRatio, touchAction: "none" }}>
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