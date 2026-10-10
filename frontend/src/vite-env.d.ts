/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'html2canvas' {
  const html2canvas: any;
  export default html2canvas;
}

declare module 'jspdf' {
  export const jsPDF: any;
  const jsPDFDefault: any;
  export default jsPDFDefault;
}

