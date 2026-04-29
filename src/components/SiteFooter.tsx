// src/components/SiteFooter.tsx
// 토스페이먼츠 심사용 사업자정보 풀 푸터
//
// 사업 분류: 테니스장 자유업
//   → 학원 등록번호 해당 없음 (학원법 적용 외)
//   → 통신판매업 신고번호 해당 없음 (회원 전용 폐쇄몰)
//
// 변경 시 아래 COMPANY 객체만 수정.

const COMPANY = {
  name:           '제주서부테니스 주식회사',
  ceo:            '[PLACEHOLDER_대표자명]',
  bizNumber:      '[PLACEHOLDER_사업자번호]',
  address:        '[PLACEHOLDER_주소]',
  phone:          '[PLACEHOLDER_전화번호]',
  email:          'jwta0514@naver.com',
  privacyOfficer: '신승배',
}

const wrapStyle: React.CSSProperties = {
  background:  '#1f2937',
  color:       '#d1d5db',
  padding:     '2.5rem 1.25rem',
  fontSize:    '0.8125rem',
  lineHeight:  1.7,
  fontFamily:  'Noto Sans KR, system-ui, -apple-system, sans-serif',
}

const innerStyle: React.CSSProperties = {
  maxWidth:    '900px',
  margin:      '0 auto',
  textAlign:   'center',
}

const titleStyle: React.CSSProperties = {
  fontFamily:    'Oswald, sans-serif',
  fontSize:      '1.05rem',
  fontWeight:    700,
  color:         '#f9fafb',
  letterSpacing: '1px',
  marginBottom:  '1rem',
}

const infoListStyle: React.CSSProperties = {
  display:        'flex',
  flexWrap:       'wrap',
  justifyContent: 'center',
  alignItems:     'center',
  gap:            '0.4rem 0.75rem',
  marginBottom:   '0.4rem',
}

const labelStyle: React.CSSProperties = {
  color:    '#9ca3af',
  marginRight: '0.25rem',
}

const sepStyle: React.CSSProperties = { color: '#4b5563' }

const linkRowStyle: React.CSSProperties = {
  display:        'flex',
  flexWrap:       'wrap',
  justifyContent: 'center',
  gap:            '0.5rem 1.25rem',
  marginTop:      '1.25rem',
  paddingTop:     '1.25rem',
  borderTop:      '1px solid #374151',
}

const linkStyle: React.CSSProperties = {
  color:          '#e5e7eb',
  textDecoration: 'none',
  fontSize:       '0.8rem',
  fontWeight:     600,
}

const inlineLinkStyle: React.CSSProperties = {
  color:          'inherit',
  textDecoration: 'none',
}

const noticeStyle: React.CSSProperties = {
  marginTop:  '1.25rem',
  fontSize:   '0.72rem',
  color:      '#9ca3af',
  lineHeight: 1.7,
}

export default function SiteFooter() {
  return (
    <footer style={wrapStyle}>
      <div style={innerStyle}>
        <div style={titleStyle}>{COMPANY.name}</div>

        {/* 1행: 대표자 · 사업자등록번호 */}
        <div style={infoListStyle}>
          <span><span style={labelStyle}>대표자</span>{COMPANY.ceo}</span>
          <span style={sepStyle}>|</span>
          <span><span style={labelStyle}>사업자등록번호</span>{COMPANY.bizNumber}</span>
        </div>

        {/* 2행: 주소 */}
        <div style={infoListStyle}>
          <span><span style={labelStyle}>주소</span>{COMPANY.address}</span>
        </div>

        {/* 3행: 전화 · 이메일 */}
        <div style={infoListStyle}>
          <span>
            <span style={labelStyle}>대표 전화</span>
            <a href={`tel:${COMPANY.phone.replace(/[^\d]/g, '')}`} style={inlineLinkStyle}>
              {COMPANY.phone}
            </a>
          </span>
          <span style={sepStyle}>|</span>
          <span>
            <span style={labelStyle}>이메일</span>
            <a href={`mailto:${COMPANY.email}`} style={inlineLinkStyle}>
              {COMPANY.email}
            </a>
          </span>
        </div>

        {/* 4행: 개인정보보호책임자 */}
        <div style={infoListStyle}>
          <span><span style={labelStyle}>개인정보보호책임자</span>{COMPANY.privacyOfficer}</span>
        </div>

        {/* 약관 링크 */}
        <div style={linkRowStyle}>
          <a href="/terms"         style={linkStyle}>이용약관</a>
          <a href="/terms/refund"  style={linkStyle}>환불정책</a>
          <a href="/terms/privacy" style={linkStyle}>개인정보처리방침</a>
        </div>

        {/* 안내 문구 */}
        <div style={noticeStyle}>
          본 사이트는 회원 전용 테니스 레슨 관리 시스템입니다.
          <br />
          모든 결제는 토스페이먼츠를 통해 안전하게 처리됩니다.
        </div>
      </div>
    </footer>
  )
}
