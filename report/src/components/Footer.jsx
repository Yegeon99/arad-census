export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--hairline)" }}>
      <div className="mx-auto max-w-[1200px] px-5 py-6 lg:px-8">
        <p className="t-small m-0">본 서비스는 Neople 오픈 API에서 제공받은 데이터를 일부 가공하여 활용하고 있습니다.</p>
        <p className="t-small m-0 mt-1">비공식 팬메이드 포트폴리오, ㈜네오플·넥슨과 무관합니다. 게임 IP 아트워크를 사용하지 않습니다.</p>
        <p className="t-small m-0 mt-2">
          <a href="https://github.com/Yegeon99/dnf-census" target="_blank" rel="noreferrer">GitHub 저장소</a>
          <span style={{ opacity: 0.5 }}> · </span>
          <a href="https://developers.neople.co.kr" target="_blank" rel="noreferrer">Neople 오픈 API</a>
        </p>
        <p className="t-small m-0 mt-2">
          <span style={{ opacity: 0.7 }}>시리즈의 다른 프로젝트 · </span>
          <a href="https://dnf-market.vercel.app" target="_blank" rel="noreferrer">DNF Market</a>
          <span style={{ opacity: 0.7 }}> · 경매장 시세 분석</span>
        </p>
      </div>
    </footer>
  );
}
