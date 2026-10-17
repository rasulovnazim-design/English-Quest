import type { AvatarLook } from '../engine/store';
import { COLOURS, SKINS } from '../engine/avatar';

const OUT = 'rgba(0,0,0,0.28)';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

function Face({ face }: { face: string }) {
  const eye = '#2f3542';
  switch (face) {
    case 'grin':
      return (
        <g>
          <rect x="38" y="22" width="6" height="7" rx="1.5" fill={eye} />
          <rect x="56" y="22" width="6" height="7" rx="1.5" fill={eye} />
          <path d="M38 34 Q50 46 62 34 Z" fill={eye} />
          <path d="M42 36 Q50 41 58 36 Z" fill="#fff" />
        </g>
      );
    case 'wink':
      return (
        <g>
          <path d="M37 26 h8" stroke={eye} strokeWidth="3" strokeLinecap="round" />
          <rect x="56" y="22" width="6" height="7" rx="1.5" fill={eye} />
          <path d="M40 35 Q50 42 60 35" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'wow':
      return (
        <g>
          <circle cx="41" cy="25" r="4" fill={eye} />
          <circle cx="59" cy="25" r="4" fill={eye} />
          <ellipse cx="50" cy="37" rx="4" ry="5" fill={eye} />
        </g>
      );
    case 'cool':
      return (
        <g>
          <rect x="33" y="20" width="15" height="9" rx="2" fill="#1e272e" />
          <rect x="52" y="20" width="15" height="9" rx="2" fill="#1e272e" />
          <rect x="47" y="22" width="6" height="2" fill="#1e272e" />
          <path d="M41 36 Q50 41 59 35" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'stars':
      return (
        <g fill="#ffb400" stroke="#e17055" strokeWidth="0.8">
          <path d="M41 19 l2 4.5 5 .5 -3.8 3.3 1.2 4.9 -4.4-2.6 -4.4 2.6 1.2-4.9 -3.8-3.3 5-.5z" />
          <path d="M59 19 l2 4.5 5 .5 -3.8 3.3 1.2 4.9 -4.4-2.6 -4.4 2.6 1.2-4.9 -3.8-3.3 5-.5z" />
          <path d="M40 35 Q50 44 60 35" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="38" y="22" width="6" height="7" rx="1.5" fill={eye} />
          <rect x="56" y="22" width="6" height="7" rx="1.5" fill={eye} />
          <path d="M40 35 Q50 42 60 35" stroke={eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function Hat({ hat }: { hat: string }) {
  switch (hat) {
    case 'cap':
      return (
        <g stroke={OUT} strokeWidth="1.5">
          <path d="M29 16 Q50 -2 71 16 v4 H29z" fill="#ff4757" />
          <rect x="62" y="16" width="22" height="5" rx="2.5" fill="#d63031" />
        </g>
      );
    case 'beanie':
      return (
        <g stroke={OUT} strokeWidth="1.5">
          <path d="M28 20 Q50 -6 72 20z" fill="#17c0eb" />
          <rect x="27" y="15" width="46" height="8" rx="3" fill="#0fa3c9" />
          <circle cx="50" cy="1" r="5" fill="#fff" />
        </g>
      );
    case 'party':
      return (
        <g stroke={OUT} strokeWidth="1.5">
          <path d="M38 14 L50 -14 L62 14z" fill="#ff6bcb" />
          <path d="M42 6 l14 -4 M45 -2 l9 -3" stroke="#ffd32a" strokeWidth="3" />
          <circle cx="50" cy="-15" r="4" fill="#ffd32a" />
        </g>
      );
    case 'headphones':
      return (
        <g stroke={OUT} strokeWidth="1.5">
          <path d="M27 26 Q27 0 50 0 Q73 0 73 26" fill="none" stroke="#2f3542" strokeWidth="5" />
          <rect x="21" y="20" width="10" height="16" rx="4" fill="#ff4757" />
          <rect x="69" y="20" width="10" height="16" rx="4" fill="#ff4757" />
        </g>
      );
    case 'tophat':
      return (
        <g stroke={OUT} strokeWidth="1.5">
          <rect x="36" y="-16" width="28" height="30" rx="2" fill="#2f3542" />
          <rect x="36" y="6" width="28" height="5" fill="#ff4757" />
          <rect x="26" y="13" width="48" height="6" rx="3" fill="#2f3542" />
        </g>
      );
    case 'helmet':
      return (
        <g stroke={OUT} strokeWidth="1.5">
          <rect x="22" y="2" width="56" height="50" rx="16" fill="rgba(200,230,255,0.35)" stroke="#dfe6e9" strokeWidth="4" />
          <rect x="44" y="-6" width="12" height="9" rx="2" fill="#dfe6e9" />
          <circle cx="50" cy="-8" r="3" fill="#ff4757" />
        </g>
      );
    case 'crown':
      return (
        <g stroke="#c8920a" strokeWidth="1.5">
          <path d="M30 16 L32 -4 L41 7 L50 -8 L59 7 L68 -4 L70 16z" fill="#ffd32a" />
          <circle cx="50" cy="8" r="3" fill="#ff4757" />
          <circle cx="38" cy="11" r="2.2" fill="#3a7bfd" />
          <circle cx="62" cy="11" r="2.2" fill="#2ed573" />
        </g>
      );
    default:
      return null;
  }
}

/** A blocky character drawn in SVG (original design). */
export function Avatar({ look, size = 96, mood }: { look: AvatarLook; size?: number; mood?: 'jump' | 'sad' | 'wave' | 'idle' }) {
  const skin = SKINS[look.skin] ?? SKINS.sun;
  const shirt = COLOURS[look.shirt] ?? COLOURS.blue;
  const pants = COLOURS[look.pants] ?? COLOURS.navy;
  return (
    <svg
      className={`avatar-svg ${mood ?? ''}`}
      viewBox="0 -20 100 160"
      width={size * 0.625}
      height={size}
      role="img"
      aria-label="Ваш персонаж"
    >
      <ellipse cx="50" cy="137" rx="30" ry="4" fill="rgba(0,0,0,0.15)" />
      {/* legs */}
      <rect x="29" y="92" width="20" height="42" rx="3" fill={pants} stroke={OUT} strokeWidth="2" />
      <rect x="51" y="92" width="20" height="42" rx="3" fill={pants} stroke={OUT} strokeWidth="2" />
      <rect x="29" y="126" width="20" height="8" rx="2" fill={shade(pants, -40)} />
      <rect x="51" y="126" width="20" height="8" rx="2" fill={shade(pants, -40)} />
      {/* arms */}
      <g className="arm-l">
        <rect x="9" y="50" width="18" height="40" rx="3" fill={skin} stroke={OUT} strokeWidth="2" />
        <rect x="9" y="50" width="18" height="16" rx="3" fill={shirt} />
      </g>
      <g className="arm-r">
        <rect x="73" y="50" width="18" height="40" rx="3" fill={skin} stroke={OUT} strokeWidth="2" />
        <rect x="73" y="50" width="18" height="16" rx="3" fill={shirt} />
      </g>
      {/* torso */}
      <rect x="27" y="50" width="46" height="44" rx="3" fill={shirt} stroke={OUT} strokeWidth="2" />
      <rect x="27" y="50" width="46" height="8" fill={shade(shirt, 30)} opacity="0.5" />
      {/* head */}
      <rect x="31" y="10" width="38" height="38" rx="7" fill={skin} stroke={OUT} strokeWidth="2" />
      <rect x="45" y="46" width="10" height="5" fill={shade(skin, -25)} />
      <Face face={look.face} />
      <Hat hat={look.hat} />
    </svg>
  );
}
