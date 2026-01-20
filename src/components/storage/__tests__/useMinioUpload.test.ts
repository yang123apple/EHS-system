/**
 * useMinioUpload Hook 测试
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useMinioUpload } from '../../../hooks/useMinioUpload';

// Mock fetch
global.fetch = jest.fn();

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  upload = {
    addEventListener: jest.fn(),
  };
  addEventListener = jest.fn();
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
  status = 200;
}

(global as any).XMLHttpRequest = MockXMLHttpRequest;

describe('useMinioUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该正确初始化状态', () => {
    const { result } = renderHook(() =>
      useMinioUpload({
        bucket: 'public',
      })
    );

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
    expect(result.current.isUploading).toBe(false);
  });

  it('应该在文件大小超限时返回错误', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useMinioUpload({
        bucket: 'public',
        maxSize: 1024, // 1KB
        onError,
      })
    );

    const largeFile = new File(['x'.repeat(2048)], 'large.txt', {
      type: 'text/plain',
    });

    await act(async () => {
      try {
        await result.current.upload(largeFile);
      } catch (error) {
        // Expected error
      }
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('文件大小超过限制'));
    expect(result.current.state.status).toBe('error');
  });

  it('应该提供取消和重置功能', () => {
    const { result } = renderHook(() =>
      useMinioUpload({
        bucket: 'public',
      })
    );

    act(() => {
      result.current.cancel();
    });

    expect(result.current.state.status).toBe('idle');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.progress).toBe(0);
  });
});
