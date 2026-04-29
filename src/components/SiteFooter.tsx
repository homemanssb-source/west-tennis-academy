// src/components/SiteFooter.tsx
// 토스페이먼츠 심사용 사업자정보 풀 푸터
//
// 학원업이라 통신판매업 신고번호 없음 → 학원 등록번호 (제주특별자치도교육청 발급) 로 대체.
// 사업자등록증과 완전 일치하는 정보로만 채울 것.
//
// 변경 사항이 생기면 아래 COMPANY 객체만 수정하면 됨.

const COMPANY = {
  name:           '제주서부테니스 주식회사',
  ceo:            '좌미경',                                  // 사업자등록증 기재
  bizNumber:      '182-86-02740',                            // 사업자등록증 기재
  academyNumber:  '[학원등록번호 입력 필요]',                // 제주특별자치도교육청 발급 번호
  address:        '제주특별자치도 제주시 한경면 청수리 311',  // 사업자등록증 기재
  phone:          '010-2939-0079',                           // 대표 연락처
  email:          '[대표 이메일 입력 필요]',                 // 사업체 공식 이메일
  privacyOfficer: '[개인정보보호책임자 입력 필요]',           // 보통 대표자 또는 위임자
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
  fontFamily:  'Oswald, sans-serif',
  fontSize:    '1.05rem',
  fontWeight:  700,
  color:       '#f9fafb',
  letterSpacing: '1px',
  marginBottom: '1rem',
}

const rowStyle: React.CSSProperties = {
  display:     'flex',
  flexWrap:    'wrap',
  justifyContent: 'center',
  alignItems:  'center',
  gap:         '0.4rem 1rem',
  marginBottom: '0.5rem',
}

const sepStyle: React.CSSProperties = { color: '#4b5563' }

const addressStyle: React.CSSProperties = { marginBottom: '0.5rem' }

const linkRowStyle: React.CSSProperties = {
  display:     'flex',
  flexWrap:    'wrap',
  justifyContent: 'center',
  gap:         '0.5rem 1.25rem',
  marginTop:   '1.25rem',
  paddingTop:  '1.25rem',
  borderTop:   '1px solid #374151',
}

const linkStyle: React.CSSProperties = {
  color:        '#e5e7eb',
  textDecoration: 'none',
  fontSize:     '0.8rem',
  fontWeight:   600,
}

const inlineLinkStyle: React.CSSProperties = {
  color:        'inherit',
  textDecoration: 'none',
}

const noticeStyle: React.CSSProperties = {
  marginTop:    '1.25rem',
  fontSize:     '0.72rem',
  color:        '#9ca3af',
  lineHeight:   1.6,
}

export default function SiteFooter() {
  return (
    <footer style={wrapStyle}>
      <div style={innerStyle}>
        <div style={titleStyle}>{COMPANY.name}</div>

        <div style={rowStyle}>
          <span>대표자: {COMPANY.ceo}</span>
          <span style={sepStyle}>|</span>
          <span>사업자등록번호: {COMPANY.bizNumber}</span>
        </div>

        <div style={rowStyle}>
          <span>학원 등록번호: {COMPANY.academyNumber}</span>
          <span style={sepStyle}>(제주특별자치도교육청)</span>
        </div>

        <div style={addressStyle}>{COMPANY.address}</div>

        <div style={rowStyle}>
          <span>
            대표 전화:{' '}
            <a href={`tel:${COMPANY.phone.replace(/-/g, '')}`} style={inlineLinkStyle}>
              {COMPANY.phone}
            </a>
          </span>
          <span style={sepStyle}>|</span>
          <span>
            이메일:{' '}
            <a href={`mailto:${COMPANY.email}`} style={inlineLinkStyle}>
              {COMPANY.email}
            </a>
          </span>
        </div>

        <div style={addressStyle}>개인정보보호책임자: {COMPANY.privacyOfficer}</div>

        <div style={linkRowStyle}>
          <a href="/terms"         style={linkStyle}>이용약관</a>
          <a href="/terms/refund"  style={linkStyle}>환불정책</a>
          <a href="/terms/privacy" style={linkStyle}>개인정보처리방침</a>
        </div>

        <div style={noticeStyle}>
          본 시설은 「학원의 설립·운영 및 과외교습에 관한 법률」에 따라 등록된 체육시설입니다.
          <br />
          모든 결제는 토스페이먼츠를 통해 안전하게 처리됩니다.
        </div>
      </div>
    </footer>
  )
}
