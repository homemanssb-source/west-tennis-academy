// src/app/terms/refund/page.tsx
// 환불 정책 — 토스페이먼츠 심사 필수 공개 페이지
// 사업 분류: 테니스장 자유업 (학원법 적용 외)
// 근거: 「소비자분쟁해결기준」(공정거래위원회 고시)
// SiteFooter 는 layout.tsx 에서 자동 노출

import Link from 'next/link'

const wrap: React.CSSProperties = {
  background: '#f9fafb',
  minHeight: '100vh',
  fontFamily: 'Noto Sans KR, system-ui, -apple-system, sans-serif',
  color: '#111827',
  lineHeight: 1.7,
}

const header: React.CSSProperties = {
  background: 'white',
  borderBottom: '1.5px solid #f3f4f6',
  padding: '1rem 1.25rem',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
}

const backLink: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#6b7280',
  textDecoration: 'none',
  fontWeight: 600,
}

const headerTitle: React.CSSProperties = {
  fontFamily: 'Oswald, sans-serif',
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#111827',
}

const main: React.CSSProperties = {
  maxWidth: '800px',
  margin: '0 auto',
  padding: '2rem 1.25rem 3rem',
}

const lead: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#374151',
  marginBottom: '1.25rem',
  padding: '1rem 1.25rem',
  background: 'white',
  borderRadius: '0.75rem',
  border: '1.5px solid #e5e7eb',
}

const section: React.CSSProperties = {
  background: 'white',
  borderRadius: '0.875rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: '#111827',
  marginBottom: '0.875rem',
  paddingBottom: '0.5rem',
  borderBottom: '2px solid #16A34A',
}

const subTitle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#374151',
  marginTop: '0.875rem',
  marginBottom: '0.4rem',
}

const list: React.CSSProperties = {
  paddingLeft: '1.25rem',
  fontSize: '0.875rem',
  color: '#374151',
  margin: 0,
}

const sectionMeta: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#6b7280',
  marginBottom: '0.5rem',
}

const note: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9ca3af',
  textAlign: 'center',
  marginTop: '2rem',
  lineHeight: 1.7,
}

const inlineLink: React.CSSProperties = {
  color: '#1d4ed8',
  textDecoration: 'none',
}

export default function RefundPolicyPage() {
  return (
    <div style={wrap}>
      <header style={header}>
        <Link href="/" style={backLink}>← 홈으로</Link>
        <h1 style={headerTitle}>환불 정책</h1>
      </header>

      <main style={main}>
        <div style={lead}>
          제주서부테니스 주식회사(이하 “회사”)는 「소비자분쟁해결기준」(공정거래위원회 고시)
          및 관련 법령에 따라 회원의 환불 요청을 처리합니다. 본 정책은 회원제 월 단위
          테니스 레슨 서비스를 대상으로 합니다.
        </div>

        {/* 1. 환불 가능 사유 */}
        <section style={section}>
          <h2 style={sectionTitle}>1. 환불 가능 사유</h2>

          <h3 style={subTitle}>가. 사업자(회사) 귀책 사유</h3>
          <ul style={list}>
            <li>회사의 폐업 또는 운영 중단</li>
            <li>코치 부재 등 회사 측 사유로 수업이 제공되지 않은 경우</li>
            <li>시설 안전 문제로 정상 수업이 불가한 경우</li>
          </ul>

          <h3 style={subTitle}>나. 회원 사유</h3>
          <ul style={list}>
            <li>질병, 이사, 직장 변경 등 부득이한 사정</li>
            <li>단순 변심 (수강 시작 전에 한해 인정)</li>
          </ul>
        </section>

        {/* 2. 환불 금액 계산 */}
        <section style={section}>
          <h2 style={sectionTitle}>2. 환불 금액 계산</h2>
          <p style={sectionMeta}>
            「소비자분쟁해결기준」(공정거래위원회 고시) 준용.
          </p>

          <h3 style={subTitle}>▸ 사업자(회사) 귀책 사유</h3>
          <ul style={list}>
            <li>잔여 횟수 × 회당 단가 = <b>100% 환불</b></li>
            <li>운영 중단 시 미제공분 전액 + <b>위약금 10% 추가 지급</b></li>
          </ul>

          <h3 style={subTitle}>▸ 회원 사유 — 수강 시작 전</h3>
          <ul style={list}>
            <li>결제 후 7일 이내, 수업 미참여 시: <b>100% 환불</b></li>
            <li>결제 후 7일 초과, 수업 미참여 시: <b>잔여 100% 환불</b> (위약금 없음)</li>
          </ul>

          <h3 style={subTitle}>▸ 회원 사유 — 수강 시작 후</h3>
          <ul style={list}>
            <li>환불액 = <b>(총 결제액 ÷ 총 회차) × 잔여 회차</b></li>
            <li>무단 결석 회차는 진행분으로 간주됩니다</li>
          </ul>

          <h3 style={subTitle}>▸ 그룹 레슨 특별 규정</h3>
          <ul style={list}>
            <li>회원 사정으로 결석한 회차는 보강(makeup) 신청 가능</li>
            <li>보강 미신청 회차는 환불 대상에서 제외</li>
          </ul>
        </section>

        {/* 3. 환불 신청 방법 */}
        <section style={section}>
          <h2 style={sectionTitle}>3. 환불 신청 방법</h2>
          <ul style={list}>
            <li>카카오톡 채널 또는 학원 직접 방문 신청</li>
            <li>신청 시 필요 정보: 회원명, 결제 일자, 환불 사유</li>
            <li>운영자 검토 후 <b>3~5영업일 내</b> 처리</li>
          </ul>
        </section>

        {/* 4. 결제 취소 절차 */}
        <section style={section}>
          <h2 style={sectionTitle}>4. 결제 취소 절차 (토스페이먼츠 기준)</h2>
          <ul style={list}>
            <li><b>카드 결제</b>: 카드사 승인 취소 → 3~5영업일 후 명세서 반영</li>
            <li><b>가상계좌 (입금 전)</b>: 자동 취소</li>
            <li><b>가상계좌 (입금 후)</b>: 회원이 지정한 환불 계좌로 송금</li>
            <li><b>간편결제</b>: 해당 결제수단으로 즉시 취소</li>
          </ul>
        </section>

        {/* 5. 환불 불가 사항 */}
        <section style={section}>
          <h2 style={sectionTitle}>5. 환불 불가 사항</h2>
          <ul style={list}>
            <li>회원 본인 사유로 무단 결석한 회차</li>
            <li>보강 가능 횟수 초과 후 환불 신청</li>
            <li>환불 신청 시점이 해당 월 종료 후 <b>30일을 초과</b>한 경우</li>
          </ul>
        </section>

        {/* 6. 분쟁 해결 */}
        <section style={section}>
          <h2 style={sectionTitle}>6. 분쟁 해결</h2>
          <ul style={list}>
            <li>회사와의 자체 협의를 우선합니다.</li>
            <li>
              미해결 시 <b>한국소비자원 (1372)</b> 또는 공정거래위원회 산하
              <b> 소비자분쟁조정위원회</b>에 조정을 신청할 수 있습니다.
            </li>
          </ul>
        </section>

        {/* 7. 문의처 */}
        <section style={section}>
          <h2 style={sectionTitle}>7. 문의처</h2>
          <ul style={list}>
            <li>
              이메일:{' '}
              <a href="mailto:jwta0514@naver.com" style={inlineLink}>
                jwta0514@naver.com
              </a>
            </li>
            <li>전화: [PLACEHOLDER_전화번호]</li>
          </ul>
        </section>

        <p style={note}>
          본 정책은 「소비자분쟁해결기준」(공정거래위원회 고시)을 근거로 작성되었으며,
          <br />
          [PLACEHOLDER_시행일]부터 시행됩니다.
        </p>
      </main>
    </div>
  )
}
