
import { ColorType, DiagnosisResult, UserInfo } from "../types";

/**
 * 사용자가 제공한 Google Apps Script 배포 URL입니다.
 * 이 URL을 통해 POST 요청을 보내면 구글 스프레드시트에 데이터가 행으로 추가됩니다.
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9XXo5faXLCCEz27g1LWzsFA_rCWylYuP_4lUcpr_lA0Y6OyyRkGXGx8HWf0HMHdrxJQ/exec';

export async function logToGoogleSheet(userInfo: UserInfo, color: string, result: DiagnosisResult) {
  // 페이로드 구성
  const payload = {
    name: userInfo.name,
    email: userInfo.email,
    color: color,
    message: result.message,
    flower: result.flower,
    scent: result.scent
  };

  try {
    // Google Apps Script는 리다이렉션이 발생하므로 mode: 'no-cors'를 사용하는 것이 일반적입니다.
    // 이 경우 응답 내용을 직접 읽을 수는 없지만, 데이터는 성공적으로 전송됩니다.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    console.log('데이터가 구글 시트로 성공적으로 전송되었습니다.');
    return true;
  } catch (error) {
    console.error('구글 시트 저장 중 오류 발생:', error);
    return false;
  }
}
