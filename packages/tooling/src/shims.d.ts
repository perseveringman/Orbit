declare module 'node:path' {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'vitest/config' {
  export interface UserConfig {
    test?: {
      environment?: string;
      include?: string[];
    };
    resolve?: {
      alias?: Record<string, string>;
    };
  }

  export function defineConfig(config: UserConfig): UserConfig;
}
