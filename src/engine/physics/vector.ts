/**
 * Cosmic Fabric - Vector Mathematics
 * 
 * High-precision vector operations for physics calculations.
 * Uses typed arrays for performance optimization.
 */

/**
 * Immutable 3D vector class optimized for physics calculations
 */
export class Vector3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /** Create from array */
    static fromArray(arr: [number, number, number]): Vector3 {
        return new Vector3(arr[0], arr[1], arr[2]);
    }

    /** Zero vector */
    static zero(): Vector3 {
        return new Vector3(0, 0, 0);
    }

    /** Unit vectors */
    static unitX(): Vector3 { return new Vector3(1, 0, 0); }
    static unitY(): Vector3 { return new Vector3(0, 1, 0); }
    static unitZ(): Vector3 { return new Vector3(0, 0, 1); }

    /** Vector addition */
    add(v: Vector3): Vector3 {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    /** Vector subtraction */
    subtract(v: Vector3): Vector3 {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    /** Scalar multiplication */
    scale(s: number): Vector3 {
        return new Vector3(this.x * s, this.y * s, this.z * s);
    }

    /** Dot product */
    dot(v: Vector3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    /** Cross product */
    cross(v: Vector3): Vector3 {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    /** Magnitude (length) */
    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /** Alias for magnitude() */
    length(): number {
        return this.magnitude();
    }

    /** Squared magnitude (for performance when actual distance not needed) */
    magnitudeSquared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    /** Normalized vector (unit length) */
    normalize(): Vector3 {
        const mag = this.magnitude();
        if (mag === 0) return Vector3.zero();
        return this.scale(1 / mag);
    }

    /** Distance to another vector */
    distanceTo(v: Vector3): number {
        return this.subtract(v).magnitude();
    }

    /** Squared distance (for performance) */
    distanceSquaredTo(v: Vector3): number {
        return this.subtract(v).magnitudeSquared();
    }

    /** Linear interpolation */
    lerp(v: Vector3, t: number): Vector3 {
        return new Vector3(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t,
            this.z + (v.z - this.z) * t
        );
    }

    /** Component-wise minimum */
    min(v: Vector3): Vector3 {
        return new Vector3(
            Math.min(this.x, v.x),
            Math.min(this.y, v.y),
            Math.min(this.z, v.z)
        );
    }

    /** Component-wise maximum */
    max(v: Vector3): Vector3 {
        return new Vector3(
            Math.max(this.x, v.x),
            Math.max(this.y, v.y),
            Math.max(this.z, v.z)
        );
    }

    /** Clamp each component between min and max */
    clamp(min: number, max: number): Vector3 {
        return new Vector3(
            Math.max(min, Math.min(max, this.x)),
            Math.max(min, Math.min(max, this.y)),
            Math.max(min, Math.min(max, this.z))
        );
    }

    /** Check equality with tolerance */
    equals(v: Vector3, epsilon: number = 1e-10): boolean {
        return (
            Math.abs(this.x - v.x) < epsilon &&
            Math.abs(this.y - v.y) < epsilon &&
            Math.abs(this.z - v.z) < epsilon
        );
    }

    /** Convert to array */
    toArray(): [number, number, number] {
        return [this.x, this.y, this.z];
    }

    /** Convert to Float64Array for high precision */
    toFloat64Array(): Float64Array {
        return new Float64Array([this.x, this.y, this.z]);
    }

    /** Convert to Float32Array for GPU/rendering */
    toFloat32Array(): Float32Array {
        return new Float32Array([this.x, this.y, this.z]);
    }

    /** String representation */
    toString(): string {
        return `Vector3(${this.x.toExponential(4)}, ${this.y.toExponential(4)}, ${this.z.toExponential(4)})`;
    }

    /** Clone this vector */
    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }
}

/**
 * Mutable vector for performance-critical operations
 * Use sparingly - prefer immutable Vector3 for clarity
 */
export class MutableVector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /** Reset to zero */
    reset(): this {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    }

    /** Set values */
    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /** Copy from another vector */
    copy(v: Vector3 | MutableVector3): this {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    /** Add in place */
    addInPlace(v: Vector3 | MutableVector3): this {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    /** Scale in place */
    scaleInPlace(s: number): this {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    /** Normalize in place */
    normalizeInPlace(): this {
        const mag = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (mag > 0) {
            this.x /= mag;
            this.y /= mag;
            this.z /= mag;
        }
        return this;
    }

    /** Convert to immutable */
    toImmutable(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    /** Magnitude */
    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /** Squared magnitude */
    magnitudeSquared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }
}

export default Vector3;
