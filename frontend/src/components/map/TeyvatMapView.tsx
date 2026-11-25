import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Download,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Search,
  Upload,
  X,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchMapConfig,
  fetchMapPointDetail,
  fetchMapPoints,
} from "@/services/api";
import type {
  MapConfigResponse,
  MapLabelNode,
  MapPoint,
  MapPointDetail,
} from "@/types/genshin";

const MAP_REALMS = [
  { id: 2, label: "Teyvat" },
  { id: 7, label: "Enkanomiya" },
  { id: 9, label: "The Chasm" },
  { id: 34, label: "Sea of Bygone Eras" },
  { id: 36, label: "Ancient Sacred Mountain" },
];

const PIN_COLORS = [
  "#246A56",
  "#9C7A3C",
  "#3A7CA5",
  "#C25338",
  "#7A56B0",
  "#4E8C42",
];

function getPinColor(labelId: number): string {
  return PIN_COLORS[labelId % PIN_COLORS.length];
}

export function TeyvatMapView() {
  const [mapId, setMapId] = useState(2);
  const [config, setConfig] = useState<MapConfigResponse | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [catSearch, setCatSearch] = useState("");
  const [hideFound, setHideFound] = useState(false);
  const [layerFilter, setLayerFilter] = useState<"all" | "surface" | "underground">("all");
  const [showSidebar, setShowSidebar] = useState(true);

  const storageKey = `irminix:map_found:${mapId}`;
  const [foundIds, setFoundIds] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const [activePoint, setActivePoint] = useState<MapPoint | null>(null);
  const [activePointDetail, setActivePointDetail] = useState<MapPointDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setFoundIds(raw ? new Set(JSON.parse(raw) as number[]) : new Set());
    } catch {
      setFoundIds(new Set());
    }
  }, [storageKey]);

  // Load fast map config & category tree
  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    setError(null);
    setSelectedLabels([]);
    setPoints([]);
    setActivePoint(null);
    setActivePointDetail(null);
    setLayerFilter("all");

    fetchMapConfig(mapId)
      .then((res) => {
        if (cancelled) return;
        setConfig(res);
        const initialExpand = new Set<number>(
          res.categories.slice(0, 2).map((c) => c.id)
        );
        setExpandedGroups(initialExpand);
        const firstLeaf = res.categories[0]?.children[0]?.id;
        if (firstLeaf) setSelectedLabels([firstLeaf]);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load map.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mapId]);

  // Initialize Leaflet with viewport lazy-loading for slices
  useEffect(() => {
    if (!config || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const [totalW, totalH] = config.totalSize;
    const [originX, originY] = config.origin;
    const rows = config.slices.length || 1;
    const cols = config.slices[0]?.length || 1;
    const sliceW = totalW / cols;
    const sliceH = totalH / rows;

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -4,
      maxZoom: 2,
      zoomSnap: 0.25,
      preferCanvas: true,
      attributionControl: false,
      maxBounds: [
        [-totalH - 2000, -2000],
        [2000, totalW + 2000],
      ],
    });

    // Start zoomed into center/origin so browser loads ~6 slices instead of 110 at once
    map.setView([-(originY || totalH / 2), originX || totalW / 2], -2);

    const loadedSlices = new Set<string>();
    const syncVisibleSlices = () => {
      const viewBounds = map.getBounds().pad(0.25);
      config.slices.forEach((row, r) => {
        row.forEach((url, c) => {
          if (!url) return;
          const key = `${r}:${c}`;
          if (loadedSlices.has(key)) return;
          const sliceBounds = L.latLngBounds(
            [-((r + 1) * sliceH), c * sliceW],
            [-(r * sliceH), (c + 1) * sliceW]
          );
          if (viewBounds.intersects(sliceBounds)) {
            loadedSlices.add(key);
            const overlay = L.imageOverlay(url, sliceBounds).addTo(map);
            const imgEl = overlay.getElement();
            if (imgEl && layerFilter === "underground") {
              imgEl.style.filter = "brightness(0.45) saturate(0.75)";
            }
          }
        });
      });
    };

    syncVisibleSlices();
    map.on("moveend zoomend", syncVisibleSlices);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.off("moveend zoomend", syncVisibleSlices);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [config]);

  // Fetch pins for selected categories
  useEffect(() => {
    if (!config) return;
    if (selectedLabels.length === 0) {
      setPoints([]);
      return;
    }

    let cancelled = false;
    setLoadingPoints(true);
    fetchMapPoints(mapId, selectedLabels)
      .then((res) => {
        if (!cancelled) setPoints(res.points);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPoints(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config, mapId, selectedLabels]);

  // Visually dim map tiles when inspecting Underground pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const tilePane = map.getPane("overlayPane");
    if (!tilePane) return;
    const imgs = tilePane.querySelectorAll("img.leaflet-image-layer");
    imgs.forEach((img) => {
      const el = img as HTMLElement;
      el.style.transition = "filter 220ms ease";
      el.style.filter =
        layerFilter === "underground" ? "brightness(0.45) saturate(0.75)" : "none";
    });
  }, [layerFilter, points]);

  // Render markers on Leaflet Canvas with layer & found filters
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer || !config) return;
    layer.clearLayers();

    const [originX, originY] = config.origin;
    const canvasRenderer = L.canvas({ padding: 0.5 });

    for (const pt of points) {
      const isFound = foundIds.has(pt.id);
      if (hideFound && isFound) continue;
      const z = pt.zLevel ?? 0;
      if (layerFilter === "surface" && z > 0) continue;
      if (layerFilter === "underground" && z === 0) continue;

      const lat = -(originY + pt.y);
      const lng = originX + pt.x;
      const color = isFound ? "#8A948E" : getPinColor(pt.labelId);

      const marker = L.circleMarker([lat, lng], {
        renderer: canvasRenderer,
        radius: isFound ? 5 : 6.5,
        color: "#FFFFFF",
        weight: 1.5,
        fillColor: color,
        fillOpacity: isFound ? 0.45 : 0.92,
      });

      marker.on("click", () => {
        setActivePoint(pt);
        setActivePointDetail(null);
        setLoadingDetail(true);
        fetchMapPointDetail(pt.id, mapId)
          .then(setActivePointDetail)
          .finally(() => setLoadingDetail(false));
      });

      marker.addTo(layer);
    }
  }, [points, foundIds, hideFound, layerFilter, config, mapId]);

  const labelLookup = useMemo(() => {
    const map = new Map<number, MapLabelNode>();
    const walk = (nodes: MapLabelNode[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        walk(n.children);
      }
    };
    if (config) walk(config.categories);
    return map;
  }, [config]);

  const toggleLabel = (id: number) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleFound = (pointId: number) => {
    setFoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(pointId)) next.delete(pointId);
      else next.add(pointId);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleJumpToRegion = (anchorId: string) => {
    if (!config || !mapInstanceRef.current || !anchorId) return;
    const anchor = config.anchors?.find((a) => a.id === anchorId);
    if (!anchor) return;
    const [originX, originY] = config.origin;
    mapInstanceRef.current.flyTo([-(originY + anchor.y), originX + anchor.x], -1, {
      duration: 0.6,
    });
  };

  const handleExportProgress = () => {
    const payload = JSON.stringify({ mapId, foundIds: Array.from(foundIds) }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `irminix-map-${mapId}-progress.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProgress = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed.foundIds)) {
          const next = new Set<number>(parsed.foundIds.map(Number));
          setFoundIds(next);
          localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        }
      } catch {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filteredCategories = useMemo(() => {
    if (!config) return [];
    const q = catSearch.trim().toLowerCase();
    if (!q) return config.categories;
    return config.categories
      .map((cat) => ({
        ...cat,
        children: cat.children.filter((ch) => ch.name.toLowerCase().includes(q)),
      }))
      .filter(
        (cat) => cat.name.toLowerCase().includes(q) || cat.children.length > 0
      );
  }, [config, catSearch]);

  if (loadingConfig) return <LoadingSpinner label="Loading Teyvat Interactive Map..." />;
  if (error || !config) {
    return (
      <div className="rounded-2xl border border-[#E8C5BC] bg-[#FBF0ED] p-6 text-sm text-[#9A3B26]">
        {error || "Unable to load interactive map."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {MAP_REALMS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setMapId(r.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  mapId === r.id
                    ? "bg-irminsul text-white shadow-sm"
                    : "bg-surface-subtle text-ink-secondary hover:text-ink-primary"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          {config.anchors && config.anchors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-irminsul" />
              <select
                defaultValue=""
                onChange={(e) => handleJumpToRegion(e.target.value)}
                className="rounded-xl border border-border bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink-primary focus:border-irminsul focus:outline-none"
              >
                <option value="" disabled>
                  Jump to Region...
                </option>
                {config.anchors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
          {/* Layer Filter */}
          <div className="flex items-center gap-1 rounded-xl bg-surface-subtle p-1">
            <Layers className="ml-1.5 h-3.5 w-3.5 text-ink-dim" />
            {(
              [
                { id: "all", label: "All Layers" },
                { id: "surface", label: "Surface" },
                { id: "underground", label: "Underground" },
              ] as const
            ).map((lf) => (
              <button
                key={lf.id}
                type="button"
                onClick={() => setLayerFilter(lf.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  layerFilter === lf.id
                    ? "bg-surface text-irminsul shadow-sm"
                    : "text-ink-secondary hover:text-ink-primary"
                )}
              >
                {lf.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSidebar((prev) => !prev)}
            >
              <Filter className="h-3.5 w-3.5" />
              {showSidebar ? "Hide Pins" : "Show Pins"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHideFound((prev) => !prev)}
            >
              {hideFound ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {hideFound ? "Show Found" : "Hide Found"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportProgress} title="Export Progress JSON">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Import Progress JSON"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportProgress}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Map Workspace */}
      <div className="relative flex flex-col gap-4 lg:h-[72vh] lg:flex-row">
        {/* Category Sidebar */}
        {showSidebar && (
          <aside className="flex max-h-80 w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card lg:max-h-none lg:w-80 lg:shrink-0">
            <div className="border-b border-border-subtle p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim" />
                <input
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="Search Chests, Oculi, Materials..."
                  className="w-full rounded-xl border border-border bg-canvas py-2 pl-8 pr-8 text-xs text-ink-primary placeholder:text-ink-dim focus:border-irminsul focus:outline-none"
                />
                {catSearch && (
                  <button
                    type="button"
                    onClick={() => setCatSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-dim">
                <span>{foundIds.size} marked found</span>
                {selectedLabels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedLabels([])}
                    className="font-medium text-irminsul hover:underline"
                  >
                    Clear ({selectedLabels.length})
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {filteredCategories.map((cat) => {
                const isExpanded = expandedGroups.has(cat.id) || catSearch.trim() !== "";
                return (
                  <div key={cat.id} className="rounded-xl">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat.id)) next.delete(cat.id);
                          else next.add(cat.id);
                          return next;
                        })
                      }
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-ink-primary hover:bg-surface-subtle"
                    >
                      <span className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-ink-dim" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-ink-dim" />
                        )}
                        {cat.name}
                      </span>
                    </button>

                    {isExpanded && cat.children.length > 0 && (
                      <div className="ml-3 space-y-0.5 border-l border-border-subtle pb-1 pl-2">
                        {cat.children.map((child) => {
                          const active = selectedLabels.includes(child.id);
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => toggleLabel(child.id)}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                                active
                                  ? "bg-irminsul-soft font-medium text-irminsul"
                                  : "text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {child.icon ? (
                                  <img
                                    src={child.icon}
                                    alt={child.name}
                                    className="h-4 w-4 shrink-0 object-contain"
                                  />
                                ) : (
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: getPinColor(child.id) }}
                                  />
                                )}
                                <span className="truncate">{child.name}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Map Canvas */}
        <div className="relative h-[60vh] min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-[#1D2433] shadow-card lg:h-full">
          <div ref={mapContainerRef} className="h-full w-full" />

          {loadingPoints && (
            <div className="absolute left-3 top-3 z-[400] inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-1 text-xs font-medium text-ink-primary shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-irminsul" />
              Loading pins...
            </div>
          )}

          {/* Selected Pin Inspector */}
          {activePoint && (
            <div className="absolute bottom-3 left-3 right-3 z-[400] rounded-2xl border border-border bg-surface/95 p-4 shadow-hover backdrop-blur-md sm:left-auto sm:w-80">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-irminsul" />
                  <h3 className="font-heading text-sm font-semibold text-ink-primary">
                    {labelLookup.get(activePoint.labelId)?.name || "Map Marker"}
                  </h3>
                  {(activePoint.zLevel ?? 0) > 0 && (
                    <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary">
                      Underground
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActivePoint(null)}
                  className="text-ink-dim hover:text-ink-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loadingDetail ? (
                <p className="mt-2 text-xs text-ink-dim">Loading pin details...</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {activePointDetail?.img && (
                    <img
                      src={activePointDetail.img}
                      alt="Location guide"
                      className="max-h-36 w-full rounded-xl border border-border-subtle object-cover"
                    />
                  )}
                  <p className="text-xs leading-relaxed text-ink-secondary">
                    {activePointDetail?.content || "No community notes for this marker yet."}
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
                <span className="font-mono text-[10px] text-ink-dim">
                  Pin #{activePoint.id}
                </span>
                <Button
                  size="sm"
                  variant={foundIds.has(activePoint.id) ? "secondary" : "primary"}
                  onClick={() => toggleFound(activePoint.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  {foundIds.has(activePoint.id) ? "Marked Found" : "Mark as Found"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
