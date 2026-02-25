
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface MeetingRecord {
  id: string;
  title: string;
  createdAt: number;
  rawTranscript: string;
  metadata: MeetingMetadata;
  correctedTranscript?: string;
  correctionLog?: string;
  insights: Record<string, string>; // Module ID -> Initial Content
  insightsHistory: Record<string, ChatMessage[]>; // Module ID -> Thread of messages
}

export interface MeetingMetadata {
  subject: string;
  keywords: string;
  speakers: string;
  terminology: string;
  length: string;
}

export enum AnalysisModule {
  A = 'A', // 氛圍與張力
  B = 'B', // 人物建模
  C = 'C', // 潛台詞與QBQ
  D = 'D', // 權力結構
  E = 'E'  // 摘要與結論
}
