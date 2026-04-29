// src/app/terms/privacy/page.tsx
// 개인정보처리방침 — 토스페이먼츠 심사 필수 공개 페이지
// 근거: 「개인정보 보호법」 및 시행령
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
  marginBottom: '0.875rem',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
  marginBottom: '0.625rem',
  paddingBottom: '0.4rem',
  borderBottom: '2px solid #16A34A',
}

const subTitle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 700,
  color: '#374151',
  marginTop: '0.75rem',
  marginBottom: '0.4rem',
}

const list: React.CSSProperties = {
  paddingLeft: '1.25rem',
  fontSize: '0.875rem',
  color: '#374151',
  margin: 0,
}

const tableWrap: React.CSSProperties = {
  marginTop: '0.5rem',
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
}

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.825rem',
}

const th: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#374151',
  fontWeight: 700,
  padding: '0.5rem 0.625rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '0.5rem 0.625rem',
  color: '#374151',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
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

const callout: React.CSSProperties = {
  padding: '0.625rem 0.875rem',
  background: '#eff6ff',
  color: '#1d4ed8',
  borderRadius: '0.5rem',
  fontSize: '0.8rem',
  marginTop: '0.5rem',
}

export default function PrivacyPolicyPage() {
  return (
    <div style={wrap}>
      <header style={header}>
        <Link href="/" style={backLink}>← 홈으로</Link>
        <h1 style={headerTitle}>개인정보처리방침</h1>
      </header>

      <main style={main}>
        <div style={lead}>
          제주서부테니스 주식회사(이하 “회사”)는 「개인정보 보호법」 및 관련 법령에 따라
          이용자의 개인정보를 보호하고, 관련된 고충을 신속하고 원활하게 처리할 수 있도록
          본 개인정보처리방침을 수립·공개합니다.
        </div>

        {/* 1. 수집 항목 */}
        <section style={section}>
          <h2 style={sectionTitle}>1. 수집하는 개인정보 항목</h2>
          <ul style={list}>
            <li><b>필수</b>: 이름, 휴대폰번호, PIN(bcrypt 해시로 저장 — 평문 미보관)</li>
            <li><b>자녀 등록 시</b>: 자녀 이름, 자녀 생년월일</li>
            <li><b>결제 시</b>: 토스페이먼츠가 직접 처리하며, 회사는 카드/계좌 정보를 저장하지 않습니다</li>
            <li><b>자동 수집</b>: 접속 기록, 쿠키(세션 인증용)</li>
          </ul>
        </section>

        {/* 2. 이용 목적 */}
        <section style={section}>
          <h2 style={sectionTitle}>2. 수집·이용 목적</h2>
          <ul style={list}>
            <li>회원 식별 및 인증</li>
            <li>레슨 일정 관리 및 수강료 결제 처리</li>
            <li>카카오톡 알림톡 발송 (수업 안내, 결제 링크)</li>
            <li>서비스 통계 및 품질 개선</li>
          </ul>
        </section>

        {/* 3. 보유·이용 기간 */}
        <section style={section}>
          <h2 style={sectionTitle}>3. 보유 및 이용 기간</h2>
          <ul style={list}>
            <li><b>회원 탈퇴 시</b>: 즉시 파기 (지체 없이 삭제)</li>
            <li><b>결제 기록</b>: 5년 보관 (「전자금융거래법」 제22조에 따라)</li>
            <li><b>출결 기록</b>: 회원 탈퇴 시 즉시 파기</li>
          </ul>
        </section>

        {/* 4. 제3자 제공 */}
        <section style={section}>
          <h2 style={sectionTitle}>4. 제3자 제공</h2>
          <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
            회사는 정보주체의 동의 또는 법령에 근거한 경우에 한해 개인정보를 다음과 같이 제3자에게 제공합니다.
          </p>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>제공받는 자</th>
                  <th style={th}>제공 항목</th>
                  <th style={th}>이용 목적</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}>토스페이먼츠</td>
                  <td style={td}>결제 진행 시 필요 정보</td>
                  <td style={td}>결제 처리 및 정산</td>
                </tr>
                <tr>
                  <td style={td}>Solapi</td>
                  <td style={td}>휴대폰번호, 발송 메시지</td>
                  <td style={td}>카카오톡 알림톡 발송</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. 처리 위탁 */}
        <section style={section}>
          <h2 style={sectionTitle}>5. 처리 위탁</h2>
          <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
            서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁하고 있습니다.
          </p>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>수탁자</th>
                  <th style={th}>위탁 업무</th>
                  <th style={th}>리전</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={td}>Supabase Inc.</td>
                  <td style={td}>데이터베이스, 인증</td>
                  <td style={td}>미국</td>
                </tr>
                <tr>
                  <td style={td}>Vercel Inc.</td>
                  <td style={td}>웹 호스팅</td>
                  <td style={td}>미국</td>
                </tr>
                <tr>
                  <td style={td}>Toss Payments</td>
                  <td style={td}>결제 처리</td>
                  <td style={td}>한국</td>
                </tr>
                <tr>
                  <td style={td}>Solapi Inc.</td>
                  <td style={td}>카카오톡 알림톡</td>
                  <td style={td}>한국</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={callout}>
            국외 이전 위탁(Supabase, Vercel)에 대해서는 정보주체의 동의를 전제로 하며,
            전송 구간은 모두 HTTPS 로 암호화됩니다.
          </div>
        </section>

        {/* 6. 정보주체 권리 */}
        <section style={section}>
          <h2 style={sectionTitle}>6. 정보주체의 권리</h2>
          <ul style={list}>
            <li>자신의 개인정보에 대한 <b>열람·정정·삭제·처리정지</b>를 요구할 수 있습니다.</li>
            <li>요구는 아래 개인정보보호책임자에게 이메일·전화로 신청할 수 있습니다.</li>
            <li>만 14세 미만 아동의 권리는 <b>법정대리인이 대리하여 행사</b>할 수 있습니다.</li>
          </ul>
        </section>

        {/* 7. 안전성 확보 조치 */}
        <section style={section}>
          <h2 style={sectionTitle}>7. 안전성 확보 조치</h2>
          <ul style={list}>
            <li>PIN 은 <b>bcrypt</b> 알고리즘으로 단방향 해시 저장 (평문 미보관)</li>
            <li>전 통신 구간 <b>HTTPS</b> 적용</li>
            <li>역할 기반 접근 권한 관리 (member / coach / admin / owner)</li>
            <li>정기 백업 및 접근 로그 관리</li>
          </ul>
        </section>

        {/* 8. 쿠키 운영 */}
        <section style={section}>
          <h2 style={sectionTitle}>8. 쿠키 운영</h2>
          <ul style={list}>
            <li>세션 유지 목적으로만 사용되며, 만료 시 자동 삭제됩니다.</li>
            <li>
              회원은 브라우저 설정에서 쿠키를 차단할 수 있으나, 차단 시 로그인을 포함한
              일부 기능 이용이 제한될 수 있습니다.
            </li>
          </ul>
        </section>

        {/* 9. 개인정보보호책임자 */}
        <section style={section}>
          <h2 style={sectionTitle}>9. 개인정보보호책임자</h2>
          <ul style={list}>
            <li><b>성명</b>: 신승배</li>
            <li>
              <b>이메일</b>:{' '}
              <a href="mailto:jwta0514@naver.com" style={inlineLink}>jwta0514@naver.com</a>
            </li>
            <li><b>전화</b>: [PLACEHOLDER_전화번호]</li>
          </ul>
        </section>

        {/* 10. 권익침해 구제방법 */}
        <section style={section}>
          <h2 style={sectionTitle}>10. 권익침해 구제방법</h2>
          <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
            개인정보 침해에 대한 구제·상담이 필요한 경우 다음 기관에 문의하실 수 있습니다.
          </p>
          <ul style={list}>
            <li>
              <b>개인정보분쟁조정위원회</b>: 1833-6972 ·{' '}
              <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer" style={inlineLink}>
                kopico.go.kr
              </a>
            </li>
            <li>
              <b>개인정보침해신고센터</b>: 118 ·{' '}
              <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer" style={inlineLink}>
                privacy.kisa.or.kr
              </a>
            </li>
            <li><b>대검찰청 사이버수사과</b>: 1301</li>
            <li>
              <b>경찰청 사이버수사국</b>: 182 ·{' '}
              <a href="https://cyberbureau.police.go.kr" target="_blank" rel="noopener noreferrer" style={inlineLink}>
                cyberbureau.police.go.kr
              </a>
            </li>
          </ul>
        </section>

        <p style={note}>
          본 방침은 「개인정보 보호법」 및 관련 법령을 근거로 작성되었으며,
          <br />
          [PLACEHOLDER_시행일]부터 시행됩니다.
        </p>
      </main>
    </div>
  )
}
