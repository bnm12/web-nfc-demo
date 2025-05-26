import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { handleAddRecord, handleDeleteRecord } from '../../services/recordService'; 
import type { NDEFRecordInitCustom, ScannedTag } from '../../@types/app'; 

/*global NDEFRecord, NDEFMessageInit, TextEncoder */ // TextEncoder for mock NDEFRecord

// Mock NDEFRecord and alert
const mockAlert = vi.fn();
let mockNdefRecordInstance: any; 

const mockNDEFRecordConstructor = vi.fn((payload) => {
  let instanceData: DataView | NDEFMessageInit | undefined;
  // Simulate NDEFRecord data handling for common cases
  if (payload.data instanceof ArrayBuffer) {
    instanceData = new DataView(payload.data);
  } else if (typeof payload.data === 'string') {
    instanceData = new DataView(new TextEncoder().encode(payload.data).buffer);
  } else if (payload.data && typeof payload.data === 'object' && 'records' in payload.data) { 
    instanceData = payload.data as NDEFMessageInit; 
  } else {
    instanceData = undefined;
  }

  mockNdefRecordInstance = {
    ...payload,
    data: instanceData, // Store processed data
    // Simulate the actual NDEFRecord behavior where 'smart-poster' data is null
    ...(payload.recordType === "smart-poster" && { data: null }), 
  };
  
  // Store the original payload.data for smart-poster on the instance if needed for assertion
  if (payload.recordType === "smart-poster" && payload.data) {
    (mockNdefRecordInstance as any)._smartPosterDataFromConstructor = payload.data;
  }

  return mockNdefRecordInstance;
});


describe('recordService', () => {
  let scannedTag: Ref<ScannedTag>;
  let showAddForm: Ref<boolean>;

  beforeAll(() => {
    vi.stubGlobal('NDEFRecord', mockNDEFRecordConstructor);
    vi.stubGlobal('alert', mockAlert);
  });

  beforeEach(() => {
    mockNDEFRecordConstructor.mockClear();
    mockAlert.mockClear();
    
    scannedTag = ref<ScannedTag>({ uuid: 'test-uuid', records: [] });
    showAddForm = ref(true); 
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('handleAddRecord', () => {
    it('should add a text record successfully', () => {
      const recordInit: NDEFRecordInitCustom = { recordType: 'text', data: 'Hello' };
      handleAddRecord(recordInit, scannedTag, showAddForm);

      expect(mockNDEFRecordConstructor).toHaveBeenCalledWith(recordInit);
      expect(scannedTag.value.records.length).toBe(1);
      expect(scannedTag.value.records[0]).toEqual(mockNdefRecordInstance);
      expect(showAddForm.value).toBe(false);
    });
    
    it('should add a smart-poster record and attach _smartPosterData', () => {
      const smartPosterPayload: NDEFMessageInit = { records: [{ recordType: 'url', data: 'https://example.com' }] };
      const recordInit: NDEFRecordInitCustom = { recordType: 'smart-poster', data: smartPosterPayload };
      
      handleAddRecord(recordInit, scannedTag, showAddForm);

      expect(mockNDEFRecordConstructor).toHaveBeenCalledWith(recordInit);
      expect(scannedTag.value.records.length).toBe(1);
      const addedRecord = scannedTag.value.records[0] as any; 
      expect(addedRecord.recordType).toBe('smart-poster');
      // Check the custom property attached by handleAddRecord
      expect(addedRecord._smartPosterData).toEqual(smartPosterPayload); 
      // Check that the NDEFRecord constructor indeed received the payload for smart poster (via the mock)
      expect(addedRecord._smartPosterDataFromConstructor).toEqual(smartPosterPayload);
      expect(addedRecord.data).toBeNull(); // As per mock simulation of real NDEFRecord
      expect(showAddForm.value).toBe(false);
    });

    it('should call alert and not add record if NDEFRecord constructor throws', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); 
      mockNDEFRecordConstructor.mockImplementationOnce(() => {
        throw new Error('Test NDEFRecord construction error');
      });
      const recordInit: NDEFRecordInitCustom = { recordType: 'text', data: 'test' };
      
      handleAddRecord(recordInit, scannedTag, showAddForm);

      expect(mockAlert).toHaveBeenCalledWith('Error adding record: Test NDEFRecord construction error');
      expect(scannedTag.value.records.length).toBe(0);
      expect(showAddForm.value).toBe(false); 
      errorSpy.mockRestore();
    });

     it('should correctly pass id, mediaType, encoding, lang to NDEFRecord constructor', () => {
        const recordInit: NDEFRecordInitCustom = {
            recordType: 'text',
            data: 'Hello',
            id: 'test-id',
            mediaType: 'text/plain', 
            encoding: 'utf-16',
            lang: 'fr'
        };
        handleAddRecord(recordInit, scannedTag, showAddForm);
        expect(mockNDEFRecordConstructor).toHaveBeenCalledWith(recordInit);
        expect(scannedTag.value.records.length).toBe(1);
        const addedRecord = scannedTag.value.records[0];
        expect(addedRecord.id).toBe('test-id');
        expect(addedRecord.mediaType).toBe('text/plain');
        expect(addedRecord.encoding).toBe('utf-16');
        expect(addedRecord.lang).toBe('fr');
        expect(showAddForm.value).toBe(false);
    });
  });

  describe('handleDeleteRecord', () => {
    beforeEach(() => {
      // Simulate NDEFRecord instances being created by the mock for consistent testing
      const r1 = mockNDEFRecordConstructor({ recordType: 'text', data: 'record1' });
      const r2 = mockNDEFRecordConstructor({ recordType: 'url', data: 'http://example.com' });
      const r3 = mockNDEFRecordConstructor({ recordType: 'mime', mediaType: 'image/png', data: new ArrayBuffer(10) });
      scannedTag.value.records = [r1, r2, r3];
    });

    it('should delete a record at a valid index', () => {
      const initialLength = scannedTag.value.records.length;
      const recordToDelete = scannedTag.value.records[1]; // The 'url' record
      handleDeleteRecord(1, scannedTag); 
      
      expect(scannedTag.value.records.length).toBe(initialLength - 1);
      expect(scannedTag.value.records.includes(recordToDelete)).toBe(false);
      expect(scannedTag.value.records[0].recordType).toBe('text');
      expect(scannedTag.value.records[1].recordType).toBe('mime');
    });

    it('should not change records if index is negative', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const initialRecords = [...scannedTag.value.records];
      handleDeleteRecord(-1, scannedTag);
      
      expect(scannedTag.value.records).toEqual(initialRecords);
      expect(warnSpy).toHaveBeenCalledWith('Attempted to delete record at invalid index: -1');
      warnSpy.mockRestore();
    });

    it('should not change records if index is out of bounds (too large)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const initialRecords = [...scannedTag.value.records];
      const outOfBoundsIndex = scannedTag.value.records.length;
      handleDeleteRecord(outOfBoundsIndex, scannedTag);
      
      expect(scannedTag.value.records).toEqual(initialRecords);
      expect(warnSpy).toHaveBeenCalledWith(`Attempted to delete record at invalid index: ${outOfBoundsIndex}`);
      warnSpy.mockRestore();
    });

    it('should handle deletion when records list is empty', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      scannedTag.value.records = [];
      handleDeleteRecord(0, scannedTag);
      
      expect(scannedTag.value.records.length).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith('Attempted to delete record at invalid index: 0');
      warnSpy.mockRestore();
    });
  });
});
