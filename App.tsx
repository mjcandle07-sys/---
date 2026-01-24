
import React, { useState, useCallback, useRef } from 'react';
import { ColorType, UserInfo, DiagnosisResult, ColorData } from './types';
import { COLORS, ICONS } from './constants';
import { getDiagnosis } from './services/geminiService';
import { logToGoogleSheet } from './services/googleSheetService';

const App: React.FC = () => {
  const [step, setStep] = useState<number>(0); // 0: UserInfo, 1: ColorPicker, 2: Loading, 3: Result
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: '', email: '' });
  const [selectedColor, setSelectedColor] = useState<ColorData | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleUserInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInfo.name && userInfo.email) {
      setStep(1);
    }
  };

  const handleDiagnosis = async () => {
    if (!selectedColor) return;
    setStep(2);
    setError(null);
    try {
      const diagnosis = await getDiagnosis(userInfo.name, selectedColor.id);
      setResult(diagnosis);
      
      // 구글 시트에 데이터 로그 저장
      logToGoogleSheet(userInfo, selectedColor.label, diagnosis);
      
      setStep(3);
    } catch (err) {
      setError('진단 중 오류가 발생했습니다. 다시 시도해주세요.');
      setStep(1);
    }
  };

  const handleDownload = () => {
    alert('인스타그램 공유를 위해 결과지를 PDF로 저장하거나 화면을 캡처해 주세요!');
    window.print();
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`[컬러하트캔 AI색채심리] ${userInfo.name}님의 심리 진단 결과`);
    const body = encodeURIComponent(
      `안녕하세요 ${userInfo.name}님,\n\n심리 진단 결과입니다:\n\n` +
      `선택 색상: ${selectedColor?.label}\n` +
      `심리 분석: ${result?.message}\n` +
      `추천 꽃: ${result?.flower}\n` +
      `추천 향기: ${result?.scent}\n\n` +
      `실천 팁: ${result?.tips}\n\n` +
      `오늘 하루도 당신의 색깔처럼 빛나길 바랍니다.`
    );
    window.location.href = `mailto:${userInfo.email}?subject=${subject}&body=${body}`;
  };

  const handleShare = async () => {
    const shareText = `[컬러하트캔 AI색채심리 진단]\n${userInfo.name}님의 에너지는 '${selectedColor?.label}'입니다.\n"${result?.quote}"\n\n지금 확인해보세요!`;
    const shareUrl = window.location.href;

    // 1. 모바일 기본 공유 기능 시도
    if (navigator.share) {
      try {
        await navigator.share({
          title: '컬러하트캔 AI색채심리진단 결과',
          text: shareText,
          url: shareUrl,
        });
        return; // 성공 시 종료
      } catch (err) {
        console.log('공유 취소 또는 오류:', err);
        // 취소가 아닌 실제 에러일 경우 다음 단계(복사)로 넘어갈 수 있도록 함
      }
    }

    // 2. 클립보드 복사 시도 (데스크탑/보안환경)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('진단 결과 요약이 클립보드에 복사되었습니다!\n카카오톡이나 SNS에 붙여넣어 공유해보세요.');
      } catch (err) {
        console.error('클립보드 복사 실패:', err);
        alert('공유하기가 지원되지 않는 환경입니다.\n화면을 캡처해서 공유해주세요!');
      }
    } else {
      // 3. 모든 기능 미지원 시 안내
      alert('현재 브라우저에서는 공유 기능을 지원하지 않습니다.\n결과 페이지를 캡처하여 인스타그램에 공유해보세요!');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="max-w-md w-full mx-auto glass-morphism p-8 rounded-3xl shadow-2xl animate-fadeIn">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">컬러하트캔 AI색채심리</h1>
              <p className="text-gray-600">당신의 마음을 색으로 읽어보세요</p>
            </div>
            <form onSubmit={handleUserInfoSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  placeholder="홍길동"
                  value={userInfo.name}
                  onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  placeholder="hgd@example.com"
                  value={userInfo.email}
                  onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                />
              </div>
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
                <input type="checkbox" required className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded" />
                <p className="text-xs text-gray-500 leading-relaxed">
                  개인정보 수집 및 이용 동의: 진단 결과 저장 및 서비스 개선을 위해 입력하신 정보가 관리자용 구글 시트에 기록됩니다.
                </p>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transform active:scale-95 transition"
              >
                다음 단계로
              </button>
            </form>
          </div>
        );

      case 1:
        return (
          <div className="max-w-md w-full mx-auto glass-morphism p-8 rounded-3xl shadow-2xl animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">가장 끌리는 색을 선택하세요</h2>
              <p className="text-gray-500 text-sm">깊이 생각하지 말고 마음이 이끄는 색을 골라주세요.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-10">
              {COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color)}
                  className={`aspect-square rounded-2xl shadow-md transition-all transform hover:scale-105 ${
                    selectedColor?.id === color.id ? 'ring-4 ring-purple-500 ring-offset-4 scale-105' : ''
                  }`}
                  style={{ backgroundColor: color.hex, border: color.id === ColorType.WHITE ? '1px solid #e5e7eb' : 'none' }}
                />
              ))}
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition"
              >
                이전
              </button>
              <button
                disabled={!selectedColor}
                onClick={handleDiagnosis}
                className={`flex-[2] py-4 font-bold rounded-xl shadow-lg transition transform active:scale-95 ${
                  selectedColor
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-300 text-white cursor-not-allowed'
                }`}
              >
                진단받기
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="max-w-md w-full mx-auto glass-morphism p-12 rounded-3xl shadow-2xl text-center animate-pulse">
            <div className="mb-6 inline-block p-4 rounded-full bg-purple-100 text-purple-600">
              <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">마음을 분석 중입니다...</h2>
            <p className="text-gray-500">당신만의 빛깔을 찾고 있어요.</p>
          </div>
        );

      case 3:
        if (!result) return null;
        return (
          <div className="max-w-2xl w-full mx-auto space-y-6 print:m-0 animate-fadeInUp">
            <div ref={resultRef} className="glass-morphism rounded-3xl shadow-2xl overflow-hidden bg-white">
              <div className="gradient-bg p-8 text-white text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl shadow-inner border-2 border-white/20" style={{ backgroundColor: selectedColor?.hex }}></div>
                </div>
                <h1 className="text-3xl font-bold mb-2">{userInfo.name}님의 심리 진단</h1>
                <p className="text-purple-100">선택한 에너지: {selectedColor?.label}</p>
              </div>

              <div className="p-8 grid gap-6 md:grid-cols-2">
                <ResultItem icon={<ICONS.Message />} title="상담사의 한마디" content={result.message} />
                <ResultItem icon={<ICONS.Needs />} title="무의식의 욕구" content={result.needs} />
                <ResultItem icon={<ICONS.Tips />} title="오늘의 실천" content={result.tips} />
                <ResultItem icon={<ICONS.Flower />} title="당신의 꽃" content={result.flower} />
                <ResultItem icon={<ICONS.Scent />} title="당신의 향기" content={result.scent} />
                <ResultItem icon={<ICONS.Comfort />} title="마음 돌봄" content={result.comfortMessage} />
              </div>

              <div className="px-8 pb-8">
                <div className="bg-gray-50 p-6 rounded-2xl border-l-4 border-purple-500 italic text-gray-600 text-center">
                   "{result.quote}"
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 no-print pb-10">
              <button
                onClick={handleDownload}
                className="flex-1 py-4 bg-white border-2 border-purple-600 text-purple-600 font-bold rounded-2xl hover:bg-purple-50 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                저장/인쇄
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-4 bg-white border-2 border-indigo-600 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                결과 공유하기
              </button>
              <button
                onClick={handleEmail}
                className="flex-1 py-4 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                이메일 전송
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex flex-col p-4 sm:p-8">
      <header className="max-w-2xl w-full mx-auto text-center mb-8 no-print">
        <div className="inline-block bg-white/50 px-4 py-1 rounded-full text-purple-600 font-bold text-sm mb-2 shadow-sm uppercase tracking-widest">
          컬러하트캔 AI색채심리
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center">
        {renderStep()}
      </main>

      <footer className="mt-8 text-center text-gray-400 text-xs no-print">
        &copy; 2025 Color Heart Can AI Lab. 데이터는 안전하게 구글 관리자 페이지에 기록됩니다.
      </footer>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .glass-morphism { border: none !important; box-shadow: none !important; background: white !important; }
          .gradient-bg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
        .animate-fadeInUp { animation: fadeInUp 0.6s ease-out; }
      `}</style>
    </div>
  );
};

interface ResultItemProps {
  icon: React.ReactNode;
  title: string;
  content: string;
}

const ResultItem: React.FC<ResultItemProps> = ({ icon, title, content }) => (
  <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition">
    <div className="flex items-center gap-3 mb-2 text-purple-600 font-bold">
      <span className="p-2 bg-purple-50 rounded-lg">{icon}</span>
      <h3 className="text-sm">{title}</h3>
    </div>
    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
  </div>
);

export default App;
