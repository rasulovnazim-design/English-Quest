// Blocky forest artwork, drawn in SVG (original designs).

const OUT = 'rgba(0,0,0,0.25)';

export type TreeLook = 'normal' | 'golden' | 'oak' | 'stump' | 'sapling';

export function TreeArt({ look, size = 1, leaf = '#2ed573' }: { look: TreeLook; size?: number; leaf?: string }) {
  if (look === 'stump') {
    return (
      <svg viewBox="0 0 80 40" width={80 * size} height={40 * size} aria-hidden="true">
        <rect x="22" y="12" width="36" height="26" rx="3" fill="#a0522d" stroke={OUT} strokeWidth="2" />
        <ellipse cx="40" cy="12" rx="18" ry="6" fill="#deb887" stroke={OUT} strokeWidth="2" />
        <ellipse cx="40" cy="12" rx="10" ry="3" fill="none" stroke="#b5835a" strokeWidth="1.5" />
      </svg>
    );
  }
  if (look === 'sapling') {
    return (
      <svg viewBox="0 0 80 60" width={80 * size} height={60 * size} aria-hidden="true">
        <rect x="22" y="40" width="36" height="18" rx="3" fill="#a0522d" stroke={OUT} strokeWidth="2" />
        <ellipse cx="40" cy="40" rx="18" ry="6" fill="#deb887" stroke={OUT} strokeWidth="2" />
        <rect x="38" y="16" width="4" height="24" fill="#2e7d32" />
        <rect x="26" y="12" width="14" height="10" rx="3" fill="#7bed9f" stroke={OUT} strokeWidth="1.5" />
        <rect x="41" y="6" width="14" height="10" rx="3" fill="#7bed9f" stroke={OUT} strokeWidth="1.5" />
      </svg>
    );
  }
  const gold = look === 'golden';
  const oak = look === 'oak';
  const l1 = gold ? '#ffd32a' : oak ? '#1e8449' : leaf;
  const l2 = gold ? '#ffe066' : oak ? '#27ae60' : shade(leaf, 25);
  const trunk = oak ? '#6d3b1b' : '#8b4a1f';
  const w = oak ? 160 : 120;
  const h = oak ? 230 : 180;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w * size} height={h * size} aria-hidden="true" style={{ overflow: 'visible' }}>
      <ellipse cx={w / 2} cy={h - 3} rx={w * 0.32} ry="5" fill="rgba(0,0,0,0.15)" />
      <rect x={w / 2 - (oak ? 18 : 12)} y={h * 0.5} width={oak ? 36 : 24} height={h * 0.5 - 4} rx="3" fill={trunk} stroke={OUT} strokeWidth="2" />
      <rect x={w / 2 - (oak ? 18 : 12)} y={h * 0.5} width={oak ? 10 : 7} height={h * 0.5 - 4} fill="rgba(255,255,255,0.15)" />
      {/* leaves: stacked blocks */}
      <rect x={w * 0.08} y={h * 0.3} width={w * 0.84} height={h * 0.3} rx="10" fill={l1} stroke={OUT} strokeWidth="2" />
      <rect x={w * 0.18} y={h * 0.12} width={w * 0.64} height={h * 0.26} rx="10" fill={l2} stroke={OUT} strokeWidth="2" />
      <rect x={w * 0.3} y={0} width={w * 0.4} height={h * 0.18} rx="9" fill={l1} stroke={OUT} strokeWidth="2" />
      <rect x={w * 0.14} y={h * 0.33} width={w * 0.2} height={h * 0.07} rx="4" fill="rgba(255,255,255,0.25)" />
      {gold && (
        <g fill="#fff">
          <path d="M20 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
          <path d="M100 60 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
          <path d="M60 4 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
        </g>
      )}
      {oak && (
        <g>
          <circle cx={w * 0.3} cy={h * 0.45} r="5" fill="#a0522d" />
          <circle cx={w * 0.7} cy={h * 0.4} r="5" fill="#a0522d" />
          <circle cx={w * 0.55} cy={h * 0.22} r="5" fill="#a0522d" />
        </g>
      )}
    </svg>
  );
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

export function SawmillArt() {
  return (
    <svg viewBox="0 0 170 140" width="170" height="140" aria-hidden="true">
      <rect x="10" y="50" width="120" height="86" rx="4" fill="#c97b3c" stroke={OUT} strokeWidth="2" />
      <path d="M2 54 L70 12 L138 54z" fill="#e74c3c" stroke={OUT} strokeWidth="2" />
      <rect x="52" y="86" width="34" height="50" rx="3" fill="#6d3b1b" />
      <rect x="20" y="66" width="24" height="18" rx="3" fill="#bde7ff" stroke={OUT} strokeWidth="2" />
      <rect x="94" y="66" width="24" height="18" rx="3" fill="#bde7ff" stroke={OUT} strokeWidth="2" />
      <g className="saw">
        <circle cx="146" cy="96" r="20" fill="#dfe6e9" stroke="#636e72" strokeWidth="3" strokeDasharray="5 3" />
        <circle cx="146" cy="96" r="5" fill="#636e72" />
      </g>
      <g stroke={OUT} strokeWidth="1.5">
        <rect x="118" y="120" width="48" height="12" rx="6" fill="#a0522d" />
        <rect x="126" y="108" width="40" height="12" rx="6" fill="#b5651d" />
      </g>
    </svg>
  );
}

export function ShopArt() {
  return (
    <svg viewBox="0 0 150 130" width="150" height="130" aria-hidden="true">
      <rect x="14" y="56" width="122" height="70" rx="4" fill="#f5deb3" stroke={OUT} strokeWidth="2" />
      <rect x="20" y="88" width="110" height="14" fill="#c97b3c" />
      <g stroke={OUT} strokeWidth="1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${6 + i * 23} 30 h23 v26 q-11.5 10 -23 0z`} fill={i % 2 ? '#fff' : '#3a7bfd'} />
        ))}
      </g>
      <rect x="6" y="22" width="138" height="10" rx="3" fill="#2f3542" />
      <text x="75" y="80" textAnchor="middle" fontSize="20">
        🪓🎒
      </text>
    </svg>
  );
}

export function GateArt({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 140 150" width="140" height="150" aria-hidden="true">
      <g fill="#a0522d" stroke={OUT} strokeWidth="2">
        <rect x="10" y="40" width="16" height="106" rx="3" />
        <rect x="114" y="40" width="16" height="106" rx="3" />
        <rect x="26" y="74" width="88" height="10" rx="3" />
        <rect x="26" y="108" width="88" height="10" rx="3" />
      </g>
      <rect x="20" y="6" width="100" height="34" rx="6" fill="#fff" stroke={OUT} strokeWidth="2" />
      <text x="70" y="23" textAnchor="middle" fontSize="13" fontWeight="900" fill="#1f2a44">
        {title}
      </text>
      <text x="70" y="36" textAnchor="middle" fontSize="11">
        🔒
      </text>
    </svg>
  );
}

export function AxeArt({ colour }: { colour: string }) {
  return (
    <svg viewBox="0 0 40 60" width="34" height="52" aria-hidden="true">
      <rect x="17" y="10" width="6" height="48" rx="3" fill="#8b4a1f" stroke={OUT} strokeWidth="1.5" />
      <path d="M22 6 h12 q4 10 0 22 h-12z" fill={colour} stroke={OUT} strokeWidth="1.5" />
    </svg>
  );
}
