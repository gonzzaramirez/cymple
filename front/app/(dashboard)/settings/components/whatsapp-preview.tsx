import { interpolateTemplate } from "@/lib/message-templates";

interface WhatsappPreviewProps {
  body: string;
  sampleData: Record<string, string>;
  previewTime: string;
}

function renderMessageBody(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return (
          <strong key={j}>{part.slice(1, -1)}</strong>
        );
      }
      if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
        return (
          <em key={j} className="text-white/80">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={j}>{part}</span>;
    });
    return (
      <span key={i}>
        {rendered}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function WhatsappPreview({ body, sampleData, previewTime }: WhatsappPreviewProps) {
  const interpolated = interpolateTemplate(body, sampleData);

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-card"
      style={{ fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}
    >
      {/* WhatsApp header bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075e54]">
        <div className="w-9 h-9 rounded-full bg-[#25d366]/30 flex items-center justify-center text-white text-sm font-bold shrink-0">
          P
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">Paciente</p>
          <p className="text-[#25d366] text-xs">en línea</p>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="px-3 py-4 min-h-[160px]"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23e5ddd5'/%3E%3C/svg%3E\")",
          backgroundColor: "#e5ddd5",
        }}
      >
        {/* Outbound bubble */}
        <div className="flex justify-end">
          <div className="relative max-w-[82%]">
            {/* Tail */}
            <div
              className="absolute -right-[6px] top-0 w-0 h-0"
              style={{
                borderLeft: "8px solid #dcf8c6",
                borderTop: "8px solid #dcf8c6",
                borderRight: "8px solid transparent",
                borderBottom: "8px solid transparent",
              }}
            />
            <div className="bg-[#dcf8c6] rounded-tl-2xl rounded-bl-2xl rounded-br-2xl px-3 pt-2 pb-1 shadow-sm">
              <p className="text-[#111] text-[13.5px] leading-[1.45] whitespace-pre-wrap wrap-break-word">
                {renderMessageBody(interpolated)}
              </p>
              {/* Timestamp + ticks */}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-[#667781]">{previewTime}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 18 18"
                  className="w-[14px] h-[14px] text-[#53bdeb]"
                  fill="currentColor"
                >
                  <path d="M17.394 5.035l-.57-.444a.434.434 0 0 0-.609.076L8.297 14.13l-3.956-3.862a.434.434 0 0 0-.614.007l-.505.517a.434.434 0 0 0 .007.614l4.557 4.449a.435.435 0 0 0 .619-.009l9.352-10.296a.436.436 0 0 0-.363-.515z" />
                  <path d="M11.588 5.035l-.57-.444a.434.434 0 0 0-.609.076L4 13.404l-.917-.895a.434.434 0 0 0-.614.007l-.505.517a.434.434 0 0 0 .007.614l1.523 1.488a.435.435 0 0 0 .619-.009l7.84-8.634a.436.436 0 0 0-.365-.457z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f0f0] border-t border-[#d9d9d9]">
        <div className="flex-1 bg-white rounded-full px-4 py-2 text-[#999] text-sm">
          Escribe un mensaje...
        </div>
        <div className="w-9 h-9 rounded-full bg-[#075e54] flex items-center justify-center text-white text-xs">
          ➤
        </div>
      </div>
    </div>
  );
}
