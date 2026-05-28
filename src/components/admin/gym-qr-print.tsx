"use client";

interface Props {
  gymName: string;
  qrDataUrl: string;
  checkinUrl: string;
}

export function GymQrPrint({ gymName, qrDataUrl, checkinUrl }: Props) {
  function print() {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`
      <html>
        <head><title>QR ${gymName}</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h1 style="font-size: 28px; margin-bottom: 8px;">${gymName}</h1>
          <p style="color:#555; margin-top:0;">Scannez pour pointer votre entrée</p>
          <img src="${qrDataUrl}" style="width: 360px; height: 360px;" />
          <p style="font-size: 12px; color:#888; word-break: break-all;">${checkinUrl}</p>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <button onClick={print} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium">
      Imprimer le QR
    </button>
  );
}
