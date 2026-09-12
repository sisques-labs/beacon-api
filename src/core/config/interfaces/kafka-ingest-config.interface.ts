export interface IKafkaIngestConfig {
  enabled: boolean;
  topic: string;
  groupId: string;
}
