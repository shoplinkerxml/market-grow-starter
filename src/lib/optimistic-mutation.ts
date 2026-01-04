import { useEffect, useState } from "react";

export type SyncStatus = "synced" | "pending" | "error";

type EntityKey = string;

type StatusEntry = {
  status: SyncStatus;
  lastOpId: string;
  error?: unknown;
};

type Listener = () => void;

const statusMap = new Map<EntityKey, StatusEntry>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(entityKey: EntityKey): StatusEntry | undefined {
  return statusMap.get(entityKey);
}

function setStatus(entityKey: EntityKey, entry: StatusEntry) {
  statusMap.set(entityKey, entry);
  notify();
}

function generateOpId(): string {
  const rand = Math.random().toString(36).slice(2);
  const ts = Date.now().toString(36);
  return `${ts}-${rand}`;
}

export type OptimisticOperationOptions<T> = {
  entityKey: string;
  run: () => Promise<T>;
  applyOptimistic?: () => void;
  applyServer?: (serverEntity: T) => void;
  rollback?: () => void;
  onError?: (error: unknown) => void;
  strategy?: "rollback" | "soft-fail";
};

export async function runOptimisticOperation<T>(
  options: OptimisticOperationOptions<T>,
): Promise<T> {
  const opId = generateOpId();

  setStatus(options.entityKey, { status: "pending", lastOpId: opId });

  if (options.applyOptimistic) {
    options.applyOptimistic();
  }

  try {
    const result = await options.run();

    const current = statusMap.get(options.entityKey);
    if (current && current.lastOpId === opId) {
      setStatus(options.entityKey, { status: "synced", lastOpId: opId });
      if (options.applyServer) {
        options.applyServer(result);
      }
    }

    return result;
  } catch (error) {
    const current = statusMap.get(options.entityKey);
    if (!current || current.lastOpId !== opId) {
      throw error;
    }

    if (options.strategy === "rollback" && options.rollback) {
      options.rollback();
      setStatus(options.entityKey, { status: "synced", lastOpId: opId });
    } else {
      setStatus(options.entityKey, { status: "error", lastOpId: opId, error });
    }

    if (options.onError) {
      options.onError(error);
    }

    throw error;
  }
}

export function useSyncStatus(entityKey: string | null | undefined): StatusEntry | undefined {
  const [value, setValue] = useState<StatusEntry | undefined>(() =>
    entityKey ? statusMap.get(entityKey) : undefined,
  );

  useEffect(() => {
    if (!entityKey) {
      setValue(undefined);
      return;
    }

    const update = () => {
      setValue(statusMap.get(entityKey));
    };

    const unsubscribe = subscribeSyncStatus(update);
    update();

    return unsubscribe;
  }, [entityKey]);

  return value;
}

