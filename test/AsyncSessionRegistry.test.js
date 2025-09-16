const { AsyncSessionRegistry } = require('./helpers/testHelpers');

describe('AsyncSessionRegistry Tests', () => {
  let registry;

  beforeEach(() => {
    registry = new AsyncSessionRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  test('Basic async operations', async () => {
    // Test set and get
    await registry.set('key1', { value: 'test1' });
    const result = await registry.get('key1');

    expect(result).toEqual({ value: 'test1' });
  });

  test('Get non-existent key returns undefined', async () => {
    const result = await registry.get('non-existent');
    expect(result).toBeUndefined();
  });

  test('Delete operation works', async () => {
    await registry.set('key1', { value: 'test1' });
    const deleteResult = await registry.delete('key1');
    const getResult = await registry.get('key1');

    expect(deleteResult).toBe(true);
    expect(getResult).toBeUndefined();
  });

  test('Size operation works', async () => {
    expect(await registry.size()).toBe(0);

    await registry.set('key1', { value: 'test1' });
    await registry.set('key2', { value: 'test2' });

    expect(await registry.size()).toBe(2);
  });

  test('Set returns self for chaining', async () => {
    const result = await registry.set('key1', { value: 'test1' });
    expect(result).toBe(registry);
  });

  test('Synchronous methods for test compatibility', () => {
    registry.storage.set('key1', { value: 'test1' });

    expect(registry.has('key1')).toBe(true);
    expect(registry.has('key2')).toBe(false);

    const entries = Array.from(registry.entries());
    expect(entries).toEqual([['key1', { value: 'test1' }]]);
  });

  test('Clear operation works', async () => {
    await registry.set('key1', { value: 'test1' });
    await registry.set('key2', { value: 'test2' });

    expect(await registry.size()).toBe(2);

    registry.clear();

    expect(await registry.size()).toBe(0);
    expect(await registry.get('key1')).toBeUndefined();
    expect(await registry.get('key2')).toBeUndefined();
  });

  test('getAllSessions method for API compatibility', () => {
    registry.storage.set('session1', { guacdHost: 'host1', guacdPort: 4822 });
    registry.storage.set('session2', { guacdHost: 'host2', guacdPort: 4823 });

    const sessions = registry.getAllSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sessionId: 'session1',
        guacdHost: 'host1',
        guacdPort: 4822
      }),
      expect.objectContaining({
        sessionId: 'session2',
        guacdHost: 'host2',
        guacdPort: 4823
      })
    ]));
  });

  test('Registry works with Map-like interface for backwards compatibility', async () => {
    // Test that it behaves like the original Map but with async operations
    await registry.set('test-key', { data: 'test-value' });

    expect(registry.has('test-key')).toBe(true);
    expect(registry.has('missing-key')).toBe(false);

    const value = await registry.get('test-key');
    expect(value.data).toBe('test-value');

    await registry.delete('test-key');
    expect(registry.has('test-key')).toBe(false);
  });
});
