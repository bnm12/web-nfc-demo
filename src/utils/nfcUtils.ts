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
    
    // Payload Length field (SR or not)
    // This field is 1 byte if payloadByteLength < 256 (Short Record), or 4 bytes otherwise (Long Record).
    // This applies to all record types, including absolute-url which has an empty payload (payloadByteLength = 0),
    // so its payload length field will be 1 byte with value 0x00.
    recordSize += (payloadByteLength < 256 && !isRecursiveCall) ? 1 : 4;

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
export function arrayBufferToBase64(buffer: ArrayBuffer, mediaType: string): string {
  const byteArray = new Uint8Array(buffer);
  // Changed to Array.from for potentially better handling in environments like jsdom
  let binaryString = Array.from(byteArray, byte => String.fromCharCode(byte)).join('');
  const base64Data = btoa(binaryString);
  return `data:${mediaType};base64,${base64Data}`;
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
  const hexSanitized = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  
  let finalHex = hexSanitized;
  if (hexSanitized.length === 1) {
    finalHex = '0' + hexSanitized; // Handles 'F' -> '0F'
  } else if (hexSanitized.length % 2) {
    finalHex = hexSanitized + '0'; // Handles 'FF0' -> 'FF00', 'ABCDE' -> 'ABCDE0'
  }
  // If even length, finalHex remains hexSanitized (e.g. 'ABCD' -> 'ABCD')
  
  const bufferLength = finalHex.length / 2;
  const typedArray = new Uint8Array(bufferLength);
  for (let i = 0; i < finalHex.length; i += 2) {
    const byteString = finalHex.substring(i, i + 2);
    typedArray[i / 2] = parseInt(byteString, 16);
  }
  return typedArray.buffer;
}
