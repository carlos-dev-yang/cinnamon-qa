export interface Container {
  id: string;
  name: string;
  port: number;
  sseUrl: string;
  status: ContainerStatus;
}

export enum ContainerStatus {
  STARTING = 'starting',
  AVAILABLE = 'available',
  ALLOCATED = 'allocated',
  UNHEALTHY = 'unhealthy',
  RESTARTING = 'restarting',
}

export interface ContainerState {
  containerId: string;
  port: number;
  allocated: boolean;
  allocatedTo?: string; // testRunId
  allocatedAt?: Date;
  lastCheckedAt?: Date;
}

export interface ContainerPoolConfig {
  containers: {
    id: string;
    name: string;
    port: number;
  }[];
}

export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
}