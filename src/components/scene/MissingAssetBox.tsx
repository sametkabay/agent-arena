import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BoxGeometry, CanvasTexture, DoubleSide, LinearFilter } from "three";
import { shortUserAssetLabel } from "@/lib/userAssets/ids";

function makeLabelTexture(text: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(12, 16, 24, 0.94)";
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(12, 28, canvas.width - 24, 104, 16);
    ctx.fill();
  } else {
    ctx.fillRect(12, 28, canvas.width - 24, 104);
  }
  ctx.strokeStyle = "rgba(230, 236, 245, 0.7)";
  ctx.lineWidth = 4;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(12, 28, canvas.width - 24, 104, 16);
    ctx.stroke();
  }
  ctx.font = "700 44px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#f7f9fc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = text.length > 32 ? `${text.slice(0, 31)}…` : text;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Shared unit box for EdgesGeometry — module lifetime (not disposed per mount). */
const EDGE_SOURCE = new BoxGeometry(1, 1, 1);

/** 1 m translucent box + CanvasTexture name tag (no drei Text / CDN fonts). */
export function MissingAssetBox({
  name,
  id,
}: {
  name?: string;
  id: string;
}) {
  const { t } = useTranslation();
  const missingWord = t("mapEditor.customAssets.missingLabel");
  const label = name?.trim()
    ? `${name.trim()} (${missingWord})`
    : `${shortUserAssetLabel(id)} (${missingWord})`;

  // Keep texture alive across StrictMode remounts (no dispose-in-effect).
  const tex = useMemo(() => makeLabelTexture(label), [label]);

  return (
    <group>
      <mesh position={[0, 0.5, 0]} renderOrder={1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#9aabbf"
          transparent
          opacity={0.58}
          side={DoubleSide}
          emissive="#445566"
          emissiveIntensity={0.65}
          depthWrite={false}
        />
      </mesh>
      <lineSegments position={[0, 0.5, 0]} renderOrder={8}>
        <edgesGeometry args={[EDGE_SOURCE]} />
        <lineBasicMaterial
          color="#f2f6fb"
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <mesh position={[0, 0.5, 0]} renderOrder={7}>
        <boxGeometry args={[1.02, 1.02, 1.02]} />
        <meshBasicMaterial
          color="#d8e2ef"
          wireframe
          transparent
          opacity={0.85}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <sprite position={[0, 1.55, 0]} scale={[2.6, 0.54, 1]} renderOrder={20}>
        <spriteMaterial
          map={tex}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}
