/**
 * High-performance, zero-allocation Object Pool.
 */
export class ObjectPool {
    constructor(createFn, initialSize = 10) {
        this.createFn = createFn;
        this.pool = [];

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }

    get() {
        const pool = this.pool;
        return pool.length > 0 ? pool.pop() : this.createFn();
    }

    release(obj) {
        this.pool.push(obj);
    }

    get size() {
        return this.pool.length;
    }
}