import { 
  calculateHaversineDistance, 
  calculateBearing, 
  calculateRelativeAngle,
  calculateARProjection 
} from '../utils/haversine';

describe('Geo and AR math', () => {
  describe('calculateHaversineDistance', () => {
    it('calculates distance between same points as 0', () => {
      const coord1 = { latitude: 11.025, longitude: 77.025 };
      expect(calculateHaversineDistance(coord1, coord1)).toBeCloseTo(0, 5);
    });

    it('calculates distance accurately for ~11.1m (0.0001 deg lat)', () => {
      const coord1 = { latitude: 11.025000, longitude: 77.025000 };
      const coord2 = { latitude: 11.025100, longitude: 77.025000 };
      const dist = calculateHaversineDistance(coord1, coord2);
      expect(dist).toBeGreaterThan(10);
      expect(dist).toBeLessThan(12);
    });
    
    it('calculates distance accurately at equator', () => {
      const coord1 = { latitude: 0, longitude: 0 };
      const coord2 = { latitude: 0, longitude: 1 };
      // 1 degree longitude at equator is ~111.19 km with 6371km radius
      const dist = calculateHaversineDistance(coord1, coord2);
      expect(dist).toBeCloseTo(111195, 0); // approx
    });
  });

  describe('calculateBearing', () => {
    it('calculates bearing due North as 0 degrees', () => {
      const origin = { latitude: 10, longitude: 10 };
      const target = { latitude: 11, longitude: 10 };
      expect(calculateBearing(origin, target)).toBeCloseTo(0, 1);
    });

    it('calculates bearing due East as 90 degrees', () => {
      const origin = { latitude: 0, longitude: 10 };
      const target = { latitude: 0, longitude: 11 };
      expect(calculateBearing(origin, target)).toBeCloseTo(90, 1);
    });

    it('calculates bearing due South as 180 degrees', () => {
      const origin = { latitude: 11, longitude: 10 };
      const target = { latitude: 10, longitude: 10 };
      expect(calculateBearing(origin, target)).toBeCloseTo(180, 1);
    });

    it('calculates bearing due West as 270 degrees', () => {
      const origin = { latitude: 0, longitude: 11 };
      const target = { latitude: 0, longitude: 10 };
      expect(calculateBearing(origin, target)).toBeCloseTo(270, 1);
    });
  });

  describe('calculateRelativeAngle', () => {
    it('calculates relative angle correctly', () => {
      expect(calculateRelativeAngle(90, 90)).toBe(0);
      expect(calculateRelativeAngle(90, 80)).toBe(10); // Target is to the right
      expect(calculateRelativeAngle(80, 90)).toBe(-10); // Target is to the left
      
      // Wraparound 
      expect(calculateRelativeAngle(350, 10)).toBe(-20); // 350 - 10 = -20
      expect(calculateRelativeAngle(10, 350)).toBe(20); // 10 - 350 = 20
    });
  });

  describe('calculateARProjection', () => {
    it('projects AR correctly (target directly ahead)', () => {
      const origin = { latitude: 11.0, longitude: 77.0 };
      const target = { latitude: 11.0001, longitude: 77.0 }; // Target North ~11.1m
      const bearing = calculateBearing(origin, target); // should be 0
      
      // User facing North
      const proj = calculateARProjection(origin, target, 0, 0);
      expect(proj.direction).toBe('in_front');
      expect(proj.relativeAngle).toBeCloseTo(0, 1);
      expect(proj.screenXPercent).toBeCloseTo(50, 1);
      expect(proj.inView).toBe(true);
    });

    it('projects AR correctly (target to the right)', () => {
      const origin = { latitude: 11.0, longitude: 77.0 };
      const target = { latitude: 11.0001, longitude: 77.0 }; // Target North
      
      // User facing Northwest (315 degrees), so target North (0) is 45 degrees to the right
      const proj = calculateARProjection(origin, target, 315, 0);
      expect(proj.direction).toBe('right');
      expect(proj.relativeAngle).toBeCloseTo(45, 1);
      expect(proj.screenXPercent).toBeGreaterThan(50); // should be > 50
    });
  });
});
