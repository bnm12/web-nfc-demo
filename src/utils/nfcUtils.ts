// src/utils/nfcUtils.ts
/*global NDEFRecord, NDEFMessageInit*/ // For estimateNdefMessageSize using NDEFMessageInit
import type { NDEFRecordInitCustom } from '../@types/app';

// Helper function to check if a record type string denotes an external type.
export function isNDEFRecordTypeExternal(recordType: string): boolean {
  if (!recordType) return false;
  // Standard NDEF types that are not "external type NDEF".
  const standardTypes = ["empty", "text", "url", "smart-poster", "absolute-url", "mime", "unknown"];
  // An external type is identified by containing a colon, as per NDEF RTD specification.
  // It must not be one of the well-known types that might use a colon in a subtype (e.g., 'mime' which uses mediaType).
  // However, for the purpose of this function, we only care if the recordType string itself is a domain-name based type.
  return !standardTypes.includes(recordType) && recordType.includes(':');
}

// Estimates the size of an NDEF message.
export function estimateNdefMessageSize(records: NDEFRecordInit[], isRecursiveCall = false): number {
  let totalSize = 0;
  const textEncoder = new TextEncoder();

  records.forEach(record => {
    let recordSize = 1; // TNF/Flags byte

    let typeStringForCalc = "";
    if (record.recordType === 'empty' || record.recordType === 'unknown') {
      typeStringForCalc = ""; 
    } else if (record.recordType === 'absolute-url') {
      typeStringForCalc = (typeof record.data === 'string') ? record.data : "";
    } else if (record.recordType === 'mime' && record.mediaType) {
      typeStringForCalc = record.mediaType;
    } else if (isNDEFRecordTypeExternal(record.recordType)) {
      typeStringForCalc = record.recordType; 
    } else if (record.recordType === 'text') {
      typeStringForCalc = "T"; 
    } else if (record.recordType === 'url') {
      typeStringForCalc = "U"; 
    } else if (record.recordType === 'smart-poster') {
      typeStringForCalc = "Sp"; 
    } else {
      // This case should ideally not be hit if all record types are handled.
      // It might represent a custom but not-formally-external type.
      typeStringForCalc = record.recordType; 
    }
    
    const typeFieldLength = textEncoder.encode(typeStringForCalc).length;

    if (record.recordType === 'empty') { 
      totalSize += recordSize; 
      return; 
    }

    recordSize += 1; // Type Length byte
    recordSize += typeFieldLength;

    let payloadByteLength = 0;
    if (record.recordType === 'absolute-url') {
      payloadByteLength = 0; 
    } else if (record.recordType === 'text') {
      let textDataLength = 0;
      if (typeof record.data === 'string') {
        // Note: NDEFRecord constructor might use different encoding based on record.encoding.
        // For estimation, consistently using UTF-8 for string data length is a common approach.
        textDataLength = textEncoder.encode(record.data).length; 
      }
      const langCode = record.lang || "en"; 
      const langCodeByteLength = textEncoder.encode(langCode).length;
      payloadByteLength = 1 + langCodeByteLength + textDataLength; 
    } else if (record.recordType === 'smart-poster' && record.data && typeof record.data === 'object' && 'records' in record.data) {
      payloadByteLength = estimateNdefMessageSize((record.data as NDEFMessageInit).records, true);
    } else if (record.data) { 
      if (typeof record.data === 'string') {
        payloadByteLength = textEncoder.encode(record.data).length;
      } else if (record.data instanceof ArrayBuffer) {
        payloadByteLength = record.data.byteLength;
      }
    }
    
    recordSize += (payloadByteLength < 256 && !isRecursiveCall) ? 1 : 4; // Payload Length field (SR or not)
                                                                    // NDEF spec section 3.2.5: SR flag is only for the first record chunk.
                                                                    // For nested records (like in Smart Poster), SR might not apply the same way or be forced off.
                                                                    // However, NDEFRecord constructor handles this, so for estimation, this logic is an approximation.
                                                                    // A simple heuristic: if it's a recursive call, assume it might not be a short record.

    if (record.id) {
      recordSize += 1; // ID Length byte
      recordSize += textEncoder.encode(record.id).length;
    }
    
    recordSize += payloadByteLength;
    totalSize += recordSize;
  });

  return totalSize;
}

// Decodes the payload of an NDEFRecord for display purposes.
export function decodeRecord(record: NDEFRecord): string {
  if (!record.data) {
    return "No data in record";
  }
  // TextDecoder will use record.encoding if present, or UTF-8 default.
  const decoder = new TextDecoder(record.encoding ?? "utf-8");
  return decoder.decode(record.data.buffer); // record.data is a DataView
}

// Converts an ArrayBuffer to a Base64 string, prepended with a data URL scheme.
const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function arrayBufferToBase64(buffer: ArrayBuffer, mediaType: string): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  let i;

  for (i = 0; i < bytes.length - 2; i += 3) {
    result += base64Chars[bytes[i] >> 2];
    result += base64Chars[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
    result += base64Chars[((bytes[i + 1] & 0x0F) << 2) | (bytes[i + 2] >> 6)];
    result += base64Chars[bytes[i + 2] & 0x3F];
  }

  if (i < bytes.length) {
    result += base64Chars[bytes[i] >> 2];
    if (bytes.length % 3 === 2) { // Two bytes left
      result += base64Chars[((bytes[i] & 0x03) << 4) | (bytes[i + 1] >> 4)];
      result += base64Chars[(bytes[i + 1] & 0x0F) << 2];
      result += "=";
    } else { // One byte left
      result += base64Chars[(bytes[i] & 0x03) << 4];
      result += "==";
    }
  }
  return `data:${mediaType};base64,${result}`;
}

// Converts an ArrayBuffer to a hexadecimal string.
export function arrayBufferToHexString(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  let hexString = "";
  for (let i = 0; i < byteArray.byteLength; i++) {
    hexString += byteArray[i].toString(16).padStart(2, "0");
  }
  return hexString;
}

// Converts a hexadecimal string (with or without "0x" prefix) to an ArrayBuffer.
export function hexStringToArrayBuffer(hexString: string): ArrayBuffer {
  let hex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  if (hex.length % 2 !== 0) {
    hex += "0"; // Pad with a zero if odd length
  }
  const bufferLength = hex.length / 2;
  const typedArray = new Uint8Array(bufferLength);
  for (let i = 0; i < hex.length; i += 2) {
    const byteString = hex.substring(i, i + 2);
    typedArray[i / 2] = parseInt(byteString, 16);
  }
  return typedArray.buffer;
}
