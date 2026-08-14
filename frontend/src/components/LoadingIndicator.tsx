import { CompassMark } from "./Header";

/** Indicador de "digitando", no mesmo formato de uma mensagem do assistente. */
export function LoadingIndicator() {
  return (
    <div className="message-row message-row--assistant" role="status" aria-label="Atlas AI está respondendo">
      <div className="message-avatar" aria-hidden="true">
        <CompassMark size={16} />
      </div>
      <div className="message-bubble message-bubble--loading">
        <span className="loading-dots">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}
