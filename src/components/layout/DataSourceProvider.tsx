"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

export type DataSource = "api" | "api-partial" | "mock" | "none";
export type BackendRequestStatus =
  | "idle"
  | "checking"
  | "requesting"
  | "success"
  | "timeout"
  | "failed"
  | "fallback-mock";
type DataSourceContextValue = {
  dataSource: DataSource;
  setDataSource: (dataSource: DataSource) => void;
  backendStatus: BackendRequestStatus;
  setBackendStatus: (status: BackendRequestStatus) => void;
  isRunningAnalysis: boolean;
  setIsRunningAnalysis: (isRunning: boolean) => void;
};

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [dataSource, setDataSource] = useState<DataSource>("none");
  const [backendStatus, setBackendStatus] =
    useState<BackendRequestStatus>("idle");
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);

  const value = useMemo<DataSourceContextValue>(
    () => ({
      dataSource,
      setDataSource,
      backendStatus,
      setBackendStatus,
      isRunningAnalysis,
      setIsRunningAnalysis,
    }),
    [backendStatus, dataSource, isRunningAnalysis]
  );

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const context = useContext(DataSourceContext);

  if (!context) {
    throw new Error("useDataSource must be used within DataSourceProvider");
  }

  return context;
}
