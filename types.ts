
export enum ColorType {
  RED = 'RED',
  YELLOW = 'YELLOW',
  BLUE = 'BLUE',
  GREEN = 'GREEN',
  PURPLE = 'PURPLE',
  WHITE = 'WHITE'
}

export interface DiagnosisResult {
  message: string;
  needs: string;
  tips: string;
  flower: string;
  scent: string;
  garden: string;
  comfortMessage: string;
  quote: string;
  instagramSummary: string;
  hashtags: string[];
}

export interface UserInfo {
  name: string;
  email: string;
  phone?: string;
  nickname?: string;
  ageGroup?: string;
  gender?: string;
  situation?: string[];
  concern?: string;
  notificationTime?: string;
}

export interface ColorData {
  id: ColorType;
  hex: string;
  label: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
