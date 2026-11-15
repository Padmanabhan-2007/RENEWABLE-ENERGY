import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ScatterPoint3D } from "../types";
import { RotateCcw, Info } from "lucide-react";

interface Props {
  points: ScatterPoint3D[];
  selectedK?: number;
  note?: string;
  selectedSeason?: string;
}

const CLUSTER_COLORS = [
  "#1A237E", // Cluster 1: Navy
  "#00695C", // Cluster 2: Teal
  "#B78B24", // Cluster 3: Warm Gold
  "#887BB0", // Cluster 4: Lavender
  "#D9534F", // Cluster 5: Muted Coral
];

export const PcaScatter3D: React.FC<Props> = ({ points, selectedK = 2, note }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint3D | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState<number>(points.length);

  const resetCameraRef = useRef<() => void>(() => {});

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 700;
    const height = 480;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#FAF9F6");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const initialPos = new THREE.Vector3(12, 9, 15);
    camera.position.copy(initialPos);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight("#FFFFFF", 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#FFFFFF", 0.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 3. Coordinate Axes & Grid Boxes
    const gridHelper = new THREE.GridHelper(12, 12, "#1A237E", "#E5E1DA");
    gridHelper.position.y = -4;
    scene.add(gridHelper);

    // Axes lines
    const createAxisLine = (start: THREE.Vector3, end: THREE.Vector3, color: string) => {
      const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
      const mat = new THREE.LineBasicMaterial({ color, opacity: 0.6, transparent: true, linewidth: 2 });
      return new THREE.Line(geo, mat);
    };
    scene.add(createAxisLine(new THREE.Vector3(-6, -4, 0), new THREE.Vector3(6, -4, 0), "#1A237E")); // PC1 (Navy)
    scene.add(createAxisLine(new THREE.Vector3(0, -4, 0), new THREE.Vector3(0, 6, 0), "#00695C"));  // PC2 (Teal)
    scene.add(createAxisLine(new THREE.Vector3(0, -4, -6), new THREE.Vector3(0, -4, 6), "#887BB0")); // PC3 (Lavender)

    // 4. Points Cloud
    const filteredPoints = activeCluster !== null
      ? points.filter((p) => p.cluster === activeCluster)
      : points;

    setPointCount(filteredPoints.length);

    const count = filteredPoints.length;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    filteredPoints.forEach((pt, i) => {
      // Scale coordinates for clear 3D viewing
      positions[i * 3] = pt.pc1 * 1.4;
      positions[i * 3 + 1] = pt.pc2 * 1.4;
      positions[i * 3 + 2] = pt.pc3 * 1.4;

      const cColor = new THREE.Color(CLUSTER_COLORS[pt.cluster % CLUSTER_COLORS.length]);
      colors[i * 3] = cColor.r;
      colors[i * 3 + 1] = cColor.g;
      colors[i * 3 + 2] = cColor.b;
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Custom circle point sprite
    const createCircleTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    const material = new THREE.PointsMaterial({
      size: 0.45,
      vertexColors: true,
      map: createCircleTexture(),
      transparent: true,
      alphaTest: 0.1,
      opacity: 0.9,
    });

    const pointsMesh = new THREE.Points(geometry, material);
    scene.add(pointsMesh);

    // 5. Interactive Orbit Controls (Mouse Drag & Zoom)
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = new THREE.Spherical().setFromVector3(camera.position);

    resetCameraRef.current = () => {
      spherical.setFromVector3(initialPos);
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (isDragging) {
        const deltaX = e.clientX - prevMouse.x;
        const deltaY = e.clientY - prevMouse.y;

        spherical.theta -= deltaX * 0.008;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - deltaY * 0.008));

        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);

        prevMouse = { x: e.clientX, y: e.clientY };
        renderer.render(scene, camera);
      } else {
        // Raycast for hover tooltip
        const ndcX = (mouseX / width) * 2 - 1;
        const ndcY = -(mouseY / height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 0.5;
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

        const intersects = raycaster.intersectObject(pointsMesh);
        if (intersects.length > 0 && intersects[0].index !== undefined) {
          const ptIdx = intersects[0].index;
          setHoveredPoint(filteredPoints[ptIdx]);
          setTooltipPos({ x: mouseX + 15, y: mouseY + 15 });
        } else {
          setHoveredPoint(null);
        }
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(6, Math.min(35, spherical.radius + e.deltaY * 0.015));
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    domElement.addEventListener("wheel", handleWheel, { passive: false });

    renderer.render(scene, camera);

    const handleResize = () => {
      if (!mount) return;
      const newW = mount.clientWidth;
      camera.aspect = newW / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, height);
      renderer.render(scene, camera);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      domElement.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      domElement.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [points, activeCluster]);

  return (
    <div className="relative w-full bg-white border border-[#E5E1DA] rounded-xl overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between p-4 border-b border-[#E5E1DA] bg-[#FAF9F6]">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-[#1A237E] font-serif">
              Interactive 3D PCA Space (PC1 • PC2 • PC3)
            </h3>
            <span className="text-xs bg-[#00695C]/10 text-[#00695C] px-2.5 py-0.5 rounded-full font-medium">
              {pointCount} Sample Points
            </span>
          </div>
          <p className="text-xs text-[#5F5F5F] mt-0.5">
            Rotatable & zoomable point cloud with soft GMM posterior regime coloring
          </p>
        </div>

        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <button
            onClick={() => resetCameraRef.current()}
            className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-[#FAF9F6] text-[#252525] border border-[#E5E1DA] rounded-md text-xs font-medium cursor-pointer transition shadow-2xs"
            title="Reset to default viewpoint"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#00695C]" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Mount */}
      <div className="relative w-full h-[480px]">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-white/95 backdrop-blur-xs p-3 rounded-lg border border-[#E5E1DA] shadow-lg text-xs w-64 transition-all"
            style={{
              left: Math.min(tooltipPos.x, (mountRef.current?.clientWidth || 600) - 270),
              top: Math.min(tooltipPos.y, 350),
            }}
          >
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-1.5 mb-2">
              <span
                className="font-bold text-[13px] flex items-center space-x-1.5"
                style={{ color: CLUSTER_COLORS[hoveredPoint.cluster % CLUSTER_COLORS.length] }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: CLUSTER_COLORS[hoveredPoint.cluster % CLUSTER_COLORS.length] }}
                />
                <span>{hoveredPoint.cluster_label}</span>
              </span>
              <span className="text-[11px] font-mono text-[#5F5F5F]">{hoveredPoint.timestamp.slice(0, 16)}</span>
            </div>

            <div className="text-[11px] font-semibold text-[#1A237E] mb-2 leading-tight">
              {hoveredPoint.cluster_name}
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div>
                <span className="text-[#5F5F5F]">PV Output:</span>{" "}
                <strong className="text-[#B78B24] font-mono">{hoveredPoint.pv_mw.toLocaleString()} MW</strong>
              </div>
              <div>
                <span className="text-[#5F5F5F]">Wind Output:</span>{" "}
                <strong className="text-[#00695C] font-mono">{hoveredPoint.wind_mw.toLocaleString()} MW</strong>
              </div>
              <div>
                <span className="text-[#5F5F5F]">GHI:</span>{" "}
                <strong className="font-mono">{hoveredPoint.ghi} W/m²</strong>
              </div>
              <div>
                <span className="text-[#5F5F5F]">Wind Speed:</span>{" "}
                <strong className="font-mono">{hoveredPoint.wind_speed} m/s</strong>
              </div>
              <div>
                <span className="text-[#5F5F5F]">Temperature:</span>{" "}
                <strong className="font-mono">{hoveredPoint.temperature} °C</strong>
              </div>
              <div>
                <span className="text-[#5F5F5F]">Posterior:</span>{" "}
                <strong className="text-[#1A237E] font-mono">{(hoveredPoint.probability * 100).toFixed(1)}%</strong>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-[#E5E1DA] flex justify-between text-[10px] text-[#5F5F5F] font-mono">
              <span>PC1: {hoveredPoint.pc1}</span>
              <span>PC2: {hoveredPoint.pc2}</span>
              <span>PC3: {hoveredPoint.pc3}</span>
            </div>
          </div>
        )}

        {/* Axis Orientation Pill */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-md border border-[#E5E1DA] shadow-xs text-[11px] space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-0.5 bg-[#1A237E]" />
            <span className="font-mono text-[#1A237E]">PC1: Solar Resource & Generation (61.2% var)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-0.5 bg-[#00695C]" />
            <span className="font-mono text-[#00695C]">PC2: Wind Generation & Dynamics (16.2% var)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-0.5 bg-[#887BB0]" />
            <span className="font-mono text-[#887BB0]">PC3: Moisture / Atmospheric Spread (10.8% var)</span>
          </div>
        </div>

        {/* Drag Hint */}
        <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded text-[11px] text-[#5F5F5F] border border-[#E5E1DA]">
          Click & drag to rotate • Scroll to zoom • Hover over dots
        </div>
      </div>

      {/* Cluster Legend / Filter Toggles */}
      <div className="p-3 bg-[#FAF9F6] border-t border-[#E5E1DA] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 flex-wrap">
          <span className="text-[#5F5F5F] font-medium mr-1">Regimes:</span>
          {["All", "Cluster 1", "Cluster 2", "Cluster 3", "Cluster 4", "Cluster 5"].map((name, idx) => {
            const clusterIdx = idx === 0 ? null : idx - 1;
            const isSelected = activeCluster === clusterIdx;
            const color = clusterIdx !== null ? CLUSTER_COLORS[clusterIdx] : "#1A237E";
            return (
              <button
                key={name}
                onClick={() => setActiveCluster(clusterIdx)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer border ${
                  isSelected
                    ? "bg-white text-[#1A237E] border-[#1A237E] shadow-xs ring-1 ring-[#1A237E]"
                    : "bg-white/60 text-[#5F5F5F] border-[#E5E1DA] hover:bg-white"
                }`}
              >
                {clusterIdx !== null && (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                )}
                <span>{name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-[#5F5F5F]">
          <Info className="w-3.5 h-3.5 text-[#B78B24]" />
          <span>
            {note || (selectedK === 2
              ? "k=2 was chosen for GMM modeling (77.4% var). PC3 is included for 3D visualization."
              : `GMM fitted on k=${selectedK} PCs. PC1, PC2, and PC3 are visualized in 3D.`)}
          </span>
        </div>
      </div>
    </div>
  );
};
