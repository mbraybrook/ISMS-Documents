import { ConcurrencyLimiter } from '../concurrencyLimiter';

describe('ConcurrencyLimiter', () => {
    it('should enforce concurrency limit', async () => {
        const limiter = new ConcurrencyLimiter(2);
        let running = 0;
        let maxRunning = 0;

        const task = async (id: number) => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise((resolve) => setTimeout(resolve, 50));
            running--;
            return id;
        };

        const promises = [
            limiter.execute(() => task(1)),
            limiter.execute(() => task(2)),
            limiter.execute(() => task(3)),
            limiter.execute(() => task(4)),
        ];

        const results = await Promise.all(promises);

        expect(results).toEqual([1, 2, 3, 4]);
        expect(maxRunning).toBe(2);
    });

    it('should handle task errors gracefully', async () => {
        const limiter = new ConcurrencyLimiter(1);
        const errorTask = async () => {
            throw new Error('Task failed');
        };
        const successTask = async () => 'success';

        await expect(limiter.execute(errorTask)).rejects.toThrow('Task failed');
        await expect(limiter.execute(successTask)).resolves.toBe('success');
    });

    it('should throw error for invalid concurrency', () => {
        expect(() => new ConcurrencyLimiter(0)).toThrow('maxConcurrency must be at least 1');
    });

    it('should execute queued tasks in order', async () => {
        const limiter = new ConcurrencyLimiter(1);
        const results: number[] = [];

        const task = async (id: number) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            results.push(id);
            return id;
        };

        await Promise.all([
            limiter.execute(() => task(1)),
            limiter.execute(() => task(2)),
            limiter.execute(() => task(3))
        ]);

        expect(results).toEqual([1, 2, 3]);
    });
});
