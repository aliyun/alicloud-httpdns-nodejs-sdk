/**
 * IP池管理测试
 */

import { ServiceIPManager } from '../../utils/ip-pool';

describe('ServiceIPManager', () => {
  let manager: ServiceIPManager;

  beforeEach(() => {
    manager = new ServiceIPManager();
  });

  describe('updateServiceIPs', () => {
    test('should update service IPs and set current IP', () => {
      const ips = ['192.168.1.1', '192.168.1.2'];
      manager.updateServiceIPs(ips);

      expect(manager.getServiceIPs()).toEqual(ips);
      expect(manager.getCurrentIP()).toBe('192.168.1.1');
    });

    test('should handle empty IP list', () => {
      manager.updateServiceIPs([]);

      expect(manager.getServiceIPs()).toEqual([]);
      expect(manager.getCurrentIP()).toBeUndefined();
    });

    test('should reset current IP when not in new list', () => {
      manager.updateServiceIPs(['192.168.1.1']);
      expect(manager.getCurrentIP()).toBe('192.168.1.1');

      manager.updateServiceIPs(['192.168.1.2', '192.168.1.3']);
      expect(manager.getCurrentIP()).toBe('192.168.1.2'); // 重置为新列表的第一个IP
    });
  });

  describe('getAvailableServiceIP', () => {
    test('should return current IP if available', () => {
      manager.updateServiceIPs(['192.168.1.1', '192.168.1.2']);

      const ip = manager.getAvailableServiceIP();
      expect(ip).toBe('192.168.1.1');
    });

    test('should return next available IP if current IP failed', () => {
      manager.updateServiceIPs(['192.168.1.1', '192.168.1.2']);
      manager.markIPFailed('192.168.1.1');

      const ip = manager.getAvailableServiceIP();
      expect(ip).toBe('192.168.1.2');
    });

    test('should return first IP if all IPs failed', () => {
      manager.updateServiceIPs(['192.168.1.1', '192.168.1.2']);
      manager.markIPFailed('192.168.1.1');
      manager.markIPFailed('192.168.1.2');

      const ip = manager.getAvailableServiceIP();
      expect(ip).toBe('192.168.1.1'); // 返回第一个IP，可能已经恢复
    });

    test('should return null if no service IPs', () => {
      const ip = manager.getAvailableServiceIP();
      expect(ip).toBeNull();
    });
  });

  describe('markIPFailed', () => {
    test('should mark IP as failed', () => {
      manager.updateServiceIPs(['192.168.1.1', '192.168.1.2']);
      manager.markIPFailed('192.168.1.1');

      expect(manager.getFailedIPs()).toContain('192.168.1.1');
      expect(manager.getCurrentIP()).toBeUndefined(); // 当前IP被清空
    });

    test('should not affect other IPs', () => {
      manager.updateServiceIPs(['192.168.1.1', '192.168.1.2']);
      manager.markIPFailed('192.168.1.1');

      const ip = manager.getAvailableServiceIP();
      expect(ip).toBe('192.168.1.2');
    });
  });

  describe('markIPSuccess', () => {
    test('should remove IP from failed list', () => {
      manager.updateServiceIPs(['192.168.1.1']);
      manager.markIPFailed('192.168.1.1');
      expect(manager.getFailedIPs()).toContain('192.168.1.1');

      manager.markIPSuccess('192.168.1.1');
      expect(manager.getFailedIPs()).not.toContain('192.168.1.1');
    });
  });

  describe('cleanupExpiredFailures', () => {
    test('should remove expired failure records', (done) => {
      manager.updateServiceIPs(['192.168.1.1']);
      manager.markIPFailed('192.168.1.1');

      // 模拟时间过去（通过直接修改失败时间）
      const failedIPs = (manager as any).failedIPs;
      const pastTime = new Date(Date.now() - 6 * 60 * 1000); // 6分钟前
      failedIPs.set('192.168.1.1', pastTime);

      manager.cleanupExpiredFailures();

      setTimeout(() => {
        expect(manager.getFailedIPs()).not.toContain('192.168.1.1');
        done();
      }, 10);
    });

    test('should keep recent failure records', () => {
      manager.updateServiceIPs(['192.168.1.1']);
      manager.markIPFailed('192.168.1.1');

      manager.cleanupExpiredFailures();

      expect(manager.getFailedIPs()).toContain('192.168.1.1');
    });
  });

  describe('IP availability after failure', () => {
    test('should make failed IP available after 5 minutes', (done) => {
      manager.updateServiceIPs(['192.168.1.1']);
      manager.markIPFailed('192.168.1.1');

      // 模拟5分钟后
      const failedIPs = (manager as any).failedIPs;
      const pastTime = new Date(Date.now() - 6 * 60 * 1000); // 6分钟前
      failedIPs.set('192.168.1.1', pastTime);

      setTimeout(() => {
        const ip = manager.getAvailableServiceIP();
        expect(ip).toBe('192.168.1.1');
        done();
      }, 10);
    });
  });
});