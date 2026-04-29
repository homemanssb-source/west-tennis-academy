// src/app/terms/page.tsx
// 이용약관 — 토스페이먼츠 심사 필수 공개 페이지
// 사업 분류: 테니스장 자유업 (학원법/체육시설법 직접 적용 외)
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

const article: React.CSSProperties = {
  background: 'white',
  borderRadius: '0.875rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
  marginBottom: '0.875rem',
}

const articleTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
  marginBottom: '0.625rem',
  paddingBottom: '0.4rem',
  borderBottom: '2px solid #16A34A',
}

const articleBody: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#374151',
  margin: 0,
}

const list: React.CSSProperties = {
  paddingLeft: '1.25rem',
  fontSize: '0.875rem',
  color: '#374151',
  margin: 0,
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

export default function TermsPage() {
  return (
    <div style={wrap}>
      <header style={header}>
        <Link href="/" style={backLink}>← 홈으로</Link>
        <h1 style={headerTitle}>이용약관</h1>
      </header>

      <main style={main}>
        <div style={lead}>
          본 약관은 제주서부테니스 주식회사(이하 “회사”)가 운영하는 웨스트 테니스 아카데미
          (WTA, 이하 “서비스”) 의 이용에 관한 사항을 규정합니다. 회원이 서비스를 이용하기
          위해서는 본 약관에 동의해야 합니다.
        </div>

        {/* 제1조 */}
        <section style={article}>
          <h2 style={articleTitle}>제1조 (목적)</h2>
          <p style={articleBody}>
            본 약관은 제주서부테니스 주식회사(이하 “회사”)가 운영하는 웨스트 테니스 아카데미
            (WTA, 이하 “서비스”) 이용에 관한 사항을 규정합니다.
          </p>
        </section>

        {/* 제2조 */}
        <section style={article}>
          <h2 style={articleTitle}>제2조 (정의)</h2>
          <ul style={list}>
            <li><b>회원</b>: 회사가 운영하는 테니스장에 등록되어 PIN 인증으로 서비스를 이용하는 자</li>
            <li><b>서비스</b>: 레슨 일정 확인, 수업 신청, 수강료 결제 등 회원 전용 PWA</li>
            <li><b>수강료</b>: 월 단위 테니스 레슨에 대한 회원의 결제 금액</li>
          </ul>
        </section>

        {/* 제3조 */}
        <section style={article}>
          <h2 style={articleTitle}>제3조 (서비스의 성격)</h2>
          <ul style={list}>
            <li>① 본 서비스는 오프라인 테니스 레슨을 받는 회원에게 제공되는 회원관리 시스템입니다.</li>
            <li>② 본 서비스는 통신판매가 아닌 오프라인 시설 이용료(수강료) 수납 목적입니다.</li>
            <li>③ 비회원의 가입 및 결제는 불가능합니다.</li>
          </ul>
        </section>

        {/* 제4조 */}
        <section style={article}>
          <h2 style={articleTitle}>제4조 (회원가입)</h2>
          <ul style={list}>
            <li>① 운영자가 회원가입 신청서를 검토 후 승인합니다.</li>
            <li>② PIN 발급 후 본인 인증을 통해 서비스를 이용할 수 있습니다.</li>
            <li>③ 만 14세 미만은 부모(법정대리인) 계정에 자녀로 연동하여 이용합니다.</li>
          </ul>
        </section>

        {/* 제5조 */}
        <section style={article}>
          <h2 style={articleTitle}>제5조 (서비스 이용)</h2>
          <ul style={list}>
            <li>① 회원은 PIN으로 로그인 후 본인의 레슨 일정 및 결제 내역을 확인할 수 있습니다.</li>
            <li>② 운영자가 매월 수업 플랜을 생성하면 회원은 미리보기 후 수정 요청할 수 있습니다.</li>
          </ul>
        </section>

        {/* 제6조 */}
        <section style={article}>
          <h2 style={articleTitle}>제6조 (수강료 결제)</h2>
          <ul style={list}>
            <li>① 결제수단: 토스페이먼츠를 통한 신용카드, 계좌이체, 가상계좌, 간편결제</li>
            <li>
              ② 결제 방식
              <ul style={{ ...list, marginTop: '0.25rem' }}>
                <li>운영자가 카카오톡 알림톡으로 결제링크 발송</li>
                <li>또는 회원이 앱에서 직접 결제</li>
              </ul>
            </li>
            <li>③ 결제 영수증은 회원 페이지에서 확인 가능합니다.</li>
          </ul>
        </section>

        {/* 제7조 */}
        <section style={article}>
          <h2 style={articleTitle}>제7조 (환불)</h2>
          <p style={articleBody}>
            환불 관련 자세한 사항은{' '}
            <Link href="/terms/refund" style={inlineLink}>환불정책 페이지</Link>
            를 따르며, 본 약관은 「소비자분쟁해결기준」(공정거래위원회 고시)을 근거로 합니다.
          </p>
        </section>

        {/* 제8조 */}
        <section style={article}>
          <h2 style={articleTitle}>제8조 (회원의 의무)</h2>
          <ul style={list}>
            <li>① PIN 보안 유지 책임</li>
            <li>② 본인 정보 정확 제공</li>
            <li>③ 시설 이용 시 안전 수칙 준수</li>
          </ul>
        </section>

        {/* 제9조 */}
        <section style={article}>
          <h2 style={articleTitle}>제9조 (회사의 의무)</h2>
          <ul style={list}>
            <li>① 안전한 시설 제공</li>
            <li>② 자격을 갖춘 코치 배치</li>
            <li>③ 약속된 수업 제공</li>
            <li>④ 회원 개인정보 보호</li>
          </ul>
        </section>

        {/* 제10조 */}
        <section style={article}>
          <h2 style={articleTitle}>제10조 (서비스 중단 및 면책)</h2>
          <ul style={list}>
            <li>① 천재지변, 시스템 장애 등 불가항력적 사유로 서비스가 중단될 수 있습니다.</li>
            <li>② 회사는 회원의 부주의로 인한 사고에 대해 책임을 지지 않습니다.</li>
          </ul>
        </section>

        {/* 제11조 */}
        <section style={article}>
          <h2 style={articleTitle}>제11조 (분쟁의 해결)</h2>
          <ul style={list}>
            <li>① 본 서비스 이용 관련 분쟁은 회사와 회원 간 협의로 해결합니다.</li>
            <li>② 협의 미해결 시 <b>제주지방법원</b>을 관할 법원으로 합니다.</li>
            <li>③ 한국소비자원 또는 소비자분쟁조정위원회에 조정 신청 가능합니다.</li>
          </ul>
        </section>

        {/* 제12조 */}
        <section style={article}>
          <h2 style={articleTitle}>제12조 (부칙)</h2>
          <p style={articleBody}>
            본 약관은 <b>2026년 4월 22일</b>부터 시행됩니다.
          </p>
        </section>

        <p style={note}>
          본 약관은 회원제 테니스장 자유업 서비스 운영을 위해 작성되었으며,
          <br />
          관련 법령 및 회사 정책에 따라 변경될 수 있습니다.
        </p>
      </main>
    </div>
  )
}
