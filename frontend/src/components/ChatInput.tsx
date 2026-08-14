import { useState } from "react";
import type { KeyboardEvent } from "react";

interface ChatInputProps {
  disabled: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-input">
      <textarea
        className="chat-input__field"
        placeholder="Pergunte algo sobre produtos, estoque, clientes ou vendas..."
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Mensagem para o Atlas AI"
      />
      <button
        type="button"
        className={`chat-input__send${disabled ? " chat-input__send--sending" : ""}`}
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-busy={disabled}
      >
        {disabled ? "Enviando..." : "Enviar"}
      </button>
    </div>
  );
}
