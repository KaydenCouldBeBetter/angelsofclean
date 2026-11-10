"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { HOME_BASE_TOWN, SERVICE_AREA_COORDS, SERVICE_AREA_MAP, SERVICE_AREA_TOWNS } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

// The Areas page's "Service Area Map" (Figma 674:167): a free, interactive
// OpenStreetMap map (Leaflet, no account or API key) with a pin on each town in
// SERVICE_AREA_TOWNS. Town positions live in SERVICE_AREA_COORDS
// (lib/homepage-content.ts). Map tiles come from tile.openstreetmap.org, which
// the Content-Security-Policy allows for public pages only (lib/csp.ts).
// Stacked it has a fixed height; from 1024px it is as tall as its parent
// column lets it be (the parent is a flex column), never under 24rem.
//
// Leaflet touches `window`, so it is loaded inside the effect, never on the
// server. Until it loads (or if it can't) the box shows its label, and the
// towns are also listed as text above the map on the page.

// Leaflet draws SVG with plain colour values, so the brand teal is read from
// the --primary token at runtime (app/globals.css is its one source).
function brandColor(el: HTMLElement): string {
  return getComputedStyle(el).getPropertyValue("--primary").trim() || "teal";
}

// Which side of its pin each town's label sits on, so the labels in the crowded
// middle (Liverpool, Solvay, Syracuse, Camillus) don't pile on top of each other.
const LABEL_SIDE: Record<string, "top" | "left" | "right"> = {
  Brewerton: "right",
  Cicero: "right",
  Baldwinsville: "left",
  Liverpool: "top",
  Solvay: "left",
  Syracuse: "right",
  Camillus: "left",
  Marcellus: "left",
  Manlius: "top",
};

export default function ServiceAreaMap({ className }: { className?: string }) {
  const mapEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mapEl.current;
    if (!el) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    import("leaflet")
      .then((L) => {
        if (cancelled) return;

        const map = L.map(el, {
          // Don't hijack page scrolling: wheel/trackpad scrolls the page, the
          // +/- buttons, double-click and pinch still zoom.
          scrollWheelZoom: false,
          // One finger scrolls the page on touch screens; two fingers pan.
          dragging: !L.Browser.mobile,
        });

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        const pinColor = brandColor(el);
        // On a narrow map nine always-on labels pile up, so there each pin shows
        // its name (and coverage note) when tapped instead.
        const showLabels = el.clientWidth >= 480;
        const points: [number, number][] = [];
        for (const { town, note } of SERVICE_AREA_TOWNS) {
          const coords = SERVICE_AREA_COORDS[town];
          if (!coords) continue;
          points.push(coords);
          const home = town === HOME_BASE_TOWN;
          const label = document.createElement("span");
          label.textContent = home ? `${town} (home base)` : town;
          const pin = L.circleMarker(coords, {
            radius: home ? 11 : 8,
            color: "#ffffff",
            weight: 2,
            fillColor: pinColor,
            fillOpacity: 1,
          }).addTo(map);
          const direction = LABEL_SIDE[town] ?? "top";
          const gap = direction === "left" ? [-10, 0] : direction === "right" ? [10, 0] : [0, -8];
          pin.bindTooltip(label, { permanent: showLabels, direction, offset: gap as [number, number] });
          const popup = document.createElement("div");
          const name = document.createElement("strong");
          name.textContent = town;
          const text = document.createElement("div");
          text.textContent = note;
          popup.append(name, text);
          pin.bindPopup(popup);
        }

        map.fitBounds(L.latLngBounds(points), { padding: [56, 40] });
        teardown = () => map.remove();
      })
      .catch(() => {
        // Offline or blocked: the labelled box below stays as it is.
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div
      role="region"
      aria-label="Service area map"
      className={cn(
        // isolate: keeps Leaflet's own z-indexes (up to 1000) beneath the sticky header.
        "relative isolate h-80 overflow-hidden rounded-xl border border-line bg-surface-tint text-sm font-medium text-ink-muted md:h-96 lg:h-auto lg:min-h-96 lg:flex-1",
        className,
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span>Service Area Map</span>
        {SERVICE_AREA_MAP.placeholder && <PlaceholderBadge />}
      </div>
      <div ref={mapEl} className="absolute inset-0" />
    </div>
  );
}
