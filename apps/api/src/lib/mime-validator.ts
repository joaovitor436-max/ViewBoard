/**
 * Validação de MIME type real do ficheiro (magic bytes),
 * não dependendo apenas da extensão.
 */

// Magic bytes para tipos de ficheiro comuns
const SIGNATURES: Array<{
  mime: string;
  bytes: number[];
  offset?: number;
}> = [
  // Imagens
  { mime: "image/jpeg", bytes: [0xFF, 0xD8, 0xFF] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
  { mime: "image/svg+xml", bytes: [0x3C, 0x73, 0x76, 0x67] }, // <svg
  { mime: "image/svg+xml", bytes: [0x3C, 0x3F, 0x78, 0x6D, 0x6C] }, // <?xml

  // Vídeos
  { mime: "video/mp4", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp
  { mime: "video/webm", bytes: [0x1A, 0x45, 0xDF, 0xA3] },
];

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
]);

/**
 * Detecta o MIME type real de um buffer a partir dos magic bytes.
 * Retorna null se não reconhecer.
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Caso especial: WEBP precisa verificar bytes 8-11
      if (sig.mime === "image/webp") {
        if (
          buffer.length >= 12 &&
          buffer[8] === 0x57 && // W
          buffer[9] === 0x45 && // E
          buffer[10] === 0x42 && // B
          buffer[11] === 0x50    // P
        ) {
          return "image/webp";
        }
        continue; // É RIFF mas não é WEBP
      }
      return sig.mime;
    }
  }

  return null;
}

/**
 * Valida se o MIME type declarado corresponde ao MIME real do buffer.
 * Retorna o MIME real detectado ou lança erro.
 */
export function validateMimeType(
  declaredMime: string,
  buffer: Buffer
): { valid: boolean; detectedMime: string | null; declaredMime: string } {
  const detected = detectMimeType(buffer);

  // Se não conseguimos detectar, confiar no declarado mas verificar se é permitido
  if (!detected) {
    return {
      valid: ALLOWED_MIMES.has(declaredMime),
      detectedMime: null,
      declaredMime,
    };
  }

  // Verificar se o mime detectado é permitido
  if (!ALLOWED_MIMES.has(detected)) {
    return { valid: false, detectedMime: detected, declaredMime };
  }

  // Verificar se tipos são compatíveis (imagem com imagem, vídeo com vídeo)
  const declaredCategory = declaredMime.split("/")[0];
  const detectedCategory = detected.split("/")[0];

  return {
    valid: declaredCategory === detectedCategory,
    detectedMime: detected,
    declaredMime,
  };
}
