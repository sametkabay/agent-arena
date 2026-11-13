import type { MapThumbnailModel } from "@/lib/maps/mapThumbnail";

interface MapThumbnailProps {
  model: MapThumbnailModel;
  className?: string;
}

/** Inline SVG top-down map preview (aria-hidden — parent button labels it). */
export function MapThumbnail({ model, className }: MapThumbnailProps) {
  return (
    <svg
      className={className}
      viewBox={model.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      style={{ backgroundColor: model.background }}
    >
      <rect
        width="100%"
        height="100%"
        fill={model.background}
      />
      <rect
        x={model.floor.x}
        y={model.floor.y}
        width={model.floor.w}
        height={model.floor.h}
        fill={model.floor.fill}
      />
      {model.zones.map((z, i) =>
        z.w != null && z.h != null && z.w > 0 && z.h > 0 ? (
          <rect
            key={`z-${i}`}
            x={z.cx - z.w / 2}
            y={z.cy - z.h / 2}
            width={z.w}
            height={z.h}
            fill={z.fill}
            fillOpacity={0.25}
          />
        ) : (
          <circle
            key={`z-${i}`}
            cx={z.cx}
            cy={z.cy}
            r={z.r}
            fill={z.fill}
            fillOpacity={0.25}
          />
        ),
      )}
      {model.props.map((p, i) => {
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        return (
          <rect
            key={`p-${i}`}
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            fill={p.fill}
            transform={`rotate(${p.rotate} ${cx} ${cy})`}
          />
        );
      })}
    </svg>
  );
}
