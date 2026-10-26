/**
 * Remote PostgreSQL (193.142.58.196) Client Service
 * Provides direct persistence, retrieval, and health status for market candle datasets.
 */

export interface CloudSqlStatus {
  success: boolean;
  connected: boolean;
  serverHost?: string;
  databaseName?: string;
  databaseUser?: string;
  dbSize?: string;
  dbSizeBytes?: number;
  datasetCount?: number;
  chunkCount?: number;
  totalCandlesStored?: number;
  hasAdequateSpace?: boolean;
  spaceNote?: string;
  error?: string;
}

export interface CloudSqlDatasetMeta {
  id: string;
  name: string;
  userId: string;
  timeframe: string;
  symbolCount: number;
  totalCandles: number;
  symbolsList?: string;
  dataSizeBytes?: number;
  dataSizeFormatted?: string;
  isTemporary?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Check Remote PostgreSQL connection health and storage capacity
 */
export async function getCloudSqlStatus(): Promise<CloudSqlStatus> {
  try {
    const res = await fetch('/api/cloudsql/status', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      return await res.json();
    }
    return {
      success: false,
      connected: false,
      error: `HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      connected: false,
      error: err?.message || 'خطا در ارتباط با سرور PostgreSQL اختصاصی (193.142.58.196)',
    };
  }
}

/**
 * Fetch list of all saved datasets in Remote PostgreSQL
 */
export async function getCloudSqlDatasets(): Promise<CloudSqlDatasetMeta[]> {
  try {
    const res = await fetch('/api/cloudsql/datasets', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.datasets)) {
        return data.datasets;
      }
    }
  } catch (e) {
    console.warn('Failed to load datasets from Remote PostgreSQL:', e);
  }
  return [];
}

/**
 * Save current server buffer or dataset to Remote PostgreSQL
 */
export async function saveDatasetToCloudSql(params: {
  name: string;
  userId?: string;
  timeframe?: string;
  isTemporary?: boolean;
  datasetId?: string;
}): Promise<{ success: boolean; datasetId?: string; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/cloudsql/save-dataset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        userId: params.userId || 'amir',
        timeframe: params.timeframe || '5m',
        isTemporary: !!params.isTemporary,
        datasetId: params.datasetId,
      }),
      signal: AbortSignal.timeout(90000), // allow up to 90s for large 700+ symbol datasets
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'خطا در ذخیره‌سازی بسته در سرور PostgreSQL اختصاصی',
    };
  }
}

/**
 * Load complete dataset candles from Remote PostgreSQL into server buffer & return entries
 */
export async function loadDatasetFromCloudSql(id: string): Promise<{
  success: boolean;
  metadata?: CloudSqlDatasetMeta;
  entries?: any[];
  count?: number;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/cloudsql/dataset/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(90000), // allow up to 90s for large datasets
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'خطا در بازیابی بسته از سرور PostgreSQL اختصاصی',
    };
  }
}

/**
 * Promote temporary dataset to permanent in Remote PostgreSQL
 */
export async function promoteDatasetInCloudSql(
  datasetId: string,
  newName: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/cloudsql/promote-dataset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetId, newName }),
      signal: AbortSignal.timeout(10000),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Delete a dataset and its candle chunks from Remote PostgreSQL
 */
export async function deleteDatasetFromCloudSql(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/cloudsql/dataset/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
