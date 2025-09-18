/**
 * 服务IP管理器单元测试
 */

import { ServiceIPManager } from '../utils/ip-pool';

describe('ServiceIPManager', () => {
  let serviceIPManager: ServiceIPManager;
  const testIPs = ['203.107.1.1', '203.107.1.2'];

  beforeEach(() => {
    serviceIPManager = new ServiceIPManager();
    serviceIPManager.updateServiceIPs(testIPs);
  });

  describe('基本功能', () => {
    it('应该使用启动IP初始化', () => {
      expect(serviceIPManager.getAvailableServiceIP()).toBe('203.107.1.1');
      expect(serviceIPManager.getCurrentIP()).toBe('203.107.1.1');
    });

    it('应该能够更新服务IP列表', () => {
      const newIPs = ['1.2.3.4', '5.6.7.8'];
      serviceIPManager.updateServiceIPs(newIPs);

      expect(serviceIPManager.getAvailableServiceIP()).toBe('1.2.3.4');
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
    });

    it('应该能够标记IP失败和成功', () => {
      const ip = '203.107.1.1';
      
      // Mark as failed
      serviceIPManager.markIPFailed(ip);
      
      // Should switch to next IP when getting available IP
      expect(serviceIPManager.getAvailableServiceIP()).toBe('203.107.1.2');
      expect(serviceIPManager.getCurrentIP()).toBe('203.107.1.2');
      
      // Mark failed IP as success (recovery)
      serviceIPManager.markIPSuccess(ip);
      
      // Should still be on current IP
      expect(serviceIPManager.getCurrentIP()).toBe('203.107.1.2');
    });
  });

  describe('IP列表更新边界情况', () => {
    it('应该在currentIP不在新列表中时重置为第一个IP', () => {
      // Set current IP
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8']);
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');

      // Update with new list that doesn't contain current IP
      serviceIPManager.updateServiceIPs(['9.10.11.12', '13.14.15.16']);
      
      // Should reset to first IP in new list
      expect(serviceIPManager.getCurrentIP()).toBe('9.10.11.12');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('9.10.11.12');
    });

    it('应该在currentIP在新列表中时保持当前IP', () => {
      // Set current IP
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8']);
      serviceIPManager.markIPFailed('1.2.3.4'); // This will set currentIP to undefined
      
      // Get next available IP to set currentIP
      expect(serviceIPManager.getAvailableServiceIP()).toBe('5.6.7.8');
      expect(serviceIPManager.getCurrentIP()).toBe('5.6.7.8');

      // Update with new list that contains current IP
      serviceIPManager.updateServiceIPs(['5.6.7.8', '9.10.11.12']);
      
      // Should keep current IP since it's in the new list
      expect(serviceIPManager.getCurrentIP()).toBe('5.6.7.8');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('5.6.7.8');
    });

    it('应该处理空IP列表', () => {
      // Update with empty list
      serviceIPManager.updateServiceIPs([]);
      
      // Should return null when no IPs available
      expect(serviceIPManager.getAvailableServiceIP()).toBe(null);
      expect(serviceIPManager.getCurrentIP()).toBe(undefined);
    });

    it('应该处理单个IP的列表', () => {
      serviceIPManager.updateServiceIPs(['1.2.3.4']);
      
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('1.2.3.4');
      
      // Mark as failed - should still return the same IP (no alternatives)
      serviceIPManager.markIPFailed('1.2.3.4');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('1.2.3.4');
    });
  });

  describe('失败IP标记和恢复逻辑', () => {
    beforeEach(() => {
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8', '9.10.11.12']);
    });

    it('应该按顺序轮转到下一个可用IP', () => {
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
      
      // Mark first IP as failed
      serviceIPManager.markIPFailed('1.2.3.4');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('5.6.7.8');
      expect(serviceIPManager.getCurrentIP()).toBe('5.6.7.8');
      
      // Mark second IP as failed
      serviceIPManager.markIPFailed('5.6.7.8');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('9.10.11.12');
      expect(serviceIPManager.getCurrentIP()).toBe('9.10.11.12');
    });

    it('应该在所有IP都失败时循环回到第一个IP', () => {
      // Mark all IPs as failed
      serviceIPManager.markIPFailed('1.2.3.4');
      serviceIPManager.markIPFailed('5.6.7.8');
      serviceIPManager.markIPFailed('9.10.11.12');
      
      // Should cycle back to first IP (even if failed)
      expect(serviceIPManager.getAvailableServiceIP()).toBe('1.2.3.4');
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
    });

    it('应该能够恢复失败的IP', () => {
      // Mark IP as failed
      serviceIPManager.markIPFailed('1.2.3.4');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('5.6.7.8');
      expect(serviceIPManager.getCurrentIP()).toBe('5.6.7.8');
      
      // Mark failed IP as success (recovery)
      serviceIPManager.markIPSuccess('1.2.3.4');
      
      // Should be able to use the recovered IP (1.2.3.4 is now available again)
      serviceIPManager.markIPFailed('5.6.7.8'); // Fail current
      expect(serviceIPManager.getAvailableServiceIP()).toBe('1.2.3.4'); // Should use recovered IP first
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
      
      // Now fail the recovered IP again and check next available
      serviceIPManager.markIPFailed('1.2.3.4'); // Fail current
      expect(serviceIPManager.getAvailableServiceIP()).toBe('9.10.11.12'); // Should use next available
      expect(serviceIPManager.getCurrentIP()).toBe('9.10.11.12');
    });

    // IP failure status tracking test removed - method not available in current implementation
  });

  describe('currentIP重置逻辑', () => {
    it('应该在更新IP列表时正确重置currentIP', () => {
      // Start with test IPs
      expect(serviceIPManager.getCurrentIP()).toBe('203.107.1.1');
      
      // Update to new IPs
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8']);
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
      
      // Switch to second IP
      serviceIPManager.markIPFailed('1.2.3.4');
      expect(serviceIPManager.getAvailableServiceIP()).toBe('5.6.7.8');
      expect(serviceIPManager.getCurrentIP()).toBe('5.6.7.8');
      
      // Update with completely new list (currentIP not in new list)
      serviceIPManager.updateServiceIPs(['9.10.11.12', '13.14.15.16']);
      expect(serviceIPManager.getCurrentIP()).toBe('9.10.11.12');
    });

    it('应该在IP列表为空时重置currentIP', () => {
      // Update to service IPs
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8']);
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
      
      // Clear IP list
      serviceIPManager.updateServiceIPs([]);
      expect(serviceIPManager.getCurrentIP()).toBe(undefined);
    });
  });

  describe('空IP列表处理', () => {
    it('应该在服务IP列表为空时返回null', () => {
      serviceIPManager.updateServiceIPs([]);
      
      expect(serviceIPManager.getAvailableServiceIP()).toBe(null);
      expect(serviceIPManager.getCurrentIP()).toBe(undefined);
    });

    it('应该在没有IP时返回null', () => {
      const emptyManager = new ServiceIPManager();
      
      expect(emptyManager.getAvailableServiceIP()).toBe(null);
      expect(emptyManager.getCurrentIP()).toBe(undefined);
    });

    it('应该能够从空列表恢复到有效列表', () => {
      // Start with empty list
      serviceIPManager.updateServiceIPs([]);
      expect(serviceIPManager.getCurrentIP()).toBe(undefined);
      
      // Update to valid list
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8']);
      expect(serviceIPManager.getCurrentIP()).toBe('1.2.3.4');
    });
  });

  describe('顺序轮转逻辑', () => {
    beforeEach(() => {
      serviceIPManager.updateServiceIPs(['1.2.3.4', '5.6.7.8', '9.10.11.12']);
    });

    it('应该按顺序轮转IP而不是随机选择', () => {
      const rotationOrder = [];
      
      // Record the rotation order
      rotationOrder.push(serviceIPManager.getCurrentIP());
      
      // Fail first IP and get next
      let currentIP = serviceIPManager.getCurrentIP();
      if (currentIP) serviceIPManager.markIPFailed(currentIP);
      rotationOrder.push(serviceIPManager.getAvailableServiceIP());
      
      // Fail second IP and get next
      currentIP = serviceIPManager.getCurrentIP();
      if (currentIP) serviceIPManager.markIPFailed(currentIP);
      rotationOrder.push(serviceIPManager.getAvailableServiceIP());
      
      // Fail third IP and get next (should cycle back)
      currentIP = serviceIPManager.getCurrentIP();
      if (currentIP) serviceIPManager.markIPFailed(currentIP);
      rotationOrder.push(serviceIPManager.getAvailableServiceIP());
      
      // Should follow predictable order
      expect(rotationOrder).toEqual(['1.2.3.4', '5.6.7.8', '9.10.11.12', '1.2.3.4']);
    });

    it('应该在多次调用getAvailableServiceIP时返回相同IP', () => {
      const ip1 = serviceIPManager.getAvailableServiceIP();
      const ip2 = serviceIPManager.getAvailableServiceIP();
      const ip3 = serviceIPManager.getAvailableServiceIP();
      
      expect(ip1).toBe(ip2);
      expect(ip2).toBe(ip3);
    });

    it('应该只在markIPFailed时切换IP', () => {
      const initialIP = serviceIPManager.getCurrentIP();
      
      // Multiple calls should return same IP
      expect(serviceIPManager.getAvailableServiceIP()).toBe(initialIP);
      expect(serviceIPManager.getCurrentIP()).toBe(initialIP);
      
      // Only after marking as failed should it switch
      if (initialIP) {
        serviceIPManager.markIPFailed(initialIP);
        expect(serviceIPManager.getCurrentIP()).not.toBe(initialIP);
      }
    });
  });

  // Statistics and status tests removed - methods not available in current implementation
});