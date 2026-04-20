// ✅ 토스페이먼츠 심사 요구사항: 사업자 정보 푸터 노출
// - 상호, 대표자명, 사업자등록번호, 사업장 주소, 전화번호 (사업자등록증과 일치)
export default function BusinessFooter() {
  return (
    <footer
      style={{
        marginTop: '2rem',
        padding: '1.25rem 1rem 1.5rem',
        borderTop: '1px solid #e5e7eb',
        background: '#f9fafb',
        color: '#6b7280',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
        제주서부테니스 주식회사
      </div>
      <div>대표자: 좌미경 | 사업자등록번호: 182-86-02740</div>
      <div>제주특별자치도 제주시 한경면 청수리 311</div>
      <div>
        고객센터:{' '}
        <a href="tel:010-2939-0079" style={{ color: '#6b7280', textDecoration: 'none' }}>
          010-2939-0079
        </a>
      </div>
    </footer>
  )
}
