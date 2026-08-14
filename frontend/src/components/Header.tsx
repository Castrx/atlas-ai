/**
 * Marca do Atlas AI: uma bússola simplificada, em traço único. É o
 * elemento de assinatura da interface — reaparece, em miniatura, como
 * avatar das mensagens do assistente (ver MessageBubble).
 */
export function CompassMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__mark">
        <CompassMark size={26} />
      </div>
      <div className="app-header__text">
        <h1 className="app-header__title">Atlas AI</h1>
        <p className="app-header__subtitle">Assistente inteligente do Atlas ERP</p>
      </div>
      <div className="app-header__status">
        <span className="app-header__status-dot" aria-hidden="true" />
        Conectado ao Atlas ERP
      </div>
    </header>
  );
}
