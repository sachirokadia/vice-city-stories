/**
 * Vehicle catalog — the ownership model's data. Every drivable car
 * in Vice City Stories is one of these specs: an original procedural
 * design (no copied models), a price, and base performance that no
 * two vehicles share. The Velocity GT is owned from the start; the
 * other three are bought in the garage with mission cash.
 *
 * Performance (all in the game's arcade units):
 * - topSpeed: m/s at full throttle (38 ≈ 137 km/h).
 * - accel: m/s² from a standstill.
 * - handling: steering-authority multiplier (1.00 = the GT's feel).
 *
 * Body parameters drive the procedural builder in Vehicle.ts:
 * - length / width / bodyHeight: the extruded side profile's size.
 * - boxy: a tall, flat, near-vertical profile (the SUV) instead of
 *   the sleek curved one (the sports cars and the sedan).
 * - cabinLen / cabinPos: where the glasshouse sits along the body,
 *   as fractions of the length (start, end).
 * - cabinHeight: how far the glasshouse rises above the body.
 * - wheelRadius / tireWidth / rideHeight: stance.
 * - spoiler: 'wing' (blade + struts), 'lip' (thin rear blade),
 *   'rack' (roof rails, the SUV), or 'none'.
 * - home: where the car parks when it is the active vehicle. The
 *   GT keeps its original spot on the x = 0 avenue; the bought
 *   cars live at the garage's street parking bay.
 */
export type VehicleKind = 'sports' | 'sedan' | 'coupe' | 'suv';
export type SpoilerStyle = 'wing' | 'lip' | 'rack' | 'none';

export interface VehicleSpec {
  id: string;
  name: string;
  kind: VehicleKind;
  description: string;
  /** Purchase price in mission cash. 0 = owned from the start. */
  price: number;
  topSpeed: number;
  accel: number;
  handling: number;
  length: number;
  width: number;
  bodyHeight: number;
  boxy: boolean;
  cabinStart: number;
  cabinEnd: number;
  cabinHeight: number;
  wheelRadius: number;
  tireWidth: number;
  rideHeight: number;
  spoiler: SpoilerStyle;
  defaultPaint: number;
  home: { x: number; z: number; heading: number };
}

export const VELOCITY_GT_ID = 'velocity-gt';

export const VEHICLE_SPECS: VehicleSpec[] = [
  {
    id: VELOCITY_GT_ID,
    name: 'Velocity GT',
    kind: 'sports',
    description: 'The original sports coupe — light, sharp, and the fastest thing you own from day one.',
    price: 0,
    topSpeed: 38,
    accel: 16,
    handling: 1.0,
    length: 4.42,
    width: 1.76,
    bodyHeight: 0.68,
    boxy: false,
    cabinStart: 0.26,
    cabinEnd: 0.67,
    cabinHeight: 0.4,
    wheelRadius: 0.36,
    tireWidth: 0.28,
    rideHeight: 0,
    spoiler: 'wing',
    defaultPaint: 0xd21026,
    home: { x: 0, z: -2, heading: Math.PI },
  },
  {
    id: 'shadow-lx',
    name: 'Shadow LX',
    kind: 'sedan',
    description: 'A long luxury sedan — smooth, quiet, and heavy on presence. Slower off the line, happier at a cruise.',
    price: 2000,
    topSpeed: 34,
    accel: 12,
    handling: 0.85,
    length: 4.9,
    width: 1.84,
    bodyHeight: 0.62,
    boxy: false,
    cabinStart: 0.3,
    cabinEnd: 0.72,
    cabinHeight: 0.36,
    wheelRadius: 0.35,
    tireWidth: 0.28,
    rideHeight: 0,
    spoiler: 'lip',
    defaultPaint: 0x1a2436,
    home: { x: 22, z: 30, heading: Math.PI / 2 },
  },
  {
    id: 'vortex-rs',
    name: 'Vortex RS',
    kind: 'coupe',
    description: 'A wide, low performance coupe — the fastest car in the city, and the sharpest through a corner.',
    price: 3500,
    topSpeed: 42,
    accel: 19,
    handling: 1.15,
    length: 4.3,
    width: 1.9,
    bodyHeight: 0.6,
    boxy: false,
    cabinStart: 0.28,
    cabinEnd: 0.66,
    cabinHeight: 0.36,
    wheelRadius: 0.37,
    tireWidth: 0.32,
    rideHeight: 0,
    spoiler: 'wing',
    defaultPaint: 0xff7a00,
    home: { x: 22, z: 30, heading: Math.PI / 2 },
  },
  {
    id: 'trailhawk-x',
    name: 'Trailhawk X',
    kind: 'suv',
    description: 'A tall off-road SUV on big wheels — the slowest of the four, but it shrugs off a kerb and a crowd.',
    price: 2800,
    topSpeed: 32,
    accel: 13,
    handling: 0.8,
    length: 4.6,
    width: 1.95,
    bodyHeight: 0.95,
    boxy: true,
    cabinStart: 0.18,
    cabinEnd: 0.78,
    cabinHeight: 0.55,
    wheelRadius: 0.46,
    tireWidth: 0.36,
    rideHeight: 0.12,
    spoiler: 'rack',
    defaultPaint: 0x3f6b3a,
    home: { x: 22, z: 30, heading: Math.PI / 2 },
  },
];

export function getVehicleSpec(id: string): VehicleSpec | undefined {
  return VEHICLE_SPECS.find((s) => s.id === id);
}

/** Paint palette for the garage (hex colours, $150 a repaint). */
export const PAINT_COLORS: Array<{ name: string; hex: number }> = [
  { name: 'Sunset Red', hex: 0xd21026 },
  { name: 'Midnight Blue', hex: 0x1a2436 },
  { name: 'Ember Orange', hex: 0xff7a00 },
  { name: 'Forest Green', hex: 0x3f6b3a },
  { name: 'Solar Yellow', hex: 0xffd23e },
  { name: 'Pearl White', hex: 0xe8e8e8 },
  { name: 'Onyx Black', hex: 0x14141a },
  { name: 'Royal Purple', hex: 0x7a2fd0 },
  { name: 'Harbour Teal', hex: 0x0ea5a5 },
  { name: 'Neon Pink', hex: 0xff5fa2 },
];

export function paintName(hex: number): string {
  return PAINT_COLORS.find((c) => c.hex === hex)?.name ?? 'Custom';
}
