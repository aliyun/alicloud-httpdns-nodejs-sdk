/**
 * 类型定义测试
 */

import { QueryType } from '../types';

describe('Types', () => {
  describe('QueryType', () => {
    test('should have correct values', () => {
      expect(QueryType.IPv4).toBe('4');
      expect(QueryType.IPv6).toBe('6');
      expect(QueryType.Both).toBe('4,6');
    });
  });


});