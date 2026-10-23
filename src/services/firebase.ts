import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function logoutUser() {
  return signOut(auth);
}

export async function recordUserLoginInFirestore(username: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', username),
      {
        username,
        lastLogin: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('recordUserLoginInFirestore error:', err);
  }
}

export async function saveUserSettings(userId: string, settings: any) {
  try {
    await setDoc(doc(db, 'users', userId), { settings, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('Saving settings to Firestore failed:', e);
    return false;
  }
}

export async function loadUserSettings(userId: string) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      return snap.data()?.settings;
    }
  } catch (e) {
    console.warn('Failed to load user settings from Firestore:', e);
  }
  return null;
}

export interface AllowedPairsRecord {
  id: string;
  userId: string;
  exchange: 'xt' | 'binance';
  listName: string;
  symbols: string[];
  count: number;
  createdAt: string;
  updatedAt: string;
}

const MAX_SAVED_LISTS_PER_EXCHANGE = 10;

export async function saveAllowedPairsToFirestore(
  userId: string,
  symbols: string[],
  exchange: 'xt' | 'binance' = 'xt',
  listName: string = 'پیش‌فرض'
): Promise<{ success: boolean; message: string; record?: AllowedPairsRecord }> {
  const safeUserId = userId || 'default_user';
  const cleanName = (listName || 'پیش‌فرض').trim();
  const slug = cleanName.toLowerCase().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const docId = `${safeUserId}_${exchange}_${slug}`;

  // First check existing lists to enforce max 10 lists per exchange
  let existingLists = await loadAllAllowedPairsListsFromFirestore(safeUserId, exchange);
  const isUpdatingExisting = existingLists.some((item) => item.id === docId || item.listName === cleanName);

  if (!isUpdatingExisting && existingLists.length >= MAX_SAVED_LISTS_PER_EXCHANGE) {
    return {
      success: false,
      message: `حداکثر می‌توانید تا ${MAX_SAVED_LISTS_PER_EXCHANGE} لیست اختصاصی برای صرافی ${exchange.toUpperCase()} ذخیره کنید. لطفاً ابتدا یکی از لیست‌های قبلی را حذف کنید.`,
    };
  }

  const now = new Date().toISOString();
  const existingRecord = existingLists.find((item) => item.id === docId || item.listName === cleanName);
  const record: AllowedPairsRecord = {
    id: docId,
    userId: safeUserId,
    exchange,
    listName: cleanName,
    symbols,
    count: symbols.length,
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, 'allowedPairs', docId);
    await setDoc(docRef, record, { merge: true });
    if (safeUserId) {
      await setDoc(
        doc(db, 'users', safeUserId),
        {
          settings: {
            [`backtestAllowedPairs_${exchange}`]: symbols,
            [`lastPairsList_${exchange}`]: cleanName,
          },
          updatedAt: now,
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('saveAllowedPairsToFirestore cloud error, saving to localStorage:', err);
  }

  // Update local cache of lists
  try {
    const localKey = `allowed_pairs_lists_${safeUserId}_${exchange}`;
    const updated = existingLists.filter((item) => item.id !== docId && item.listName !== cleanName);
    updated.unshift(record);
    localStorage.setItem(localKey, JSON.stringify(updated.slice(0, MAX_SAVED_LISTS_PER_EXCHANGE)));
    localStorage.setItem(`backtest_selected_allowed_symbols_${exchange}`, JSON.stringify(symbols));
    localStorage.setItem('backtest_selected_allowed_symbols', JSON.stringify(symbols));
  } catch {}

  return {
    success: true,
    message: `لیست «${cleanName}» با موفقیت در دیتابیس صرافی ${exchange.toUpperCase()} ذخیره شد.`,
    record,
  };
}

export async function loadAllAllowedPairsListsFromFirestore(
  userId: string,
  exchange: 'xt' | 'binance' = 'xt'
): Promise<AllowedPairsRecord[]> {
  const safeUserId = userId || 'default_user';
  const lists: AllowedPairsRecord[] = [];

  try {
    const coll = collection(db, 'allowedPairs');
    const snap = await getDocs(coll);
    snap.forEach((d) => {
      const data = d.data() as AllowedPairsRecord;
      if (data && (data.userId === safeUserId || data.userId === 'amir' || !data.userId)) {
        if (!data.exchange || data.exchange === exchange) {
          lists.push({ ...data, id: d.id, exchange: data.exchange || exchange });
        }
      }
    });

    if (lists.length > 0) {
      // Sort newest first
      lists.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      // Save to localStorage mirror
      try {
        localStorage.setItem(`allowed_pairs_lists_${safeUserId}_${exchange}`, JSON.stringify(lists));
      } catch {}
      return lists.slice(0, MAX_SAVED_LISTS_PER_EXCHANGE);
    }
  } catch (err) {
    console.warn('loadAllAllowedPairsListsFromFirestore error, trying localStorage:', err);
  }

  // Fallback to localStorage
  try {
    const localKey = `allowed_pairs_lists_${safeUserId}_${exchange}`;
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, MAX_SAVED_LISTS_PER_EXCHANGE);
      }
    }
  } catch {}

  return [];
}

export async function deleteAllowedPairsFromFirestore(
  userId: string,
  docId: string,
  exchange: 'xt' | 'binance' = 'xt'
): Promise<boolean> {
  const safeUserId = userId || 'default_user';
  try {
    await deleteDoc(doc(db, 'allowedPairs', docId));
  } catch (err) {
    console.warn('deleteAllowedPairsFromFirestore error:', err);
  }

  try {
    const localKey = `allowed_pairs_lists_${safeUserId}_${exchange}`;
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed: AllowedPairsRecord[] = JSON.parse(cached);
      const filtered = parsed.filter((item) => item.id !== docId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
    }
  } catch {}

  return true;
}

export async function loadAllowedPairsFromFirestore(
  userId: string,
  exchangeOrListName?: string,
  maybeListName?: string
): Promise<string[] | null> {
  const safeUserId = userId || 'default_user';
  const exchange: 'xt' | 'binance' = exchangeOrListName === 'binance' || exchangeOrListName === 'xt' ? exchangeOrListName : 'xt';
  const listName = maybeListName || (exchangeOrListName && exchangeOrListName !== 'binance' && exchangeOrListName !== 'xt' ? exchangeOrListName : 'پیش‌فرض');

  try {
    const lists = await loadAllAllowedPairsListsFromFirestore(safeUserId, exchange);
    if (lists.length > 0) {
      const match = lists.find((l) => l.listName === listName) || lists[0];
      if (match && Array.isArray(match.symbols) && match.symbols.length > 0) {
        return match.symbols;
      }
    }
  } catch {}

  try {
    const localList = localStorage.getItem(`backtest_selected_allowed_symbols_${exchange}`) || localStorage.getItem('backtest_selected_allowed_symbols');
    if (localList) {
      const parsed = JSON.parse(localList);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return null;
}

export interface TestParameterConfigRecord {
  id: string;
  name: string;
  userId?: string;
  timeframe?: string;
  capital?: number;
  riskMode?: 'percent' | 'fixed';
  riskAmountFixed?: number;
  riskPercent?: number;
  selectedStrategyId?: string;
  entryCommissionPercent?: number;
  exitCommissionPercent?: number;
  maxCandlesToEnter?: number;
  candleHistoryLimit?: number;
  optAtrPeriod?: number;
  optMinCandles?: number;
  optMinCandlesLong?: number;
  optAtrMultiplier?: number;
  optLongLegAtrMult?: number;
  optMaxBlueLegPercent?: number;
  optMaxBreakoutAtr?: number;
  optMaxRiskReward?: number;
  createdAt: string;
  updatedAt: string;
}

export async function saveTestConfigToFirestore(userId: string, record: TestParameterConfigRecord): Promise<boolean> {
  try {
    const docRef = doc(db, 'testConfigs', record.id);
    await setDoc(docRef, { ...record, userId, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('saveTestConfigToFirestore error:', err);
    try {
      const saved = JSON.parse(localStorage.getItem(`test_configs_${userId}`) || '[]');
      const filtered = saved.filter((r: any) => r.id !== record.id);
      filtered.push(record);
      localStorage.setItem(`test_configs_${userId}`, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }
}

export async function loadTestConfigsFromFirestore(userId: string): Promise<TestParameterConfigRecord[]> {
  try {
    const coll = collection(db, 'testConfigs');
    const snap = await getDocs(coll);
    const results: TestParameterConfigRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (!data.userId || data.userId === userId || userId === 'amir') {
        results.push({ ...data, id: d.id });
      }
    });
    if (results.length > 0) return results;
  } catch (err) {
    console.warn('loadTestConfigsFromFirestore error, using fallback:', err);
  }
  try {
    return JSON.parse(localStorage.getItem(`test_configs_${userId}`) || '[]');
  } catch {
    return [];
  }
}

export async function deleteTestConfigFromFirestore(userIdOrId: string, maybeId?: string): Promise<boolean> {
  const id = maybeId || userIdOrId;
  try {
    await deleteDoc(doc(db, 'testConfigs', id));
  } catch (e) {
    console.warn('deleteTestConfigFromFirestore error:', e);
  }
  return true;
}

export interface CandleDatasetProgress {
  currentChunk: number;
  totalChunks: number;
  percent: number;
  statusText: string;
}

export interface MarketCandleDatasetMetadata {
  id: string;
  name: string;
  userId: string;
  timeframe: string;
  symbolCount: number;
  totalCandles: number;
  symbolsList?: string[];
  chunkCount?: number;
  dataSizeBytes?: number;
  dataSizeFormatted?: string;
  isTemporary?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DatasetSizeStats {
  bytes: number;
  formatted: string;
  totalCandles: number;
}

export function calculateDatasetSizeInBytes(dataset: any): DatasetSizeStats {
  if (!dataset) return { bytes: 0, formatted: '0 MB', totalCandles: 0 };
  const entries = Array.isArray(dataset) ? dataset : [dataset];
  const totalCandles = entries.reduce((acc: number, curr: any) => acc + (curr?.candles?.length || curr?.totalCandles || 0), 0);
  const bytes = totalCandles * 65;
  const formatted = `${((bytes) / (1024 * 1024)).toFixed(2)} MB`;
  return { bytes, formatted, totalCandles };
}

export async function saveCandleDatasetToFirestore(
  userId: string,
  name: string,
  timeframe: string,
  cacheEntries: any[],
  onProgress?: (p: CandleDatasetProgress) => void,
  isTemporary: boolean = false
): Promise<{ success: boolean; id?: string }> {
  try {
    const datasetId = `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalCandles = cacheEntries.reduce((acc, curr) => acc + (curr?.candles?.length || 0), 0);
    const meta: MarketCandleDatasetMetadata = {
      id: datasetId,
      name,
      userId,
      timeframe,
      symbolCount: cacheEntries.length,
      totalCandles,
      symbolsList: cacheEntries.map((e) => e.pair?.symbol || e.symbol).filter(Boolean),
      chunkCount: Math.ceil(cacheEntries.length / 5),
      dataSizeBytes: totalCandles * 65,
      dataSizeFormatted: `${((totalCandles * 65) / (1024 * 1024)).toFixed(2)} MB`,
      isTemporary,
      createdAt: new Date().toISOString(),
    };

    onProgress?.({
      currentChunk: 0,
      totalChunks: meta.chunkCount || 1,
      percent: 10,
      statusText: 'در حال ذخیره‌سازی اطلاعات اولیه در دیتابیس...',
    });

    await setDoc(doc(db, 'candleDatasets', datasetId), meta);

    const CHUNK_SIZE = 5;
    const totalChunks = Math.ceil(cacheEntries.length / CHUNK_SIZE);

    for (let i = 0; i < cacheEntries.length; i += CHUNK_SIZE) {
      const chunkIdx = Math.floor(i / CHUNK_SIZE);
      const slice = cacheEntries.slice(i, i + CHUNK_SIZE);
      const chunkDocId = `${datasetId}_chk_${chunkIdx}`;

      await setDoc(doc(db, 'candleChunks', chunkDocId), {
        datasetId,
        chunkIndex: chunkIdx,
        itemsJson: JSON.stringify(slice),
        createdAt: new Date().toISOString(),
      });

      const percent = Math.min(95, Math.round(((chunkIdx + 1) / totalChunks) * 90) + 10);
      onProgress?.({
        currentChunk: chunkIdx + 1,
        totalChunks,
        percent,
        statusText: `در حال آپلود بخش ${chunkIdx + 1} از ${totalChunks}...`,
      });
    }

    onProgress?.({
      currentChunk: totalChunks,
      totalChunks,
      percent: 100,
      statusText: 'ذخیره‌سازی با موفقیت تکمیل شد.',
    });

    return { success: true, id: datasetId };
  } catch (err: any) {
    console.error('saveCandleDatasetToFirestore failed:', err);
    return { success: false };
  }
}

export async function makeTemporaryDatasetPermanent(
  userId: string,
  datasetId: string,
  newName: string
): Promise<boolean> {
  try {
    await setDoc(
      doc(db, 'candleDatasets', datasetId),
      {
        name: newName,
        isTemporary: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('makeTemporaryDatasetPermanent error:', err);
    return false;
  }
}

export async function loadCandleDatasetsListFromFirestore(userId: string): Promise<MarketCandleDatasetMetadata[]> {
  try {
    const snap = await getDocs(collection(db, 'candleDatasets'));
    const list: MarketCandleDatasetMetadata[] = [];
    snap.forEach((d) => {
      list.push(d.data() as MarketCandleDatasetMetadata);
    });
    return list;
  } catch (err) {
    console.warn('loadCandleDatasetsListFromFirestore error:', err);
    return [];
  }
}

export async function loadCandleDatasetDataFromFirestore(
  userIdOrDatasetId: string,
  datasetIdOrProgress?: any,
  maybeProgress?: any
): Promise<any[]> {
  const datasetId = typeof datasetIdOrProgress === 'string' ? datasetIdOrProgress : userIdOrDatasetId;
  const onProgress: ((p: CandleDatasetProgress) => void) | undefined =
    typeof datasetIdOrProgress === 'function' ? datasetIdOrProgress : maybeProgress;

  try {
    const metaSnap = await getDoc(doc(db, 'candleDatasets', datasetId));
    if (!metaSnap.exists()) return [];
    const meta = metaSnap.data() as MarketCandleDatasetMetadata;
    const chunkCount = meta.chunkCount || 1;

    const allEntries: any[] = [];
    for (let c = 0; c < chunkCount; c++) {
      const chunkDocId = `${datasetId}_chk_${c}`;
      const snap = await getDoc(doc(db, 'candleChunks', chunkDocId));
      if (snap.exists()) {
        const raw = snap.data();
        if (raw?.itemsJson) {
          const parsed = JSON.parse(raw.itemsJson);
          if (Array.isArray(parsed)) {
            allEntries.push(...parsed);
          }
        }
      }
      onProgress?.({
        currentChunk: c + 1,
        totalChunks: chunkCount,
        percent: Math.round(((c + 1) / chunkCount) * 100),
        statusText: `در حال دریافت بخش ${c + 1} از ${chunkCount}...`,
      });
    }
    return allEntries;
  } catch (err) {
    console.error('loadCandleDatasetDataFromFirestore error:', err);
    return [];
  }
}

export async function deleteCandleDatasetFromFirestore(userIdOrDatasetId: string, maybeDatasetId?: string): Promise<boolean> {
  const datasetId = maybeDatasetId || userIdOrDatasetId;
  try {
    await deleteDoc(doc(db, 'candleDatasets', datasetId));
    return true;
  } catch (err) {
    console.warn('deleteCandleDatasetFromFirestore error:', err);
    return false;
  }
}

export interface SavedBacktestConfigRecord {
  id: string;
  name: string;
  configData: any;
  createdAt: string;
  updatedAt: string;
}

export async function saveBacktestConfigToFirestore(
  userId: string,
  record: SavedBacktestConfigRecord
): Promise<boolean> {
  try {
    await setDoc(
      doc(db, 'backtestConfigs', record.id),
      {
        ...record,
        userId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('saveBacktestConfigToFirestore error:', err);
    return false;
  }
}

export async function loadBacktestConfigsFromFirestore(userId: string): Promise<SavedBacktestConfigRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'backtestConfigs'));
    const list: SavedBacktestConfigRecord[] = [];
    snap.forEach((d) => {
      list.push(d.data() as SavedBacktestConfigRecord);
    });
    return list;
  } catch (err) {
    console.warn('loadBacktestConfigsFromFirestore error:', err);
    return [];
  }
}

export async function deleteBacktestConfigFromFirestore(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'backtestConfigs', id));
    return true;
  } catch (err) {
    console.warn('deleteBacktestConfigFromFirestore error:', err);
    return false;
  }
}
