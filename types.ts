
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
  comfortMessage: string;
  quote: string;
}

export interface UserInfo {
  name: string;
  email: string;
}

export interface ColorData {
  id: ColorType;
  hex: string;
  label: string;
}
