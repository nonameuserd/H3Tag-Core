declare module "pm2" {
  interface PM2Config {
    name: string;
    script: string;
    instances?: number;
    exec_mode?: "cluster" | "fork";
    max_memory_restart?: string;
    env?: Record<string, any>;
    log_date_format?: string;
    error_file?: string;
    out_file?: string;
    merge_logs?: boolean;
    autorestart?: boolean;
    watch?: boolean;
    max_restarts?: number;
    restart_delay?: number;
  }

  export function connect(cb: (err: Error | null) => void): void;
  export function start(
    config: PM2Config,
    cb: (err: Error | null) => void
  ): void;
  export function disconnect(): void;
  export function deleteProcess(
    name: string,
    cb?: (err: Error | null) => void
  ): void;
  export function restart(name: string, cb?: (err: Error | null) => void): void;
  export function stop(name: string, cb?: (err: Error | null) => void): void;
  export function list(cb: (err: Error | null, list: any[]) => void): void;
}
