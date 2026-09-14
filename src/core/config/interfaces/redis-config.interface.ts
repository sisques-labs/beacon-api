export interface IRedisConfig {
  host: string;
  port: number;
  password: string | undefined;
  db: number;
}
