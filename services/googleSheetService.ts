
import { DiagnosisResult, UserInfo } from "../types";

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwc14kCoC4YnT3VPiwYcf0fQhtGMCxQ6PU-u_oS30MHz_bD93WZKAY_xrh28jkm0wjy0A/exec';

export type CreditAction = 'REGISTER' | 'DEDUCT' | 'ADD';

export async function fetchCredits(email: string): Promise<number> {
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?email=${encodeURIComponent(email)}`);
    const text = await response.text();
    const credits = parseInt(text);
    return isNaN(credits) ? 200 : credits;
  } catch (error) {
    console.error('크레딧 조회 실패:', error);
    return 200;
  }
}

export async function logToGoogleSheet(
  userInfo: UserInfo, 
  color: string, 
  result: DiagnosisResult, 
  action: CreditAction = 'DEDUCT',
  creditChange: number = -30
) {
  const payload = {
    action: action,
    name: userInfo.name,
    email: userInfo.email,
    phone: userInfo.phone,
    nickname: userInfo.nickname,
    ageGroup: userInfo.ageGroup,
    gender: userInfo.gender,
    situation: userInfo.situation?.join(', '),
    concern: userInfo.concern,
    notificationTime: userInfo.notificationTime,
    color: color,
    message: result.message,
    flower: result.flower,
    scent: result.scent,
    creditChange: creditChange,
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.error('구글 시트 로깅 실패:', error);
    return false;
  }
}

export async function updateCreditsInSheet(userInfo: UserInfo, action: CreditAction, amount: number) {
  const payload = {
    action: action,
    email: userInfo.email,
    name: userInfo.name,
    phone: userInfo.phone,
    nickname: userInfo.nickname,
    ageGroup: userInfo.ageGroup,
    gender: userInfo.gender,
    situation: userInfo.situation?.join(', '),
    concern: userInfo.concern,
    notificationTime: userInfo.notificationTime,
    creditChange: amount,
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    console.error('구글 시트 업데이트 실패:', error);
    return false;
  }
}
