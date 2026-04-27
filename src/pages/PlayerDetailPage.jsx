import React, { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  calcPlayerStats,
  filterMatchesBySeason,
  getAvailableSeasons,
  getMatches,
  getPlayerFargoRatingHistory,
  getPlayers,
  normalizeSeasonId,
  seasonLabel,
} from "../data/store.js";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";

function formatCount(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatRating(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSignedRating(value) {
  const number = Number(value ?? 0);
  return `${number > 0 ? "+" : ""}${formatRating(number)}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleString();
}

function formatShortDate(iso) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function SummaryCard({ label, value }) {
  return (
    <div className="kpi playerDetailKpi">
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
    </div>
  );
}

const MAX_TURNING_POINTS = 12;
const TURNING_POINT_FONT_SIZE = 7.4;
const TURNING_POINT_LINE_HEIGHT = 9;
const TURNING_POINT_CHAR_WIDTH = 4.6;
const TURNING_POINT_LABEL_MIN_WIDTH = 34;
const TURNING_POINT_LABEL_MAX_WIDTH = 104;
const TURNING_POINT_LABEL_GAP = 16;
const TURNING_POINT_MIN_CONNECTOR = 14;
const TURNING_POINT_CONNECTOR_OFFSET = 3;

function clampNumber(value, min, max) {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

function truncateLabelText(value, maxLength = 6) {
  const text = String(value ?? "").trim();
  if (!text) return "Unknown";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function estimateLabelUnits(value) {
  return [...String(value ?? "")].reduce((total, char) => {
    return total + (/[\u3400-\u9fff]/.test(char) ? 1.8 : 1);
  }, 0);
}

function detectTurningPointIndexes(points, threshold) {
  if (points.length === 0) return [];
  if (points.length === 1) return [0];

  const indexes = [0];
  let trend = 0;
  let pivotIndex = 0;
  let extremeIndex = 0;
  let highIndex = 0;
  let lowIndex = 0;

  for (let index = 1; index < points.length; index += 1) {
    const rating = points[index].rating;

    if (rating >= points[highIndex].rating) highIndex = index;
    if (rating <= points[lowIndex].rating) lowIndex = index;

    if (trend === 0) {
      if (points[pivotIndex].rating - points[lowIndex].rating >= threshold) {
        trend = -1;
        extremeIndex = lowIndex;
        highIndex = pivotIndex;
        continue;
      }

      if (points[highIndex].rating - points[pivotIndex].rating >= threshold) {
        trend = 1;
        extremeIndex = highIndex;
        lowIndex = pivotIndex;
      }
      continue;
    }

    const extremeRating = points[extremeIndex].rating;

    if (trend > 0) {
      if (rating >= extremeRating) {
        extremeIndex = index;
        continue;
      }

      if (extremeRating - rating >= threshold) {
        if (extremeIndex !== indexes[indexes.length - 1]) indexes.push(extremeIndex);
        pivotIndex = extremeIndex;
        trend = -1;
        extremeIndex = index;
      }
      continue;
    }

    if (rating <= extremeRating) {
      extremeIndex = index;
      continue;
    }

    if (rating - extremeRating >= threshold) {
      if (extremeIndex !== indexes[indexes.length - 1]) indexes.push(extremeIndex);
      pivotIndex = extremeIndex;
      trend = 1;
      extremeIndex = index;
    }
  }

  if (extremeIndex !== indexes[indexes.length - 1]) indexes.push(extremeIndex);
  if (indexes[indexes.length - 1] !== points.length - 1) indexes.push(points.length - 1);

  return [...new Set(indexes)].sort((a, b) => a - b);
}

function buildTurningPointIndexes(points) {
  if (points.length <= 2) return points.map((_, index) => index);

  const ratings = points.map((point) => point.rating);
  const span = Math.max(...ratings) - Math.min(...ratings);
  let threshold = Math.max(4, Math.min(10, span * 0.16 || 4));
  let indexes = detectTurningPointIndexes(points, threshold);

  while (indexes.length > MAX_TURNING_POINTS && threshold < span + 2) {
    threshold += 0.75;
    indexes = detectTurningPointIndexes(points, threshold);
  }

  return indexes;
}

function getTurningPointKind(points, turningIndexes, order) {
  const currentIndex = turningIndexes[order];
  const currentRating = points[currentIndex].rating;
  const previousRating = order > 0 ? points[turningIndexes[order - 1]].rating : null;
  const nextRating =
    order < turningIndexes.length - 1 ? points[turningIndexes[order + 1]].rating : null;

  if (previousRating == null && nextRating == null) {
    return currentRating >= 500 ? "peak" : "trough";
  }

  if (previousRating == null) {
    return currentRating >= nextRating ? "peak" : "trough";
  }

  if (nextRating == null) {
    return currentRating >= previousRating ? "peak" : "trough";
  }

  return currentRating >= previousRating && currentRating >= nextRating ? "peak" : "trough";
}

function buildTurningPointLabel(point) {
  const line1 = "涨跌趋势";
  const stageText = formatSignedRating(point.segmentDelta);
  const culpritLineText =
    point.segmentDelta >= 0
      ? `送分童子: ${point.culpritName}`
      : `罪魁祸首: ${point.culpritName}`;
  const culpritDeltaLineText =
    point.segmentDelta >= 0
      ? `贡献分数: ${formatSignedRating(point.culpritDelta)}`
      : `掏走分数: ${formatSignedRating(point.culpritDelta)}`;
  const width = clampNumber(
    Math.max(
      estimateLabelUnits(`${line1} ${stageText}`),
      estimateLabelUnits(culpritLineText),
      estimateLabelUnits(culpritDeltaLineText),
    ) *
      TURNING_POINT_CHAR_WIDTH,
    TURNING_POINT_LABEL_MIN_WIDTH,
    TURNING_POINT_LABEL_MAX_WIDTH,
  );

  return {
    line1,
    stageText,
    culpritLineText,
    culpritDeltaLineText,
    width,
    height: TURNING_POINT_LINE_HEIGHT * 3 + 4,
  };
}

function getStageCulprit(points, startIndex, endIndex, playerMap, segmentDelta) {
  const stagePoints = points.slice(startIndex + 1, endIndex + 1);
  const totalsByOpponent = new Map();

  stagePoints.forEach((point) => {
    totalsByOpponent.set(
      point.opponentId,
      (totalsByOpponent.get(point.opponentId) ?? 0) + point.delta,
    );
  });

  const totals = [...totalsByOpponent.entries()].map(([opponentId, total]) => ({
    opponentId,
    total,
    name: truncateLabelText(playerMap.get(opponentId)?.name ?? "Unknown"),
  }));

  if (totals.length === 0) {
    return {
      opponentId: null,
      name: "Unknown",
      total: 0,
    };
  }

  const sameDirectionTotals = totals.filter((item) =>
    segmentDelta >= 0 ? item.total > 0 : item.total < 0,
  );
  const rankedTotals = sameDirectionTotals.length > 0 ? sameDirectionTotals : totals;
  const culprit = rankedTotals.reduce((best, item) => {
    if (!best) return item;

    if (segmentDelta >= 0) {
      if (item.total > best.total) return item;
      if (item.total === best.total && Math.abs(item.total) > Math.abs(best.total)) return item;
      return best;
    }

    if (item.total < best.total) return item;
    if (item.total === best.total && Math.abs(item.total) > Math.abs(best.total)) return item;
    return best;
  }, null);

  return {
    opponentId: culprit.opponentId,
    name: culprit.name,
    total: culprit.total,
  };
}

function getCurveEnvelope(plottedPoints, xStart, xEnd, fallbackY) {
  const samples = plottedPoints.filter(
    (sample) => sample.x >= xStart - 12 && sample.x <= xEnd + 12,
  );

  if (samples.length === 0) {
    return { minY: fallbackY, maxY: fallbackY };
  }

  return {
    minY: Math.min(...samples.map((sample) => sample.y)),
    maxY: Math.max(...samples.map((sample) => sample.y)),
  };
}

function getVerticalLabelCandidates(point, plottedPoints, bounds) {
  const x = clampNumber(
    point.x - point.labelWidth / 2,
    bounds.minX,
    Math.max(bounds.minX, bounds.maxX - point.labelWidth),
  );
  const envelope = getCurveEnvelope(plottedPoints, x, x + point.labelWidth, point.y);
  const maxLabelY = Math.max(bounds.minY, bounds.maxY - point.labelHeight);
  const gap = TURNING_POINT_LABEL_GAP;
  const aboveSpace = Math.max(0, envelope.minY - bounds.minY);
  const belowSpace = Math.max(0, bounds.maxY - envelope.maxY);
  const aboveBaseY = clampNumber(
    Math.min(envelope.minY, point.y) - point.labelHeight - gap,
    bounds.minY,
    maxLabelY,
  );
  const belowBaseY = clampNumber(
    Math.max(envelope.maxY, point.y) + gap,
    bounds.minY,
    maxLabelY,
  );
  const preferAbove =
    aboveSpace > belowSpace + 6 ||
    (Math.abs(aboveSpace - belowSpace) <= 6 && point.kind === "peak");
  const directions = preferAbove ? ["above", "below"] : ["below", "above"];
  const candidates = [];

  directions.forEach((direction) => {
    const offsets = direction === "above" ? [0, -10, -20, 8] : [0, 10, 20, -8];
    const baseY = direction === "above" ? aboveBaseY : belowBaseY;
    const clearance = direction === "above" ? aboveSpace : belowSpace;

    offsets.forEach((offset) => {
      const y = clampNumber(baseY + offset, bounds.minY, maxLabelY);
      const hasEnoughConnector =
        direction === "above"
          ? y + point.labelHeight <= point.y - TURNING_POINT_MIN_CONNECTOR
          : y >= point.y + TURNING_POINT_MIN_CONNECTOR;

      if (!hasEnoughConnector) return;
      if (candidates.some((candidate) => candidate.direction === direction && candidate.y === y)) {
        return;
      }

      candidates.push({
        x,
        y,
        direction,
        clearance,
      });
    });
  });

  return candidates;
}

function getOverlapArea(a, b, padding = 8) {
  const left = Math.max(a.x - padding, b.x - padding);
  const right = Math.min(a.x + a.width + padding, b.x + b.width + padding);
  const top = Math.max(a.y - padding, b.y - padding);
  const bottom = Math.min(a.y + a.height + padding, b.y + b.height + padding);

  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function getCurvePenalty(box, plottedPoints) {
  let penalty = 0;

  plottedPoints.forEach((sample) => {
    if (sample.x < box.x - 10 || sample.x > box.x + box.width + 10) return;

    const verticalGap =
      sample.y < box.y
        ? box.y - sample.y
        : sample.y > box.y + box.height
          ? sample.y - (box.y + box.height)
          : 0;

    if (verticalGap === 0) {
      penalty += 700;
      return;
    }

    penalty += 48 / (verticalGap + 4);
  });

  return penalty;
}

function getAnnotationAnchor(box, point, direction) {
  return {
    x: clampNumber(point.x, box.x + 6, box.x + box.width - 6),
    y:
      direction === "above"
        ? box.y + box.height + TURNING_POINT_CONNECTOR_OFFSET
        : box.y - TURNING_POINT_CONNECTOR_OFFSET,
  };
}

function buildTurningPointAnnotations(turningPoints, plottedPoints, bounds) {
  const placements = [];

  turningPoints.forEach((point) => {
    const candidates = getVerticalLabelCandidates(point, plottedPoints, bounds);
    if (candidates.length === 0) {
      const fallbackDirection = point.kind === "peak" ? "above" : "below";
      const fallbackY =
        fallbackDirection === "above"
          ? clampNumber(
              point.y - point.labelHeight - TURNING_POINT_LABEL_GAP,
              bounds.minY,
              Math.max(bounds.minY, bounds.maxY - point.labelHeight),
            )
          : clampNumber(
              point.y + TURNING_POINT_LABEL_GAP,
              bounds.minY,
              Math.max(bounds.minY, bounds.maxY - point.labelHeight),
            );

      candidates.push({
        x: clampNumber(
          point.x - point.labelWidth / 2,
          bounds.minX,
          Math.max(bounds.minX, bounds.maxX - point.labelWidth),
        ),
        y: fallbackY,
        direction: fallbackDirection,
        clearance: 0,
      });
    }
    let bestPlacement = null;
    let bestPenalty = Number.POSITIVE_INFINITY;

    candidates.forEach((candidate) => {
      const box = {
        x: candidate.x,
        y: candidate.y,
        width: point.labelWidth,
        height: point.labelHeight,
      };

      let penalty = getCurvePenalty(box, plottedPoints);
      penalty -= candidate.clearance * 0.65;
      if ((point.kind === "peak" && candidate.direction === "above") || (point.kind === "trough" && candidate.direction === "below")) {
        penalty -= 5;
      }

      placements.forEach((placement) => {
        const overlapArea = getOverlapArea(box, placement.box);
        if (overlapArea > 0) penalty += 10000 + overlapArea;
      });

      if (!bestPlacement || penalty < bestPenalty) {
        bestPlacement = {
          box,
          direction: candidate.direction,
        };
        bestPenalty = penalty;
      }
    });

    const anchor = getAnnotationAnchor(bestPlacement.box, point, bestPlacement.direction);
    placements.push({
      box: bestPlacement.box,
      direction: bestPlacement.direction,
      anchorX: anchor.x,
      anchorY: anchor.y,
    });
  });

  return placements;
}

function FargoHistoryChart({ history, playerMap }) {
  const points = history.points;
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const width = 960;
    const height = 320;
    const left = 70;
    const right = 24;
    const top = 24;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const values = [history.startRating, ...points.map((point) => point.rating)];
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max(4, (rawMax - rawMin) * 0.16 || 10);
    const minValue = rawMin - padding;
    const maxValue = rawMax + padding;
    const valueSpan = maxValue - minValue || 1;
    const axisValues = [maxValue, (maxValue + minValue) / 2, minValue];
    const toY = (value) => top + ((maxValue - value) / valueSpan) * plotHeight;
    const plottedPoints = points.map((point, index) => ({
      ...point,
      x:
        points.length === 1
          ? left + plotWidth / 2
          : left + (index * plotWidth) / (points.length - 1),
      y: toY(point.rating),
    }));
    const turningIndexes = buildTurningPointIndexes(plottedPoints);
    const turningOrderByIndex = new Map(
      turningIndexes.map((pointIndex, turningOrder) => [pointIndex, turningOrder]),
    );
    const displayTurningIndexes = turningIndexes.filter(
      (pointIndex) => pointIndex > 0 && pointIndex < plottedPoints.length - 1,
    );
    const turningPointCandidates = displayTurningIndexes.map((pointIndex) => {
      const point = plottedPoints[pointIndex];
      const turningOrder = turningOrderByIndex.get(pointIndex) ?? -1;
      const previousBoundaryIndex = turningOrder > 0 ? turningIndexes[turningOrder - 1] : -1;
      const previousBoundaryPoint =
        previousBoundaryIndex >= 0 ? plottedPoints[previousBoundaryIndex] : null;
      const segmentDelta = point.rating - (previousBoundaryPoint?.rating ?? history.startRating);
      const culprit = getStageCulprit(
        plottedPoints,
        previousBoundaryIndex,
        pointIndex,
        playerMap,
        segmentDelta,
      );
      const kind = getTurningPointKind(plottedPoints, turningIndexes, turningOrder);
      const label = buildTurningPointLabel({
        ...point,
        segmentDelta,
        culpritName: culprit.name,
        culpritDelta: culprit.total,
      });

      return {
        ...point,
        kind,
        segmentDelta,
        culpritId: culprit.opponentId,
        culpritName: culprit.name,
        culpritDelta: culprit.total,
        labelLine1: label.line1,
        labelStageText: label.stageText,
        labelCulpritLineText: label.culpritLineText,
        labelCulpritDeltaLineText: label.culpritDeltaLineText,
        labelWidth: label.width,
        labelHeight: label.height,
      };
    });
    const annotations = buildTurningPointAnnotations(turningPointCandidates, plottedPoints, {
      minX: left + 4,
      maxX: width - right - 4,
      minY: top + 4,
      maxY: top + plotHeight - 4,
    });
    const turningPoints = turningPointCandidates.map((point, order) => ({
      ...point,
      ...annotations[order],
    }));

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      axisRows: axisValues.map((value) => ({ value, y: toY(value) })),
      baselineY: toY(history.startRating),
      polyline: plottedPoints.map((point) => `${point.x},${point.y}`).join(" "),
      firstDate: formatShortDate(points[0].dateISO),
      lastDate: formatShortDate(points[points.length - 1].dateISO),
      plottedPoints,
      turningPoints,
      turningPointIds: new Set(turningPoints.map((point) => point.matchId)),
    };
  }, [history.startRating, playerMap, points]);

  function showTooltip(event, point) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const tooltipWidth = 248;
    const tooltipHeight = 148;
    const left = Math.min(Math.max(localX + 16, 12), rect.width - tooltipWidth - 12);
    const top =
      localY < tooltipHeight + 28
        ? Math.min(localY + 16, rect.height - tooltipHeight - 12)
        : Math.max(localY - tooltipHeight - 16, 12);

    setTooltip({ point, left, top });
  }

  return (
    <section className="card playerFargoCard">
      <div className="playerFargoHead">
        <div>
          <div className="badge">全部比赛{INTERNAL_POINTS_NAME}历史走势</div>
          <p className="playerFargoSub">
            按全部比赛时间顺序回放，练习赛和直播都会共同影响这条积分曲线，虚线表示起始 500 基线。
          </p>
        </div>

        <div className="playerFargoMeta">
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">起始</span>
            <span className="playerFargoStatValue">{formatRating(history.startRating)}</span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">当前</span>
            <span className="playerFargoStatValue">{formatRating(history.currentRating)}</span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">净变化</span>
            <span
              className={`playerFargoStatValue ${
                history.netChange > 0 ? "isUp" : history.netChange < 0 ? "isDown" : ""
              }`}
            >
              {formatSignedRating(history.netChange)}
            </span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">最高</span>
            <span className="playerFargoStatValue">{formatRating(history.highestRating)}</span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">最低</span>
            <span className="playerFargoStatValue">{formatRating(history.lowestRating)}</span>
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="playerFargoEmpty">
          暂无{INTERNAL_POINTS_NAME}历史数据。先录入这位球员的比赛后，这里会自动生成全部比赛的积分曲线。
        </div>
      ) : (
        <div className="playerFargoCanvas" ref={canvasRef} onMouseLeave={() => setTooltip(null)}>
          <svg
            className="playerFargoSvg"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={`全部比赛${INTERNAL_POINTS_NAME}历史走势`}
          >
            {chart.axisRows.map(({ value, y }) => {
              return (
                <g key={value}>
                  <line
                    x1={chart.left}
                    y1={y}
                    x2={chart.width - chart.right}
                    y2={y}
                    style={{ stroke: "rgba(148, 163, 184, 0.26)" }}
                  />
                  <text
                    x={chart.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    style={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
                  >
                    {formatRating(value)}
                  </text>
                </g>
              );
            })}

            <line
              x1={chart.left}
              y1={chart.baselineY}
              x2={chart.width - chart.right}
              y2={chart.baselineY}
              strokeDasharray="6 6"
              style={{ stroke: "rgba(37, 99, 235, 0.28)" }}
            />

            {chart.plottedPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={chart.polyline}
              />
            )}

            {chart.turningPoints.map((point) => {
              const accentColor =
                point.segmentDelta > 0
                  ? "rgba(37, 99, 235, 0.92)"
                  : point.segmentDelta < 0
                    ? "rgba(244, 63, 94, 0.92)"
                    : "rgba(71, 85, 105, 0.9)";
              const labelCenterX = point.box.x + point.box.width / 2;

              return (
                <g key={`turning-${point.matchId}`} pointerEvents="none">
                  <line
                    x1={point.x}
                    y1={point.y}
                    x2={point.anchorX}
                    y2={point.anchorY}
                    stroke={accentColor}
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    opacity="0.72"
                  />
                  <text
                    x={labelCenterX}
                    y={point.box.y + TURNING_POINT_FONT_SIZE}
                    textAnchor="middle"
                    style={{
                      fill: "rgba(15, 23, 42, 0.88)",
                      fontSize: TURNING_POINT_FONT_SIZE,
                      fontWeight: 800,
                      paintOrder: "stroke",
                      stroke: "rgba(255, 255, 255, 0.96)",
                      strokeWidth: "3px",
                      strokeLinejoin: "round",
                    }}
                  >
                    <tspan x={labelCenterX} dy="0">
                      {point.labelLine1}
                    </tspan>
                    <tspan fill={accentColor} fontWeight="900">
                      {" "}{point.labelStageText}
                    </tspan>
                    <tspan x={labelCenterX} dy={TURNING_POINT_LINE_HEIGHT}>
                      {point.labelCulpritLineText}
                    </tspan>
                    <tspan x={labelCenterX} dy={TURNING_POINT_LINE_HEIGHT} fill={accentColor} fontWeight="900">
                      {point.labelCulpritDeltaLineText}
                    </tspan>
                  </text>
                </g>
              );
            })}

            {chart.plottedPoints.map((point) => (
              <g key={point.matchId}>
                {chart.turningPointIds.has(point.matchId) && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="8"
                    fill="rgba(255,255,255,0.7)"
                    stroke={point.delta >= 0 ? "rgba(37, 99, 235, 0.38)" : "rgba(244, 63, 94, 0.38)"}
                    strokeWidth="2.2"
                  />
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5.5"
                  fill={point.delta >= 0 ? "var(--primary)" : "var(--danger)"}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="16"
                  fill="rgba(0,0,0,0)"
                  onMouseEnter={(event) => showTooltip(event, point)}
                  onMouseMove={(event) => showTooltip(event, point)}
                />
              </g>
            ))}

            <text
              x={chart.left}
              y={chart.height - 8}
              textAnchor="start"
              style={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
            >
              {chart.firstDate}
            </text>
            <text
              x={chart.width - chart.right}
              y={chart.height - 8}
              textAnchor="end"
              style={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
            >
              {chart.lastDate}
            </text>
          </svg>

          {tooltip && (
            <div
              className="playerFargoTooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              <div className="playerFargoTooltipDate">{formatDate(tooltip.point.dateISO)}</div>
              <div className="playerFargoTooltipMetrics">
                <div className="playerFargoTooltipMetric">
                  <span>{INTERNAL_POINTS_NAME}</span>
                  <strong>{formatRating(tooltip.point.rating)}</strong>
                </div>
                <div className="playerFargoTooltipMetric">
                  <span>变化</span>
                  <strong
                    className={
                      tooltip.point.delta > 0 ? "isUp" : tooltip.point.delta < 0 ? "isDown" : ""
                    }
                  >
                    {formatSignedRating(tooltip.point.delta)}
                  </strong>
                </div>
              </div>
              <div className="playerFargoTooltipInfo">
                {tooltip.point.tag === "live" ? "直播" : "练习赛"} · 对手{" "}
                {playerMap.get(tooltip.point.opponentId)?.name ?? "Unknown"}
              </div>
              <div className="playerFargoTooltipInfo">
                比分 {formatCount(tooltip.point.myScore)} : {formatCount(tooltip.point.opponentScore)}
              </div>
              <div className="playerFargoTooltipMatch">{tooltip.point.matchName}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OpponentCard({ title, list, playerMap, seasonQuery }) {
  return (
    <div className="card playerDetailOpponentCard">
      <div className="rowBetween playerDetailCardHead">
        <div className="badge">{title}</div>
      </div>

      {list.length === 0 ? (
        <div className="playerDetailEmpty">暂无</div>
      ) : (
        <ul className="playerDetailOpponentList">
          {list.map((item) => (
            <li key={item.opponentId}>
              <Link to={`/players/${item.opponentId}${seasonQuery}`}>{playerMap.get(item.opponentId)?.name ?? "Unknown"}</Link>
              <span> × {formatCount(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchTable({ stats, playerId, playerMap, seasonQuery }) {
  return (
    <div className="card playerDetailTableCard">
      <div className="rowBetween playerDetailCardHead">
        <div className="badge">比赛记录</div>
        <div className="badge">共 {stats.matches.length} 场</div>
      </div>

      <div className="tableWrap playerDetailTableWrap">
        <table className="playerDetailTable">
          <thead>
            <tr>
              <th>比赛名称</th>
              <th>时间</th>
              <th>赛制</th>
              <th>对手</th>
              <th>比分</th>
              <th>是否放门</th>
              <th>放门方</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            {stats.matches.length === 0 ? (
              <tr>
                <td colSpan="8" className="playerDetailEmpty">
                  暂无记录
                </td>
              </tr>
            ) : (
              stats.matches.map((match) => {
                const isLeft = match.leftPlayerId === playerId;
                const meScore = isLeft ? match.leftScore : match.rightScore;
                const opponentScore = isLeft ? match.rightScore : match.leftScore;
                const opponentId = isLeft ? match.rightPlayerId : match.leftPlayerId;
                const opponent = playerMap.get(opponentId);
                const handicapLabel = match.isHandicap ? "是" : "否";
                const handicapGiver = match.isHandicap
                  ? (playerMap.get(match.handicapGiverId)?.name ?? "Unknown")
                  : "-";
                const result = !match.winnerId ? "-" : match.winnerId === playerId ? "Win" : "Loss";

                return (
                  <tr key={match.id}>
                    <td className="playerDetailMatchName">{match.matchName ?? "未命名比赛"}</td>
                    <td>{formatDate(match.dateISO)}</td>
                    <td>抢 {match.raceTo}</td>
                    <td>
                      <Link to={`/players/${opponentId}${seasonQuery}`}>{opponent?.name ?? "Unknown"}</Link>
                    </td>
                    <td>
                      {meScore} : {opponentScore}
                    </td>
                    <td>{handicapLabel}</td>
                    <td>{handicapGiver}</td>
                    <td className="playerDetailResult">{result}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, stats, playerId, playerMap, seasonQuery }) {
  return (
    <section className="card playerDetailSection">
      <div className="rowBetween playerDetailSectionHead">
        <div className="badge">{title}</div>
        <Link className="btn btnBrand" to="/new">
          立即新建比赛
        </Link>
      </div>

      <div className="playerDetailSplit">
        <div className="playerDetailStatsColumn">
          <div className="playerDetailKpiGrid">
            <SummaryCard label="总场次" value={formatCount(stats.total)} />
            <SummaryCard label="胜场" value={formatCount(stats.wins)} />
            <SummaryCard label="负场" value={formatCount(stats.losses)} />
            <SummaryCard label="胜率" value={formatPercent(stats.winRate)} />
          </div>

          <div className="playerDetailOpponentGrid">
            <OpponentCard title="战胜的对手（次数）" list={stats.beatenList} playerMap={playerMap} seasonQuery={seasonQuery} />
            <OpponentCard title="战败的对手（次数）" list={stats.lostToList} playerMap={playerMap} seasonQuery={seasonQuery} />
          </div>
        </div>

        <MatchTable stats={stats} playerId={playerId} playerMap={playerMap} seasonQuery={seasonQuery} />
      </div>
    </section>
  );
}

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tick, setTick] = useState(0);

  const players = useMemo(() => getPlayers(), [tick]);
  const allMatches = useMemo(() => getMatches("all"), [tick]);
  const seasons = useMemo(() => getAvailableSeasons(allMatches), [allMatches]);
  const selectedSeasonId = normalizeSeasonId(searchParams.get("season") ?? "all");
  const matches = useMemo(
    () => filterMatchesBySeason(allMatches, selectedSeasonId),
    [allMatches, selectedSeasonId],
  );
  const playerMap = useMemo(() => new Map(players.map((item) => [item.id, item])), [players]);
  const player = playerMap.get(playerId) ?? null;
  const statsPractice = useMemo(
    () => calcPlayerStats(playerId, { tag: "practice", _matches: matches }),
    [playerId, matches],
  );
  const statsLive = useMemo(
    () => calcPlayerStats(playerId, { tag: "live", _matches: matches }),
    [playerId, matches],
  );
  const fargoHistory = useMemo(
    () => getPlayerFargoRatingHistory(playerId, { _players: players, _matches: matches }),
    [playerId, players, matches],
  );
  const seasonQuery = selectedSeasonId === "all" ? "" : `?season=${selectedSeasonId}`;

  function handleSeasonChange(nextSeasonId) {
    const normalized = normalizeSeasonId(nextSeasonId);
    const nextParams = new URLSearchParams(searchParams);
    if (normalized === "all") nextParams.delete("season");
    else nextParams.set("season", normalized);
    setSearchParams(nextParams, { replace: true });
  }

  if (!player) {
    return (
      <div className="card">
        <div className="rowBetween">
          <div>
            <h1 className="h1">球员不存在</h1>
            <p className="sub">该球员可能已经被删除。</p>
          </div>
          <Link className="btn" to="/players">
            返回球员列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="h1">{player.name}</h1>
          <p className="sub">分标签战绩：练习赛 + 直播（无平局） · {seasonLabel(selectedSeasonId)}</p>
        </div>

        <div className="row">
          <select
            className="input playerDetailSeasonSelect"
            value={selectedSeasonId}
            onChange={(event) => handleSeasonChange(event.target.value)}
          >
            <option value="all">全部赛季</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setTick((value) => value + 1)} type="button">
            刷新
          </button>
          <Link className="btn" to="/players">
            返回
          </Link>
        </div>
      </div>

      <FargoHistoryChart history={fargoHistory} playerMap={playerMap} />
      <Section title="练习赛统计与记录" stats={statsPractice} playerId={playerId} playerMap={playerMap} seasonQuery={seasonQuery} />
      <Section title="直播统计与记录" stats={statsLive} playerId={playerId} playerMap={playerMap} seasonQuery={seasonQuery} />
    </div>
  );
}
