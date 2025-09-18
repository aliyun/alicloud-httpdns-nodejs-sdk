/**
 * 工具函数测试
 */

import {
  buildQueryParams,
  isValidDomain,
  parseQueryType,
  generateTimestamp,
} from '../../utils/helpers';
import { QueryType } from '../../types';

describe('Helpers', () => {
  describe('buildQueryParams', () => {
    test('should build query params string', () => {
      const params = {
        host: 'example.com',
        query: '4',
        ip: '1.2.3.4',
      };

      const result = buildQueryParams(params);
      expect(result).toBe('host=example.com&query=4&ip=1.2.3.4');
    });

    test('should handle empty params', () => {
      const result = buildQueryParams({});
      expect(result).toBe('');
    });

    test('should encode special characters', () => {
      const params = {
        host: 'test.example.com',
        query: '4,6',
      };

      const result = buildQueryParams(params);
      expect(result).toBe('host=test.example.com&query=4%2C6');
    });

    test('should skip undefined and null values', () => {
      const params = {
        host: 'example.com',
        query: '4',
        ip: undefined as any,
        extra: null as any,
      };

      const result = buildQueryParams(params);
      expect(result).toBe('host=example.com&query=4');
    });
  });

  describe('isValidDomain', () => {
    test('should validate correct domains', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('test-domain.example.co.uk')).toBe(true);
      expect(isValidDomain('a.b')).toBe(true);
    });

    test('should reject invalid domains', () => {
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain('.')).toBe(false);
      expect(isValidDomain('.example.com')).toBe(false);
      expect(isValidDomain('example..com')).toBe(false);
      expect(isValidDomain('example.com.')).toBe(false);
      expect(isValidDomain('-example.com')).toBe(false);
      expect(isValidDomain('example-.com')).toBe(false);
    });

    test('should reject non-string inputs', () => {
      expect(isValidDomain(null as any)).toBe(false);
      expect(isValidDomain(undefined as any)).toBe(false);
      expect(isValidDomain(123 as any)).toBe(false);
    });

    test('should reject too long domains', () => {
      const longDomain = 'a'.repeat(254) + '.com';
      expect(isValidDomain(longDomain)).toBe(false);
    });
  });



  describe('parseQueryType', () => {
    test('should return correct query types', () => {
      expect(parseQueryType(QueryType.IPv4)).toBe(QueryType.IPv4);
      expect(parseQueryType(QueryType.IPv6)).toBe(QueryType.IPv6);
      expect(parseQueryType(QueryType.Both)).toBe(QueryType.Both);
    });

    test('should return Both for undefined', () => {
      expect(parseQueryType(undefined)).toBe(QueryType.Both);
    });

    test('should return Both for invalid types', () => {
      expect(parseQueryType('invalid' as any)).toBe(QueryType.Both);
    });
  });

  describe('generateTimestamp', () => {
    test('should generate timestamp string', () => {
      const timestamp = generateTimestamp();
      expect(typeof timestamp).toBe('string');
      expect(/^\d+$/.test(timestamp)).toBe(true);
    });

    test('should generate different timestamps', (done) => {
      const timestamp1 = generateTimestamp();
      setTimeout(() => {
        const timestamp2 = generateTimestamp();
        expect(timestamp2).not.toBe(timestamp1);
        done();
      }, 1100); // 等待超过1秒
    });
  });










});