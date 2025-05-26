/*global NDEFRecordInit, NDEFMessageInit*/ // For WebNFC global types

import { describe, it, expect } from 'vitest';
import type { NDEFRecordInitCustom } from '../../@types/app'; 
import { hexStringToArrayBuffer as realHexStringToArrayBuffer } from '../../utils/nfcUtils'; 

// Copied prepareRecordPayload function from AddRecordForm.vue
function prepareRecordPayload(
  currentRecordType: string,
  currentExternalTypeString: string,
  currentMediaType: string,
  currentId: string,
  currentEncoding: string,
  currentLang: string,
  currentTextData: string,
  currentFileDataBuffer: ArrayBuffer | null,
  currentSmartPosterUrl: string,
  isMimeTextBased: boolean, 
  hexToBufferUtil: (hex: string) => ArrayBuffer
): NDEFRecordInitCustom {
  const record: NDEFRecordInitCustom = { 
    recordType: currentRecordType === 'external' ? currentExternalTypeString : currentRecordType 
  };

  if (currentId) record.id = currentId;

  if (currentRecordType === "text") {
    record.data = currentTextData;
    record.encoding = currentEncoding || "utf-8"; 
    record.lang = currentLang || "en";       
  } else if (currentRecordType === "url" || currentRecordType === "absolute-url") {
    record.data = currentTextData;
  } else if (currentRecordType === "mime") {
    record.mediaType = currentMediaType;
    if (currentFileDataBuffer) {
      record.data = currentFileDataBuffer;
    } else { 
      record.data = currentTextData; 
      if (isMimeTextBased && currentEncoding) {
         record.encoding = currentEncoding;
      }
    }
  } else if (currentRecordType === "smart-poster") {
    const nestedRecords: NDEFRecordInit[] = [ 
      { recordType: "url", data: currentSmartPosterUrl } 
    ];
    if (currentTextData) { 
      nestedRecords.push({ recordType: "text", data: currentTextData, lang: currentLang || "en", encoding: currentEncoding || "utf-8" });
    }
    record.data = { records: nestedRecords } as NDEFMessageInit; 
  } else if (currentRecordType === "external") {
    if (currentFileDataBuffer) {
      record.data = currentFileDataBuffer;
    } else { 
      record.data = currentTextData;
      if (currentEncoding) record.encoding = currentEncoding;
    }
  } else if (currentRecordType === "unknown") {
    if (currentFileDataBuffer) {
      record.data = currentFileDataBuffer;
    } else { 
      if (currentTextData.startsWith("0x")) {
        record.data = hexToBufferUtil(currentTextData);
      } else {
        record.data = currentTextData; 
        if (currentEncoding) record.encoding = currentEncoding;
      }
    }
  } else if (currentRecordType === "empty") {
    // No specific data fields
  }
  return record;
}


describe('prepareRecordPayload', () => {
  // Define default arguments to pass to prepareRecordPayload for each test, overriding as needed.
  const getDefaultArgs = () => ({
    currentExternalTypeString: '',
    currentMediaType: '',
    currentId: '',
    currentEncoding: 'utf-8', // Default in form
    currentLang: 'en',       // Default in form
    currentTextData: '',
    currentFileDataBuffer: null,
    currentSmartPosterUrl: '',
    isMimeTextBased: false,
    hexToBufferUtil: realHexStringToArrayBuffer, // Use the real utility
  });

  it('should prepare a "text" record correctly', () => {
    const args = { ...getDefaultArgs(), currentTextData: 'Hello', currentLang: 'fr', currentEncoding: 'utf-16', currentId: 'id1' };
    const result = prepareRecordPayload('text', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
    expect(result).toEqual({
      recordType: 'text',
      data: 'Hello',
      encoding: 'utf-16',
      lang: 'fr',
      id: 'id1',
    });
  });
  
  it('should prepare a "text" record with default encoding and lang when inputs are empty', () => {
    const args = { ...getDefaultArgs(), currentTextData: 'Default', currentEncoding: '', currentLang: '' };
    const result = prepareRecordPayload('text', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
    expect(result).toEqual({
      recordType: 'text',
      data: 'Default',
      encoding: 'utf-8', // Default applied by function
      lang: 'en',       // Default applied by function
    });
  });

  it('should prepare a "url" record correctly', () => {
    const args = { ...getDefaultArgs(), currentTextData: 'example.com', currentId: 'id-url' };
    const result = prepareRecordPayload('url', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
    expect(result).toEqual({
      recordType: 'url',
      data: 'example.com',
      id: 'id-url',
    });
  });

  it('should prepare an "absolute-url" record correctly', () => {
    const args = { ...getDefaultArgs(), currentTextData: 'https://absolute.com' };
    const result = prepareRecordPayload('absolute-url', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
    expect(result).toEqual({
      recordType: 'absolute-url',
      data: 'https://absolute.com',
    });
  });

  describe('"mime" record preparation', () => {
    const fileBuffer = new ArrayBuffer(8);
    it('with fileDataBuffer', () => {
      const args = { ...getDefaultArgs(), currentMediaType: 'image/png', currentFileDataBuffer: fileBuffer, currentId: 'mime1' };
      const result = prepareRecordPayload('mime', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({
        recordType: 'mime',
        mediaType: 'image/png',
        data: fileBuffer,
        id: 'mime1',
      });
    });

    it('with textData (text-based mime with encoding)', () => {
      const args = { ...getDefaultArgs(), currentMediaType: 'application/json', currentTextData: '{"key":"value"}', isMimeTextBased: true, currentEncoding: 'utf-16' };
      const result = prepareRecordPayload('mime', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({
        recordType: 'mime',
        mediaType: 'application/json',
        data: '{"key":"value"}',
        encoding: 'utf-16',
      });
    });
    
    it('with textData (non-text-based mime, encoding should be ignored)', () => {
      const args = { ...getDefaultArgs(), currentMediaType: 'application/octet-stream', currentTextData: 'binary as text', isMimeTextBased: false, currentEncoding: 'utf-16' };
      const result = prepareRecordPayload('mime', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({ 
        recordType: 'mime',
        mediaType: 'application/octet-stream',
        data: 'binary as text',
      });
    });
  });

  describe('"smart-poster" record preparation', () => {
    it('with URL and title', () => {
      const args = { ...getDefaultArgs(), currentSmartPosterUrl: 'https://smart.com', currentTextData: 'Smart Title', currentLang: 'de', currentEncoding: 'utf-8', currentId: 'sp1' };
      const result = prepareRecordPayload('smart-poster', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result.recordType).toBe('smart-poster');
      expect(result.id).toBe('sp1');
      const messageInit = result.data as NDEFMessageInit;
      expect(messageInit.records.length).toBe(2);
      expect(messageInit.records[0]).toEqual({ recordType: 'url', data: 'https://smart.com' });
      expect(messageInit.records[1]).toEqual({ recordType: 'text', data: 'Smart Title', lang: 'de', encoding: 'utf-8' });
    });

    it('with URL only (no title text)', () => {
      const args = { ...getDefaultArgs(), currentSmartPosterUrl: 'https://smart.com', currentTextData: '' };
      const result = prepareRecordPayload('smart-poster', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      const messageInit = result.data as NDEFMessageInit;
      expect(messageInit.records.length).toBe(1);
      expect(messageInit.records[0]).toEqual({ recordType: 'url', data: 'https://smart.com' });
    });
    
    it('with URL and title, but empty lang/encoding for title (should use defaults for title)', () => {
      const args = { ...getDefaultArgs(), currentSmartPosterUrl: 'https://smart.com', currentTextData: 'Smart Title', currentLang: '', currentEncoding: '' };
      const result = prepareRecordPayload('smart-poster', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      const messageInit = result.data as NDEFMessageInit;
      expect(messageInit.records[1]).toEqual({ recordType: 'text', data: 'Smart Title', lang: 'en', encoding: 'utf-8' });
    });
  });
  
  describe('"external" record preparation', () => {
    const fileBuffer = new ArrayBuffer(16);
    it('with fileDataBuffer', () => {
      const args = { ...getDefaultArgs(), currentExternalTypeString: 'my:type', currentFileDataBuffer: fileBuffer, currentId: 'ext1' };
      const result = prepareRecordPayload('external', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({
        recordType: 'my:type',
        data: fileBuffer,
        id: 'ext1',
      });
    });

    it('with textData and encoding', () => {
      const args = { ...getDefaultArgs(), currentExternalTypeString: 'another:type', currentTextData: 'external data', currentEncoding: 'utf-16' };
      const result = prepareRecordPayload('external', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({
        recordType: 'another:type',
        data: 'external data',
        encoding: 'utf-16',
      });
    });
  });

  describe('"unknown" record preparation', () => {
    const fileBuffer = new ArrayBuffer(4);
    it('with fileDataBuffer', () => {
      const args = { ...getDefaultArgs(), currentFileDataBuffer: fileBuffer, currentId: 'unk1' };
      const result = prepareRecordPayload('unknown', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({
        recordType: 'unknown',
        data: fileBuffer,
        id: 'unk1',
      });
    });

    it('with textData (UTF-8 string)', () => {
      const args = { ...getDefaultArgs(), currentTextData: 'plain string data', currentEncoding: 'utf-8' };
      const result = prepareRecordPayload('unknown', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result).toEqual({
        recordType: 'unknown',
        data: 'plain string data',
        encoding: 'utf-8',
      });
    });

    it('with textData (hex string)', () => {
      const hexInput = "0x0102AABB";
      const expectedBuffer = realHexStringToArrayBuffer(hexInput); // Use the real utility for expectation
      const args = { ...getDefaultArgs(), currentTextData: hexInput };
      const result = prepareRecordPayload('unknown', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
      expect(result.recordType).toBe('unknown');
      expect(result.data).toEqual(expectedBuffer);
      expect((result as any).encoding).toBeUndefined(); 
    });
  });

  it('should prepare an "empty" record correctly', () => {
    const args = { ...getDefaultArgs(), currentId: 'empty1' };
    const result = prepareRecordPayload('empty', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
    expect(result).toEqual({
      recordType: 'empty',
      id: 'empty1',
    });
    expect(result.data).toBeUndefined();
    expect(result.mediaType).toBeUndefined();
    expect(result.encoding).toBeUndefined();
    expect(result.lang).toBeUndefined();
  });

  it('should include ID if provided for any type', () => {
    const args = { ...getDefaultArgs(), currentTextData: 'Test', currentId: 'test-id-123' };
    const result = prepareRecordPayload('text', args.currentExternalTypeString, args.currentMediaType, args.currentId, args.currentEncoding, args.currentLang, args.currentTextData, args.currentFileDataBuffer, args.currentSmartPosterUrl, args.isMimeTextBased, args.hexToBufferUtil);
    expect(result.id).toBe('test-id-123');
  });
});
