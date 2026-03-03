/**
 * AuthContext — 凌晨2点强制下线功能单元测试
 *
 * 覆盖场景：
 *  1. 昨晚23:00登录，今天03:00检测 → 踢出
 *  2. 今天01:00登录，今天03:00检测 → 踢出
 *  3. 今天03:00登录，今天03:30检测 → 安全（2点后登录）
 *  4. 今天01:30登录，今天01:50检测 → 安全（尚未到2点）
 *  5. 缺少 ehs_login_time              → 不崩溃，不误踢
 *  6. ehs_login_time 为非法字符串     → isNaN守卫生效，不崩溃
 *  7. 30秒轮询定时器                   → 跨越2点后下次轮询触发踢出
 *  8. 多标签页 storage 事件            → 其他 tab 登出，本 tab 同步下线
 *  9. 强制下线消息写入时序             → AUTO_LOGOUT_MSG_KEY 先于 ehs_user 清除
 * 10. 踢出后轮询不重复触发             → router.push 只调用一次
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// ─────────────────────────────────────────────────────────────────
// 模块 Mock
// ─────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

// 覆盖 jest.setup.js 里的全局 mock，使用同一个 mockPush 引用，便于断言
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// apiFetch fire-and-forget，不影响主流程，mock 为静默成功
jest.mock('@/lib/apiClient', () => ({
  apiFetch: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  }),
}));

// ─────────────────────────────────────────────────────────────────
// 常量 & 工具
// ─────────────────────────────────────────────────────────────────

const LOGIN_TIME_KEY = 'ehs_login_time';
const AUTO_LOGOUT_MSG_KEY = 'ehs_auto_logout_msg';

const MOCK_USER = {
  id: 'user-001',
  username: 'zhangsan',
  name: '张三',
  avatar: '',
  role: 'user' as const,
  department: '安全部',
  departmentId: 'dept-001',
  permissions: {},
};

/** 把 AuthProvider 作为 wrapper 供 renderHook 使用 */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

/** 生成指定日期 + 时分的 Date 对象（本地时区） */
function makeDate(dateStr: string, hours: number, minutes = 0, seconds = 0): Date {
  const d = new Date(dateStr);
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

/** 将用户写入 localStorage，模拟已登录状态 */
function seedLoggedInUser(loginDate: Date) {
  localStorage.setItem('ehs_user', JSON.stringify(MOCK_USER));
  localStorage.setItem(LOGIN_TIME_KEY, loginDate.getTime().toString());
}

// ─────────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────────

describe('AuthContext — 凌晨2点强制下线', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    mockPush.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 1：昨晚 23:00 登录，今天 03:00 检测 → 踢出
  // ────────────────────────────────────────────────────────────────
  it('场景1：昨晚 23:00 登录，今天 03:00 检测 → 踢出', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 0)); // 今天 03:00

    seedLoggedInUser(makeDate('2025-06-14', 23, 0)); // 昨晚 23:00

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('ehs_user')).toBeNull();
    expect(localStorage.getItem(LOGIN_TIME_KEY)).toBeNull();
    expect(localStorage.getItem(AUTO_LOGOUT_MSG_KEY)).toBe('长时间未操作，已自动下线');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 2：今天 01:00 登录，今天 03:00 检测 → 踢出
  // ────────────────────────────────────────────────────────────────
  it('场景2：今天 01:00 登录，今天 03:00 检测 → 踢出', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 0));

    seedLoggedInUser(makeDate('2025-06-15', 1, 0)); // 今天 01:00

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(AUTO_LOGOUT_MSG_KEY)).toBe('长时间未操作，已自动下线');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 3：今天 03:00 登录，今天 03:30 检测 → 安全（2点后登录）
  // ────────────────────────────────────────────────────────────────
  it('场景3：今天 03:00 登录，今天 03:30 检测 → 安全（2点后登录）', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 30));

    seedLoggedInUser(makeDate('2025-06-15', 3, 0)); // 今天 03:00（晚于 2 点）

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.user).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    expect(localStorage.getItem(AUTO_LOGOUT_MSG_KEY)).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 4：今天 01:30 登录，今天 01:50 检测 → 安全（未到2点）
  // ────────────────────────────────────────────────────────────────
  it('场景4：今天 01:30 登录，今天 01:50 检测 → 安全（未到凌晨2点）', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 1, 50));

    seedLoggedInUser(makeDate('2025-06-15', 1, 30));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.user).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 5：缺少 ehs_login_time → 不崩溃，不误踢
  // ────────────────────────────────────────────────────────────────
  it('场景5：缺少 ehs_login_time → 不踢出，不崩溃', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 0));

    // 有用户但没有登录时间戳
    localStorage.setItem('ehs_user', JSON.stringify(MOCK_USER));
    // 不设置 LOGIN_TIME_KEY

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.user).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 6：ehs_login_time 为非法字符串 → isNaN 守卫生效
  // ────────────────────────────────────────────────────────────────
  it('场景6：ehs_login_time = "被篡改的非数字" → isNaN守卫阻止误判', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 0));

    localStorage.setItem('ehs_user', JSON.stringify(MOCK_USER));
    localStorage.setItem(LOGIN_TIME_KEY, 'hacked-value-abc'); // 非法值

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    // 不应崩溃，也不应误踢
    expect(result.current.user).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 7：30秒轮询 — 初始未到2点，推进时间后被踢出
  // ────────────────────────────────────────────────────────────────
  it('场景7：01:55登录，推进时间到02:05后轮询触发踢出', async () => {
    // 初始时间：01:55（距2点还差5分钟）
    jest.setSystemTime(makeDate('2025-06-15', 1, 55));

    seedLoggedInUser(makeDate('2025-06-15', 1, 0));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    // 初始检测：还未到2点，不踢出
    expect(result.current.user).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();

    // 将系统时间推进到 02:05，同时推进定时器以触发 setInterval 回调
    await act(async () => {
      jest.setSystemTime(makeDate('2025-06-15', 2, 5));
      jest.advanceTimersByTime(30 * 1000 + 100); // 触发一次 30s interval
    });

    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem(AUTO_LOGOUT_MSG_KEY)).toBe('长时间未操作，已自动下线');
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 8：多标签页 storage 事件 — 其他 tab 登出，本 tab 同步下线
  // ────────────────────────────────────────────────────────────────
  it('场景8：其他标签页清除 ehs_user → 本标签页收到 storage 事件后同步下线', async () => {
    // 本 tab：用户在 08:00 登录，当前是 10:00（不在2点踢出范围）
    jest.setSystemTime(makeDate('2025-06-15', 10, 0));
    seedLoggedInUser(makeDate('2025-06-15', 8, 0));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    // 本 tab 正常在线
    expect(result.current.user).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();

    // 模拟另一个标签页执行了强制下线（先写消息，再移除用户）
    localStorage.setItem(AUTO_LOGOUT_MSG_KEY, '长时间未操作，已自动下线');
    localStorage.removeItem('ehs_user');

    // 手动触发 storage 事件（jsdom 不会跨 tab 自动触发，需手动 dispatch）
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'ehs_user',
          oldValue: JSON.stringify(MOCK_USER),
          newValue: null,
          storageArea: localStorage,
        })
      );
    });

    // 本 tab 收到信号后同步下线
    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 9：消息写入时序 — AUTO_LOGOUT_MSG_KEY 必须先于 ehs_user 被清除
  // ────────────────────────────────────────────────────────────────
  it('场景9：AUTO_LOGOUT_MSG_KEY 在 ehs_user 被删除之前写入（多 tab 时序保证）', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 0));
    seedLoggedInUser(makeDate('2025-06-15', 1, 0));

    // 记录所有 localStorage 操作及其全局顺序
    const opLog: { type: 'set' | 'remove'; key: string }[] = [];

    const origSet = Storage.prototype.setItem;
    const origRemove = Storage.prototype.removeItem;

    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      opLog.push({ type: 'set', key });
      origSet.call(this, key, value);
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (key) {
      opLog.push({ type: 'remove', key });
      origRemove.call(this, key);
    });

    renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    jest.restoreAllMocks();

    // 找到关键操作的全局顺序索引
    const msgSetIdx = opLog.findIndex(
      (op) => op.type === 'set' && op.key === AUTO_LOGOUT_MSG_KEY
    );
    const userRemoveIdx = opLog.findIndex(
      (op) => op.type === 'remove' && op.key === 'ehs_user'
    );

    expect(msgSetIdx).toBeGreaterThanOrEqual(0); // 消息确实被写入
    expect(userRemoveIdx).toBeGreaterThanOrEqual(0); // ehs_user 确实被删除
    expect(msgSetIdx).toBeLessThan(userRemoveIdx);  // 消息写入在前 ✅
  });

  // ────────────────────────────────────────────────────────────────
  // 场景 10：踢出后轮询不重复触发
  // ────────────────────────────────────────────────────────────────
  it('场景10：强制踢出后，后续30s轮询不再重复调用 router.push', async () => {
    jest.setSystemTime(makeDate('2025-06-15', 3, 0));
    seedLoggedInUser(makeDate('2025-06-15', 1, 0));

    renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    // 初次检测已触发踢出
    expect(mockPush).toHaveBeenCalledTimes(1);

    // 继续推进 90 秒（触发 3 次 interval）
    await act(async () => {
      jest.advanceTimersByTime(90 * 1000);
    });

    // ehs_user 已清除，checkForceLogout 会 early-return，不重复触发
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
