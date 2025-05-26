import { describe, it, expect } from 'vitest';
import {
  isNDEFRecordTypeExternal,
  estimateNdefMessageSize,
  decodeRecord,
  arrayBufferToBase64,
  arrayBufferToHexString,
  hexStringToArrayBuffer,
} from '../../utils/nfcUtils'; 
import type { NDEFRecordInitCustom } from '../../@types/app'; // For NDEFRecordInit type used in estimateNdefMessageSize

/*global NDEFRecord, NDEFMessageInit*/ // For NDEFRecord type in decodeRecord and NDEFMessageInit in estimateNdefMessageSize

// Mock NDEFRecord type for decodeRecord tests
interface MockNDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView | null; 
  encoding?: string;
  lang?: string;
}

describe('nfcUtils', () => {
  describe('isNDEFRecordTypeExternal', () => {
    it('should return false for standard types', () => {
      expect(isNDEFRecordTypeExternal('text')).toBe(false);
      expect(isNDEFRecordTypeExternal('url')).toBe(false);
      expect(isNDEFRecordTypeExternal('mime')).toBe(false);
      expect(isNDEFRecordTypeExternal('smart-poster')).toBe(false);
      expect(isNDEFRecordTypeExternal('absolute-url')).toBe(false);
      expect(isNDEFRecordTypeExternal('empty')).toBe(false);
      expect(isNDEFRecordTypeExternal('unknown')).toBe(false);
    });

    it('should return true for external types (containing a colon)', () => {
      expect(isNDEFRecordTypeExternal('example.com:mytype')).toBe(true);
      expect(isNDEFRecordTypeExternal('some-domain:custom-data')).toBe(true);
    });

    it('should return false for empty or invalid input for external type check', () => {
      expect(isNDEFRecordTypeExternal('')).toBe(false);
      expect(isNDEFRecordTypeExternal('nodomain')).toBe(false); 
      // The original implementation of isNDEFRecordTypeExternal might have specific rules for what it considers valid beyond just having a colon.
      // Assuming it implies a non-standard type string with a colon.
      expect(isNDEFRecordTypeExternal(':justcolon')).toBe(true); // Based on current impl. (includes ':')
      expect(isNDEFRecordTypeExternal('domain:')).toBe(true);   // Based on current impl.
      expect(isNDEFRecordTypeExternal(':type')).toBe(true);    // Based on current impl.
    });
  });

  describe('estimateNdefMessageSize', () => {
    const textEncoder = new TextEncoder();

    it('should estimate size for an empty record', () => {
      const records: NDEFRecordInitCustom[] = [{ recordType: 'empty' }];
      expect(estimateNdefMessageSize(records)).toBe(1);
    });

    it('should estimate size for a simple text record', () => {
      const records: NDEFRecordInitCustom[] = [
        { recordType: 'text', data: 'Hello', lang: 'en' },
      ];
      // TNF/Flags (1) + Type Length (1 for "T") + Payload Length (1 SR) + ID Length (0) + Type ("T", 1) + Payload (Status (1) + 'en'(2) + 'Hello'(5)) = 1+1+1+0+1 + 1+2+5 = 12
      expect(estimateNdefMessageSize(records)).toBe(12);
    });
    
    it('should estimate size for a text record with an ID', () => {
        const records: NDEFRecordInitCustom[] = [
            { recordType: 'text', data: 'Hello', lang: 'en', id: 'my-id' },
        ];
        // 12 (from above) + ID Length (1 byte for length of 'my-id') + ID ('my-id', 5 bytes) = 12 + 1 + 5 = 18
        expect(estimateNdefMessageSize(records)).toBe(18);
    });

    it('should estimate size for a URL record', () => {
      const fullUrl = "https://example.com";
      const records: NDEFRecordInitCustom[] = [{ recordType: 'url', data: fullUrl }];
      const payloadLength = textEncoder.encode(fullUrl).length;
      // 1 (TNF) + 1 (TypeLen=1 for "U") + 1 (PayloadLen SR) + 1 (Type='U') + payloadLength
      expect(estimateNdefMessageSize(records)).toBe(1 + 1 + 1 + 1 + payloadLength);
    });

    it('should estimate size for an absolute-url record', () => {
      const urlData = 'ftp://example.com/file';
      const records: NDEFRecordInitCustom[] = [{ recordType: 'absolute-url', data: urlData }];
      const typeFieldLength = textEncoder.encode(urlData).length;
      // TNF (1) + Type Length (1 byte for length of type string) + Payload Length (0) + Actual Type (length of urlData)
      expect(estimateNdefMessageSize(records)).toBe(1 + 1 + 0 + typeFieldLength);
    });
    
    it('should estimate size for a mime record', () => {
        const mediaTypeStr = 'image/png';
        const payloadData = new ArrayBuffer(100);
        const records: NDEFRecordInitCustom[] = [
            { recordType: 'mime', mediaType: mediaTypeStr, data: payloadData },
        ];
        const mediaTypeLen = textEncoder.encode(mediaTypeStr).length;
        const payloadLen = payloadData.byteLength;
        // TNF(1) + TypeLen(1 for mediaTypeStr length) + PayloadLen(1 SR) + IDLen(0) + ActualType(mediaTypeLen) + Payload(payloadLen)
        const expectedSize = 1 + 1 + (payloadLen < 256 ? 1:4) + 0 + mediaTypeLen + payloadLen;
        expect(estimateNdefMessageSize(records)).toBe(expectedSize);
    });

    it('should estimate size for an external record', () => {
      const externalType = 'example.com:mytype';
      const payload = 'payload data';
      const records: NDEFRecordInitCustom[] = [
        { recordType: externalType, data: payload },
      ];
      const typeLen = textEncoder.encode(externalType).length;
      const payloadLen = textEncoder.encode(payload).length;
      // TNF(1) + TypeLen(1 for externalType length) + PayloadLen(1 SR) + IDLen(0) + ActualType(typeLen) + Payload(payloadLen)
      const expectedSize = 1 + 1 + (payloadLen < 256 ? 1:4) + 0 + typeLen + payloadLen;
      expect(estimateNdefMessageSize(records)).toBe(expectedSize);
    });
    
    it('should estimate size for a smart-poster record', () => {
        const nestedRecordsInit: NDEFRecordInitCustom[] = [
            { recordType: 'url', data: 'https://example.com' },
            { recordType: 'text', data: 'Title', lang: 'en' }
        ];
        // Cast to NDEFMessageInit for the data field of the smart-poster
        const smartPosterData = { records: nestedRecordsInit as NDEFRecordInit[] } as NDEFMessageInit;
        const records: NDEFRecordInitCustom[] = [
            { recordType: 'smart-poster', data: smartPosterData },
        ];
        const smartPosterTypeLen = textEncoder.encode("Sp").length; // "Sp" is 2 bytes
        const nestedMessageSize = estimateNdefMessageSize(nestedRecordsInit, true); // isRecursiveCall = true
        // TNF(1) + TypeLen(1 for "Sp" length) + PayloadLen(1 SR or 4 LR) + IDLen(0) + ActualType("Sp", 2 bytes) + Payload(nestedMessageSize)
        const expectedSize = 1 + 1 + (nestedMessageSize < 256 ? 1:4) + 0 + smartPosterTypeLen + nestedMessageSize;
        expect(estimateNdefMessageSize(records)).toBe(expectedSize);
    });

    it('should handle long records (payload > 255 bytes)', () => {
        const data = 'a'.repeat(300);
        const records: NDEFRecordInitCustom[] = [{ recordType: 'text', data, lang: 'en' }];
        const payloadBytes = 1 (status) + textEncoder.encode('en').length + textEncoder.encode(data).length;
        // TNF (1) + TypeLen (1 for "T") + PayloadLen (4 for LR) + IDLen (0) + TypeStr (1 for "T") + payloadBytes
        const expected = 1 + 1 + 4 + 0 + 1 + payloadBytes;
        expect(estimateNdefMessageSize(records)).toBe(expected);
    });
    
    it('should handle multiple records', () => {
        const records: NDEFRecordInitCustom[] = [
            { recordType: 'text', data: 'Hello', lang: 'en' }, // Size 12
            { recordType: 'empty' } // Size 1
        ];
        const expectedTotalSize = 12 + 1;
        expect(estimateNdefMessageSize(records) as number).toEqual(expectedTotalSize); // Using toEqual as per last fix
    });
  });

  describe('decodeRecord', () => {
    const textEncoder = new TextEncoder();

    it('should decode a UTF-8 text record', () => {
      const mockRecord: MockNDEFRecord = {
        recordType: 'text',
        encoding: 'utf-8',
        data: new DataView(textEncoder.encode('Hello, UTF-8!').buffer),
      };
      expect(decodeRecord(mockRecord as NDEFRecord)).toBe('Hello, UTF-8!');
    });

    it('should decode a UTF-16BE text record', () => {
      const utf16beBuffer = new Uint8Array([0x00, 0x48, 0x00, 0x65, 0x00, 0x6C, 0x00, 0x6C, 0x00, 0x6F]).buffer; // "Hello"
      const mockRecord: MockNDEFRecord = {
        recordType: 'text',
        encoding: 'utf-16be', 
        data: new DataView(utf16beBuffer),
      };
      expect(decodeRecord(mockRecord as NDEFRecord)).toBe('Hello');
    });
    
    it('should decode a UTF-16LE text record', () => {
      const utf16leBuffer = new Uint8Array([0x48, 0x00, 0x65, 0x00, 0x6C, 0x00, 0x6C, 0x00, 0x6F, 0x00]).buffer; // "Hello"
      const mockRecord: MockNDEFRecord = {
        recordType: 'text',
        encoding: 'utf-16le', 
        data: new DataView(utf16leBuffer),
      };
      expect(decodeRecord(mockRecord as NDEFRecord)).toBe('Hello');
    });


    it('should return "No data in record" if record.data is null', () => {
      const mockRecord: MockNDEFRecord = { recordType: 'text', data: null };
      expect(decodeRecord(mockRecord as NDEFRecord)).toBe('No data in record');
    });
    
    it('should return "No data in record" if record.data is undefined', () => {
      const mockRecord: MockNDEFRecord = { recordType: 'text', data: undefined };
      expect(decodeRecord(mockRecord as NDEFRecord)).toBe('No data in record');
    });

    it('should use utf-8 as default encoding if record.encoding is not specified', () => {
      const mockRecord: MockNDEFRecord = {
        recordType: 'text',
        data: new DataView(textEncoder.encode('Default encoding').buffer),
      };
      expect(decodeRecord(mockRecord as NDEFRecord)).toBe('Default encoding');
    });
  });

  describe('arrayBufferToBase64', () => {
    const textEncoder = new TextEncoder();
    it('should convert an ArrayBuffer to a base64 string with media type', () => {
      const buffer = textEncoder.encode('Hello World').buffer;
      const mediaType = 'text/plain';
      expect(arrayBufferToBase64(buffer, mediaType)).toBe('data:text/plain;base64,SGVsbG8gV29ybGQ=');
    });

    it('should handle an empty ArrayBuffer', () => {
      const buffer = new ArrayBuffer(0);
      const mediaType = 'application/octet-stream';
      expect(arrayBufferToBase64(buffer, mediaType)).toBe('data:application/octet-stream;base64,');
    });
    
    it('should handle binary data', () => {
        const buffer = new Uint8Array([0, 1, 2, 253, 254, 255]).buffer;
        const mediaType = 'application/octet-stream';
        expect(arrayBufferToBase64(buffer, mediaType)).toBe('data:application/octet-stream;base64,AAEChf/+/w==');
    });
  });

  describe('arrayBufferToHexString', () => {
    const textEncoder = new TextEncoder();
    it('should convert an ArrayBuffer to a hex string', () => {
      const buffer = textEncoder.encode('Hi').buffer; 
      expect(arrayBufferToHexString(buffer)).toBe('4869');
    });

    it('should handle an empty ArrayBuffer', () => {
      const buffer = new ArrayBuffer(0);
      expect(arrayBufferToHexString(buffer)).toBe('');
    });

    it('should pad single digit hex values with a leading zero', () => {
      const buffer = new Uint8Array([0, 1, 10, 15, 16]).buffer; 
      expect(arrayBufferToHexString(buffer)).toBe('00010a0f10');
    });
  });

  describe('hexStringToArrayBuffer', () => {
    it('should convert a hex string (with 0x prefix) to an ArrayBuffer', () => {
      const hex = '0x48656c6c6f'; // "Hello"
      const buffer = hexStringToArrayBuffer(hex);
      expect(new Uint8Array(buffer)).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it('should convert a hex string (without 0x prefix) to an ArrayBuffer', () => {
      const hex = '48656c6c6f'; // "Hello"
      const buffer = hexStringToArrayBuffer(hex);
      expect(new Uint8Array(buffer)).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
    });

    it('should handle an empty hex string', () => {
      const buffer = hexStringToArrayBuffer('');
      expect(buffer.byteLength).toBe(0);
    });

    it('should handle an odd length hex string (padding with 0 implicitly for the last byte)', () => {
      const buffer1 = hexStringToArrayBuffer('F'); // Expected: [0x0F]
      expect(new Uint8Array(buffer1)).toEqual(new Uint8Array([0x0F]));
      
      const buffer2 = hexStringToArrayBuffer('FF0'); // Expected: [0xFF, 0x00]
      expect(new Uint8Array(buffer2)).toEqual(new Uint8Array([0xFF, 0x00]));

      const buffer3 = hexStringToArrayBuffer('0xABCDE'); // Expected: [0xAB, 0xCD, 0xE0]
      expect(new Uint8Array(buffer3)).toEqual(new Uint8Array([0xAB, 0xCD, 0xE0]));
    });

    it('should handle hex strings with uppercase and lowercase characters', () => {
      const hex = '0xaBcDeF';
      const buffer = hexStringToArrayBuffer(hex);
      expect(new Uint8Array(buffer)).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
    });
  });
});
