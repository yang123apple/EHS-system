/**
 * 离线存储 Hook：基于 IndexedDB 的暂存和同步机制
 * 
 * 用途：
 * 1. 在断网情况下暂存表单数据
 * 2. 网络恢复时自动同步
 * 3. 提供离线状态检测
 */

import { useState, useEffect, useCallback } from 'react';

interface OfflineItem {
  id: string;
  type: 'permit' | 'sub_permit' | 'other';
  data: any;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
}

const DB_NAME = 'ehs_offline_storage';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sync';

/**
 * 初始化 IndexedDB
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * 保存数据到离线存储
 */
async function saveToOfflineStorage(item: Omit<OfflineItem, 'synced' | 'syncAttempts'>): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  const offlineItem: OfflineItem = {
    ...item,
    synced: false,
    syncAttempts: 0,
  };
  
  await new Promise<void>((resolve, reject) => {
    const request = store.put(offlineItem);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 从离线存储获取所有待同步项
 */
async function getPendingSyncItems(): Promise<OfflineItem[]> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('synced');
  
  return new Promise((resolve, reject) => {
    // IndexedDB：getAll 的 query 参数必须是 key/keyRange/null
    // 这里使用 IDBKeyRange.only(false) 来查询 synced === false
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 标记项为已同步
 */
async function markAsSynced(id: string): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.synced = true;
        const putRequest = store.put(item);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * 删除离线存储项
 */
async function deleteFromOfflineStorage(id: string): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 增加同步尝试次数
 */
async function incrementSyncAttempts(id: string): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        item.syncAttempts = (item.syncAttempts || 0) + 1;
        const putRequest = store.put(item);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * 同步单个项到服务器
 */
async function syncItem(item: OfflineItem): Promise<boolean> {
  // 🟢 将 id 提前到 try/catch 外，避免 catch 块访问不到（try 块内的 const 是块级作用域）
  const { type, data, id } = item;
  try {
    let url = '';
    let method = 'POST';
    let body: any = data;
    
    // 根据类型确定 API 端点
    if (type === 'permit') {
      url = '/api/permits';
      method = data.id ? 'PATCH' : 'POST';
      if (method === 'PATCH') {
        body = { id: data.id, ...data };
      }
    } else if (type === 'sub_permit') {
      url = '/api/sub-permits';
      method = data.id ? 'PATCH' : 'POST';
      if (method === 'PATCH') {
        body = { id: data.id, ...data };
      }
    } else {
      console.warn('[离线同步] 未知的类型:', type);
      return false;
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (response.ok) {
      await markAsSynced(id);
      console.log(`✅ [离线同步] 已同步项: ${id}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ [离线同步] 同步失败: ${id}`, error);
      await incrementSyncAttempts(id);
      return false;
    }
  } catch (error) {
    console.error(`❌ [离线同步] 同步出错: ${id}`, error);
    await incrementSyncAttempts(id);
    return false;
  }
}

/**
 * 离线存储 Hook
 */
export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 检测网络状态
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 [离线存储] 网络已恢复');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 [离线存储] 网络已断开');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 初始化网络状态
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // 定期检查待同步项数量
  useEffect(() => {
    const checkPending = async () => {
      try {
        const items = await getPendingSyncItems();
        setPendingCount(items.length);
      } catch (error) {
        console.error('[离线存储] 检查待同步项失败:', error);
      }
    };
    
    checkPending();
    const interval = setInterval(checkPending, 5000); // 每5秒检查一次
    
    return () => clearInterval(interval);
  }, []);
  
  // 网络恢复时自动同步
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      syncPendingItems();
    }
  }, [isOnline, pendingCount, isSyncing]);
  
  /**
   * 保存数据到离线存储
   */
  const saveOffline = useCallback(async (
    type: 'permit' | 'sub_permit' | 'other',
    data: any,
    id?: string
  ) => {
    const itemId = id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await saveToOfflineStorage({
        id: itemId,
        type,
        data,
        timestamp: Date.now(),
      });
      
      console.log(`💾 [离线存储] 已保存到离线存储: ${itemId}`);
      return itemId;
    } catch (error) {
      console.error('[离线存储] 保存失败:', error);
      throw error;
    }
  }, []);
  
  /**
   * 同步所有待同步项
   */
  const syncPendingItems = useCallback(async () => {
    if (isSyncing) {
      console.log('[离线同步] 正在同步中，跳过');
      return;
    }
    
    setIsSyncing(true);
    
    try {
      const items = await getPendingSyncItems();
      console.log(`🔄 [离线同步] 开始同步 ${items.length} 个待同步项`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const item of items) {
        // 如果同步尝试次数超过5次，跳过（避免无限重试）
        if (item.syncAttempts >= 5) {
          console.warn(`⚠️ [离线同步] 项 ${item.id} 同步尝试次数过多，跳过`);
          failCount++;
          continue;
        }
        
        const success = await syncItem(item);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        
        // 避免过快请求
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`✅ [离线同步] 同步完成: 成功 ${successCount}, 失败 ${failCount}`);
      
      // 更新待同步项数量
      const remaining = await getPendingSyncItems();
      setPendingCount(remaining.length);
    } catch (error) {
      console.error('[离线同步] 同步过程出错:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);
  
  /**
   * 清除已同步项
   */
  const clearSyncedItems = useCallback(async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('synced');
      
      // IndexedDB：openCursor 的 query 参数必须是 key/keyRange/null
      // 这里使用 IDBKeyRange.only(true) 来查询 synced === true
      const request = index.openCursor(IDBKeyRange.only(true)); // 只查询已同步的项
      
      return new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[离线存储] 清除已同步项失败:', error);
      throw error;
    }
  }, []);
  
  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveOffline,
    syncPendingItems,
    clearSyncedItems,
  };
}

