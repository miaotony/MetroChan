import qrcode from 'qrcode-generator';

export function qrImageUrl(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createDataURL(4);
}
