import type { HTMLAttributes, ReactNode } from 'react';

export type Floor = 'bawah' | 'atas';

export const FLOORS: { key: Floor; label: string; image: string }[] = [
  { key: 'bawah', label: 'Lantai Bawah', image: '/DenahBawah.png' },
  { key: 'atas', label: 'Lantai Atas', image: '/DenahAtas.png' },
];

// Opacity (0 to 1) of the lower-floor map shown behind the upper floor
export const GHOST_OPACITY = 0.25;

// Both floors are drawn at the same scale. DenahAtas.png is a cropped export that is
// transparent, so it is placed at its measured offset on a shared canvas, which makes the
// buildings line up. The canvas is the union of both images (Atas sticks out ~70px to the
// right of Bawah, so the canvas is slightly wider than DenahBawah.png).
// ALL hitbox coordinates (map_x, map_y, map_w, map_h) are percentages of this canvas.
// If you re-export the images, re-measure BAWAH / ATAS and update CANVAS to match.
const BAWAH = { x: 0, y: 0, w: 2870, h: 4020 };   // DenahBawah.png size (px)
const ATAS = { x: 206, y: 0, w: 2734, h: 3493 };  // DenahAtas.png size + offset on the canvas (px)
export const CANVAS = {
  w: Math.max(BAWAH.x + BAWAH.w, ATAS.x + ATAS.w),
  h: Math.max(BAWAH.y + BAWAH.h, ATAS.y + ATAS.h),
};

const box = (r: { x: number; y: number; w: number; h: number }) => ({
  left: `${(r.x / CANVAS.w) * 100}%`,
  top: `${(r.y / CANVAS.h) * 100}%`,
  width: `${(r.w / CANVAS.w) * 100}%`,
  height: `${(r.h / CANVAS.h) * 100}%`,
});
const BAWAH_BOX = box(BAWAH);
const ATAS_BOX = box(ATAS);

interface DenahCanvasProps extends HTMLAttributes<HTMLDivElement> {
  floor: Floor;
  /** Absolutely-positioned overlays (hitboxes, drawing preview). Use % left/top/width/height. */
  children?: ReactNode;
}

/**
 * The layered floor plan. Lower floor fills the canvas; when floor === 'atas' it
 * fades to GHOST_OPACITY and the upper floor is drawn on top at its offset.
 * Used by both the public RoomMap page and the admin hitbox editor, so they always match.
 */
export default function DenahCanvas({ floor, children, className = '', style, ...rest }: DenahCanvasProps) {
  return (
    <div
      {...rest}
      className={`relative overflow-hidden bg-white ${className}`}
      style={{ aspectRatio: `${CANVAS.w} / ${CANVAS.h}`, ...style }}
    >
      <img
        src={FLOORS[0].image}
        alt={floor === 'bawah' ? 'Denah SMK Negeri 11 Bandung - Lantai Bawah' : ''}
        aria-hidden={floor === 'atas'}
        className="absolute select-none pointer-events-none transition-opacity duration-300"
        style={{ ...BAWAH_BOX, opacity: floor === 'atas' ? GHOST_OPACITY : 1 }}
        draggable={false}
      />

      {floor === 'atas' && (
        <img
          src={FLOORS[1].image}
          alt="Denah SMK Negeri 11 Bandung - Lantai Atas"
          className="absolute select-none pointer-events-none"
          style={ATAS_BOX}
          draggable={false}
        />
      )}

      {children}
    </div>
  );
}