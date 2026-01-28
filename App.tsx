
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ColorType, UserInfo, DiagnosisResult, ColorData, ChatMessage } from './types';
import { COLORS, ICONS } from './constants';
import { getDiagnosis, createCounselingChat } from './services/geminiService';
import { logToGoogleSheet, updateCreditsInSheet, fetchCredits } from './services/googleSheetService';
import { Chat } from '@google/genai';

const RenderText: React.FC<{ text: string; pointColor?: string }> = ({ text, pointColor }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => 
        part.startsWith('**') && part.endsWith('**') 
          ? <b key={i} className="font-black" style={{ color: pointColor || '#8E4D5D' }}>{part.slice(2, -2)}</b> 
          : part
      )}
    </>
  );
};

const CanInfographic: React.FC<{ color?: string; size?: 'sm' | 'lg' }> = ({ color, size = 'sm' }) => (
  <div className={`relative ${size === 'lg' ? 'w-16 h-28' : 'w-10 h-16'} mx-auto mb-4 group opacity-90 floating`}>
    <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${size === 'lg' ? 'w-12 h-2.5' : 'w-8 h-1.5'} bg-gray-200 rounded-t-lg border-b border-gray-300 shadow-sm`}></div>
    <div 
      className={`absolute ${size === 'lg' ? 'top-2.5 h-24' : 'top-1.5 h-13'} left-0 w-full rounded-b-xl shadow-lg transition-all duration-700 overflow-hidden`} 
      style={{ backgroundColor: color || '#ddd' }}
    >
      <div className="absolute top-0 left-1 w-1/3 h-full bg-white/20 blur-[1px]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 aspect-square border-2 border-white/30 rounded-full flex items-center justify-center">
         <div className="w-1/2 h-1/2 bg-white/40 rounded-full blur-sm"></div>
      </div>
    </div>
    <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 ${size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} border-2 border-gray-300 rounded-full bg-white/50 shadow-sm`}></div>
  </div>
);

const FallbackLogo = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <defs>
      <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#FF4D4D' }} />
        <stop offset="25%" style={{ stopColor: '#FFBF2F' }} />
        <stop offset="50%" style={{ stopColor: '#27C485' }} />
        <stop offset="75%" style={{ stopColor: '#3F8CFF' }} />
        <stop offset="100%" style={{ stopColor: '#9D6BFF' }} />
      </linearGradient>
    </defs>
    <path fill="url(#rainbow)" d="M50 88.9L42.7 82.3C16.9 58.9 0 43.6 0 24.8 0 9.4 12.1 0 27.5 0c8.7 0 17 4.1 22.5 10.5C55.5 4.1 63.8 0 72.5 0 87.9 0 100 9.4 100 24.8c0 18.8-16.9 34.1-42.7 57.5L50 88.9z" />
  </svg>
);

const App: React.FC = () => {
  const [step, setStep] = useState<number>(0);
  const [userInfo, setUserInfo] = useState<UserInfo & { agreed: boolean }>({ 
    name: '', 
    email: '', 
    phone: '', 
    nickname: '',
    ageGroup: '',
    gender: '',
    situation: [],
    concern: '',
    notificationTime: '',
    agreed: false 
  });
  const [userCredits, setUserCredits] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<ColorData | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [logoError, setLogoError] = useState(false);

  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 5) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  const handleUserInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userInfo.name && userInfo.email && userInfo.agreed) {
      setStep(1);
    } else if (!userInfo.agreed) {
      alert('동의가 필요합니다.');
    }
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo.nickname || !userInfo.ageGroup || !userInfo.concern || (userInfo.situation?.length === 0) || !userInfo.phone) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await updateCreditsInSheet(userInfo, 'REGISTER', 200);
      setUserCredits(200);
      setStep(2);
    } catch (err) {
      console.error('Sheet update failed', err);
      setUserCredits(200);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnosis = async () => {
    if (!selectedColor) return;
    if (userCredits < 30) {
      alert(`에너지가 부족합니다. (현재: ${userCredits})`);
      return;
    }
    setLoading(true);
    setStep(3);
    try {
      const diagResult = await getDiagnosis(userInfo, selectedColor.id);
      setResult(diagResult);
      setUserCredits(prev => prev - 30);
      await logToGoogleSheet(userInfo, selectedColor.label, diagResult, 'DEDUCT', -30);
      setStep(4);
    } catch (err) {
      alert('진단 중 오류 발생');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    const inviteMessage = `[컬러하트캔] ${userInfo.name}님이 보내신 마음 에너지! ✨ 나만의 컬러 캔을 열어보세요. ${window.location.origin}${window.location.pathname}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ColorHeartCan',
          text: inviteMessage,
          url: window.location.href
        });
        // 공유 성공 시에만 지급 (모바일 공유창 띄우기 성공 기준)
        alert('에너지가 전달되었습니다! +30 크레딧');
        setUserCredits(prev => prev + 30);
        await updateCreditsInSheet(userInfo, 'ADD', 30);
      } else {
        // 데스크탑/비지원 브라우저 폴백
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(inviteMessage);
          alert('초대 링크가 복사되었습니다! 친구에게 전달해주세요. +30 크레딧');
          setUserCredits(prev => prev + 30);
          await updateCreditsInSheet(userInfo, 'ADD', 30);
        } else {
          alert('공유 기능을 지원하지 않는 브라우저입니다.');
        }
      }
    } catch (err) {
      // 사용자가 공유를 취소한 경우 등
      console.log('Share action cancelled or failed:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const startCounseling = () => {
    if (!result || !selectedColor) return;
    const session = createCounselingChat(userInfo, selectedColor.label, result.message);
    setChatSession(session);
    setMessages([{ role: 'model', text: `${userInfo.nickname || userInfo.name}님, 오늘 선택하신 ${selectedColor.label} 색상에 대해 더 깊이 이야기 나눠볼까요?` }]);
    setStep(5);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !chatSession || isChatLoading) return;
    const userMsg = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);
    try {
      const response = await chatSession.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "잠시 후 다시 시도해주세요." }]);
    } finally { setIsChatLoading(false); }
  };

  const renderHeader = () => (
    <header className="fixed top-0 left-0 w-full p-4 flex justify-between items-center z-50 no-print">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 flex items-center justify-center">
          {logoError ? (
            <div className="w-7 h-7"><FallbackLogo /></div>
          ) : (
            <img 
              src="./logo.png" 
              onError={() => setLogoError(true)}
              className="w-full h-full object-contain"
              alt="Logo" 
            />
          )}
        </div>
        <h1 className="serif text-base font-bold text-gray-800 tracking-tight">ColorHeartCan</h1>
      </div>
      {step > 1 && (
        <div className="glass-card px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-white/70">
          <span className="text-[8px] font-black uppercase text-gray-500">Energy</span>
          <span className="text-sm font-black text-gray-800 tabular-nums">{userCredits}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>
        </div>
      )}
    </header>
  );

  const renderStep0 = () => (
    <div className="max-w-md w-full mx-auto animate-fadeIn py-32 px-6">
      <div className="text-center mb-8">
        <div className="w-24 h-24 bg-white/70 rounded-full mx-auto flex items-center justify-center shadow-xl mb-6 floating overflow-hidden border-4 border-white">
          {logoError ? (
            <div className="w-14 h-14"><FallbackLogo /></div>
          ) : (
            <img 
              src="./logo.png" 
              onError={() => setLogoError(true)}
              className="w-full h-full object-contain p-2"
              alt="Main Logo"
            />
          )}
        </div>
        <h2 className="serif text-3xl font-bold text-gray-800 leading-tight">컬러 한 캔으로 여는<br/><span className="italic text-pink-500">마음 아카이브</span></h2>
      </div>
      <div className="glass-card p-8 rounded-[35px] shadow-md">
        <form onSubmit={handleUserInfoSubmit} className="space-y-4">
          <input 
            type="text" 
            required 
            className="w-full px-5 py-4 rounded-xl bg-white/70 border-2 border-pink-200 focus:border-pink-400 focus:ring-0 outline-none font-bold text-sm transition-all placeholder:text-gray-400 text-gray-700 shadow-sm" 
            placeholder="이름" 
            value={userInfo.name} 
            onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })} 
          />
          <input 
            type="email" 
            required 
            className="w-full px-5 py-4 rounded-xl bg-white/70 border-2 border-pink-200 focus:border-pink-400 focus:ring-0 outline-none font-bold text-sm transition-all placeholder:text-gray-400 text-gray-700 shadow-sm" 
            placeholder="이메일" 
            value={userInfo.email} 
            onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })} 
          />
          <label className="flex items-center gap-3 cursor-pointer pt-2 group">
            <input type="checkbox" required className="w-4 h-4 rounded border-pink-300 text-pink-500 focus:ring-pink-200 transition-colors" checked={userInfo.agreed} onChange={(e) => setUserInfo({ ...userInfo, agreed: e.target.checked })} />
            <span className="text-[10px] text-gray-500 font-semibold group-hover:text-gray-800 transition-colors">개인정보 수집 및 200 크레딧 증정 동의</span>
          </label>
          <button type="submit" className="w-full py-4 pastel-btn-pink font-black rounded-xl shadow-lg text-sm mt-2">
            다음 단계로
          </button>
        </form>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="max-w-xl w-full mx-auto animate-fadeIn py-32 px-6">
      <div className="glass-card p-8 md:p-12 rounded-[40px] shadow-xl space-y-10">
        <h2 className="serif text-2xl font-bold text-gray-800 border-b border-pink-100 pb-4">나에게 딱 맞는 컬러 처방을 위해</h2>
        
        <form onSubmit={handleSurveySubmit} className="space-y-12">
          {/* 1. 닉네임 */}
          <div className="space-y-3">
            <label className="block text-[13px] font-black text-gray-700">1) 닉네임/호칭</label>
            <p className="text-[11px] text-gray-500 font-bold">어떻게 불러드리면 좋을까요?</p>
            <input 
              type="text" 
              required
              className="w-full px-5 py-3.5 rounded-xl bg-white/70 border-2 border-pink-100 focus:border-pink-300 outline-none font-bold text-sm transition-all" 
              placeholder="예) 자영님, 민수, MJ 등" 
              value={userInfo.nickname}
              onChange={(e) => setUserInfo({ ...userInfo, nickname: e.target.value })}
            />
          </div>

          {/* 2. 연령대 */}
          <div className="space-y-3">
            <label className="block text-[13px] font-black text-gray-700">2) 나이 / 연령대</label>
            <p className="text-[11px] text-gray-500 font-bold">연령대를 알려주세요.</p>
            <div className="grid grid-cols-3 gap-2">
              {['10대', '20대', '30대', '40대', '50대', '60대 이상'].map(age => (
                <button 
                  key={age} 
                  type="button"
                  onClick={() => setUserInfo({ ...userInfo, ageGroup: age })}
                  className={`py-2.5 rounded-xl border-2 text-[11px] font-black transition-all ${userInfo.ageGroup === age ? 'bg-pink-400 border-pink-400 text-white shadow-md' : 'bg-white/50 border-pink-50 text-gray-500 hover:border-pink-200'}`}
                >
                  {age}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 font-bold italic">연령대에 따라 말투와 예시에 조금씩 변화를 줄 거예요.</p>
          </div>

          {/* 3. 성별 */}
          <div className="space-y-3">
            <label className="block text-[13px] font-black text-gray-700">3) 성별 (선택)</label>
            <p className="text-[11px] text-gray-500 font-bold">성별을 선택해도 되고, 건너뛰어도 괜찮아요.</p>
            <div className="flex gap-2">
              {['여자', '남자', '선택하지 않음'].map(g => (
                <button 
                  key={g} 
                  type="button"
                  onClick={() => setUserInfo({ ...userInfo, gender: g })}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-[11px] font-black transition-all ${userInfo.gender === g ? 'bg-blue-400 border-blue-400 text-white shadow-md' : 'bg-white/50 border-blue-50 text-gray-500 hover:border-blue-200'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 상황 */}
          <div className="space-y-3">
            <label className="block text-[13px] font-black text-gray-700">4) 현재 상황(사회 환경)</label>
            <p className="text-[11px] text-gray-500 font-bold">현재 나와 가장 가까운 상황을 골라주세요. (복수 선택 가능)</p>
            <div className="flex flex-wrap gap-2">
              {['학생 (중·고·대)', '취업/진학 준비 중', '직장인 (회사원/프리랜서)', '육아/가사 중심', '쉬는 중/휴직/전환기', '기타'].map(sit => (
                <button 
                  key={sit} 
                  type="button"
                  onClick={() => {
                    const current = userInfo.situation || [];
                    const next = current.includes(sit) ? current.filter(x => x !== sit) : [...current, sit];
                    setUserInfo({ ...userInfo, situation: next });
                  }}
                  className={`px-4 py-2.5 rounded-xl border-2 text-[10px] font-black transition-all ${userInfo.situation?.includes(sit) ? 'bg-green-400 border-green-400 text-white shadow-md' : 'bg-white/50 border-green-50 text-gray-500 hover:border-green-200'}`}
                >
                  {sit}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 font-bold italic">상황에 따라 케어 메시지 내용과 예시를 조금씩 바꿔 드려요.</p>
          </div>

          {/* 5. 고민 */}
          <div className="space-y-3">
            <label className="block text-[13px] font-black text-gray-700">5) 요즘 가장 신경 쓰이는 것</label>
            <p className="text-[11px] text-gray-500 font-bold">요즘 마음을 가장 많이 차지하는 주제는 무엇인가요?</p>
            <div className="grid grid-cols-2 gap-2">
              {['공부/성적/입시', '진로/커리어/일', '인간관계/연애', '가족/육아', '건강/몸 상태', '이유 없이 무기력함', '그냥 막막함, 잘 모르겠음'].map(conc => (
                <button 
                  key={conc} 
                  type="button"
                  onClick={() => setUserInfo({ ...userInfo, concern: conc })}
                  className={`py-2.5 px-2 rounded-xl border-2 text-[10px] font-black transition-all ${userInfo.concern === conc ? 'bg-purple-400 border-purple-400 text-white shadow-md' : 'bg-white/50 border-purple-50 text-gray-500 hover:border-purple-200'}`}
                >
                  {conc}
                </button>
              ))}
            </div>
          </div>

          {/* 6. 알림 설정 및 폰번호 */}
          <div className="space-y-6 pt-6 border-t border-pink-100">
            <label className="block text-[13px] font-black text-gray-700">6) 알림 수신 & 선호 시간</label>
            <div className="space-y-3">
              <p className="text-[11px] text-gray-500 font-bold">케어 알림은 언제 받아보고 싶으세요?</p>
              <div className="flex gap-2">
                {['아침', '점심', '저녁'].map(time => (
                  <button 
                    key={time} 
                    type="button"
                    onClick={() => setUserInfo({ ...userInfo, notificationTime: time })}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-[11px] font-black transition-all ${userInfo.notificationTime === time ? 'bg-yellow-400 border-yellow-400 text-white shadow-md' : 'bg-white/50 border-yellow-50 text-gray-500 hover:border-yellow-200'}`}
                  >
                    {time === '아침' ? '아침 (07~09시)' : time === '점심' ? '점심 (12~14시)' : '저녁 (19~21시)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] text-gray-500 font-bold">전화번호 입력</p>
              <input 
                type="tel" 
                required
                className="w-full px-5 py-3.5 rounded-xl bg-white/70 border-2 border-pink-100 focus:border-pink-300 outline-none font-bold text-sm transition-all shadow-sm" 
                placeholder="전화번호 (알림톡 수신용)" 
                value={userInfo.phone} 
                onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })} 
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" required className="mt-1 w-4 h-4 rounded border-pink-300 text-pink-500 focus:ring-pink-200 transition-colors" />
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-700 font-black group-hover:text-pink-600 transition-colors">케어 알림을 카카오톡으로 받는 것에 동의합니다.</span>
                <span className="text-[9px] text-gray-400 font-bold mt-1">하루 1회 정도, 부담되지 않는 빈도로 보내드릴게요. 언제든지 ‘그만’이라고 답장하면 중단할 수 있어요.</span>
              </div>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 pastel-btn-pink font-black rounded-xl shadow-lg text-sm mt-4 disabled:opacity-50"
          >
            {loading ? '정보 저장 중...' : '마음 아카이브 시작하기 (+200 Credits)'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-4xl w-full mx-auto text-center py-32 px-6 animate-fadeIn">
      <h2 className="serif text-3xl md:text-4xl font-bold mb-4 text-gray-800">당신을 부르는 오늘의 컬러</h2>
      <p className="text-gray-500 font-bold tracking-widest uppercase text-[9px] mb-12">Select your inner resonance</p>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-16">
        {COLORS.map((color) => (
          <button 
            key={color.id} 
            onClick={() => setSelectedColor(color)} 
            className={`relative h-48 md:h-64 rounded-3xl transition-all duration-300 overflow-hidden shadow-lg border-4 ${selectedColor?.id === color.id ? 'border-white scale-105 z-10 shadow-2xl' : 'border-transparent hover:scale-[1.02]'}`}
            style={{ backgroundColor: color.hex }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            {selectedColor?.id === color.id && (
              <div className="absolute top-4 right-4 bg-white/90 rounded-full p-1 shadow-sm animate-fadeIn">
                <svg className="w-6 h-6 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <div className="absolute bottom-6 left-0 w-full text-center">
              <span className={`text-[12px] font-black tracking-widest text-white drop-shadow-md uppercase`}>{color.label}</span>
            </div>
          </button>
        ))}
      </div>
      <button disabled={!selectedColor || loading} onClick={handleDiagnosis} className={`w-full max-w-xs py-4 rounded-xl font-black transition-all shadow-md text-sm ${selectedColor && !loading ? 'pastel-btn-pink' : 'bg-white/50 text-gray-300 border border-white cursor-not-allowed'}`}>
        분석 캔 오픈 (30 Credits)
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="flex flex-col items-center justify-center py-48 text-center animate-pulse">
      <div className="w-10 h-10 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mb-6" />
      <h2 className="serif text-lg font-bold text-gray-600">마음의 주파수를 분석 중...</h2>
    </div>
  );

  const renderStep4 = () => result && (
    <div className="max-w-2xl w-full mx-auto space-y-4 py-24 px-6 animate-fadeInUp">
      <div className="glass-card rounded-[40px] overflow-hidden flex flex-col items-center text-center p-10 relative shadow-md border border-white/80">
        <div className="mb-6">
          <CanInfographic color={selectedColor?.hex} size="lg" />
        </div>
        <h2 className="serif text-2xl md:text-3xl font-bold text-gray-800 mb-6 leading-tight">
          "<RenderText text={result.instagramSummary} pointColor={selectedColor?.hex} />"
        </h2>
        <div className="flex flex-wrap justify-center gap-1.5">
          {result.hashtags.map((tag, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-white/60 text-[8px] font-black text-gray-500 border border-white shadow-sm">#{tag}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ResultBox title="갈망하는 욕구" content={result.needs} icon={<ICONS.Needs />} color={selectedColor?.hex} isFullWidth={true} />
        <ResultBox title="생활 속 실천" content={result.tips} icon={<ICONS.Tips />} color={selectedColor?.hex} isFullWidth={true} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResultBox title="치유의 꽃" content={result.flower} icon={<ICONS.Flower />} color={selectedColor?.hex} />
          <ResultBox title="정화의 향기" content={result.scent} icon={<ICONS.Scent />} color={selectedColor?.hex} />
        </div>
      </div>

      <div className="glass-card p-10 rounded-[35px] text-center shadow-md border border-white/80">
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">AI Insight</h3>
        <p className="text-base text-gray-700 leading-relaxed font-medium italic whitespace-pre-wrap">
          <RenderText text={result.message} pointColor={selectedColor?.hex} />
        </p>
        <div className="mt-6 pt-6 border-t border-white/50">
           <p className="serif text-gray-500 italic text-xs">"{result.quote}"</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-sm mx-auto no-print pt-4">
        <button onClick={startCounseling} className="w-full py-4 pastel-btn-pink font-black rounded-xl shadow-md flex items-center justify-center gap-2 text-sm">
          <span>심리 상담 대화</span> <ICONS.Message />
        </button>
        <button 
          onClick={handleInvite} 
          disabled={isSharing}
          className={`w-full py-4 pastel-btn-blue font-black rounded-xl shadow-md flex flex-col items-center justify-center text-sm transition-all ${isSharing ? 'opacity-50 cursor-wait' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span>{isSharing ? '연결 중...' : '나의 컬러 에너지 선물하기'}</span>
            <span className="bg-white/50 text-[8px] px-1.5 py-0.5 rounded-full">+30</span>
          </div>
        </button>
        <div className="flex gap-6 justify-center mt-2">
          <button onClick={() => window.print()} className="text-[9px] font-black text-gray-700 uppercase tracking-widest hover:text-black transition">Save PDF</button>
          <button onClick={() => setStep(2)} className="text-[9px] font-black text-gray-700 uppercase tracking-widest hover:text-black transition">Reset</button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="max-w-xl w-full mx-auto h-[75vh] flex flex-col glass-card rounded-[40px] overflow-hidden animate-fadeInUp mt-20 no-print shadow-2xl border border-white/90">
      <div className="p-5 border-b border-white/60 flex justify-between items-center bg-white/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 font-serif italic text-sm shadow-sm border border-white">AI</div>
          <h3 className="font-bold text-gray-800 text-[11px] tracking-tight">상담 아카이브</h3>
        </div>
        <button onClick={() => setStep(4)} className="text-gray-400 hover:text-gray-800 p-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] font-medium shadow-md leading-relaxed ${msg.role === 'user' ? 'pastel-btn-blue text-gray-800 rounded-tr-none' : 'bg-white/90 text-gray-800 rounded-tl-none border border-white/80'}`}>
              <RenderText text={msg.text} pointColor={selectedColor?.hex} />
            </div>
          </div>
        ))}
        {isChatLoading && <div className="text-[8px] text-gray-500 font-black ml-2 animate-pulse">ARCHIVING...</div>}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} className="p-4 bg-white/60 border-t border-white/60 flex gap-2">
        <input type="text" className="flex-1 px-4 py-3 rounded-xl bg-white/80 border-2 border-pink-50 focus:border-pink-300 outline-none text-[13px] font-bold text-gray-800 transition shadow-inner" placeholder="메시지를 입력하세요" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={isChatLoading} />
        <button type="submit" disabled={!inputText.trim() || isChatLoading} className="w-11 h-11 pastel-btn-pink rounded-xl flex items-center justify-center shadow-lg disabled:opacity-30"><svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen relative flex flex-col">
      {renderHeader()}
      <main className="flex-1 flex flex-col items-center">
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </main>
      <footer className="py-8 text-center text-[8px] font-black text-gray-500 uppercase tracking-[0.4em] no-print">&copy; 2025 ColorHeartCan Archive</footer>
    </div>
  );
};

const ResultBox = ({ title, content, icon, color, isFullWidth = false }: { title: string; content: string; icon: React.ReactNode; color?: string; isFullWidth?: boolean }) => (
  <div className={`glass-card p-6 rounded-3xl border border-white/90 shadow-sm ${isFullWidth ? 'w-full' : ''}`}>
    <div className="flex items-center gap-3 mb-3 pb-2 border-b border-white/50">
      <div className="p-1.5 bg-white/80 rounded-lg shadow-sm shrink-0" style={{ color: color }}>{icon}</div>
      <h3 className="text-[13px] font-black uppercase tracking-widest text-gray-600">{title}</h3>
    </div>
    <p className="text-gray-800 text-[14px] font-bold leading-relaxed px-1">
      <RenderText text={content} pointColor={color} />
    </p>
  </div>
);

export default App;
