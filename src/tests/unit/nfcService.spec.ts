import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { SpyInstance } from 'vitest';
import { ref, nextTick } from 'vue';
import type { Ref } from 'vue';
import { readNFC, writeNFC, cancelScan } from '../../services/nfcService'; // Removed readNFC_simplified_diagnostic
import type { NFCStatus, ScannedTag } from '../../@types/app'; // NDEFRecordInitCustom not directly used by service tests
import * as nfcUtils from '../../utils/nfcUtils'; 

/*global NDEFReader, NDEFRecord, AbortController, DOMException, NDEFMessageInit */ // Added NDEFMessageInit

// --- Mocks ---
const mockAlert = vi.fn();
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock NDEFReader
let mockNdefReaderInstance: any;
const MockNDEFReaderConstructor = vi.fn(() => {
  mockNdefReaderInstance = {
    scan: vi.fn((options?: any) => Promise.resolve()), // Default mock resolves, accepts optional arg
    write: vi.fn((message: any, options?: any) => Promise.resolve()), // write also accepts options
    onreading: null,
    onreadingerror: null,
    // makeRecordsWritable is not part of standard NDEFReader, was a custom method in older service
  };
  return mockNdefReaderInstance;
});

// Mock AbortController
let mockAbortControllerInstance: any;
const MockAbortControllerConstructor = vi.fn(() => {
  mockAbortControllerInstance = {
    abort: vi.fn(() => {
        if (mockAbortControllerInstance.signal.onabort) {
            mockAbortControllerInstance.signal.aborted = true; 
            mockAbortControllerInstance.signal.onabort({} as Event); // Pass mock Event
        }
    }),
    signal: { 
        aborted: false, 
        onabort: null as (() => void) | null, // Ensure onabort type is correct
    },
  };
  return mockAbortControllerInstance;
});


describe('nfcService', () => {
  let status: Ref<NFCStatus>;
  let scannedTag: Ref<ScannedTag>;
  let continuousScan: Ref<boolean>;
  let scanAbortControllerRef: Ref<AbortController | null>; 

  beforeAll(() => {
    vi.stubGlobal('NDEFReader', MockNDEFReaderConstructor);
    vi.stubGlobal('AbortController', MockAbortControllerConstructor);
    vi.stubGlobal('alert', mockAlert);
  });

  beforeEach(() => {
    status = ref<NFCStatus>({ reading: false, writing: false });
    scannedTag = ref<ScannedTag>({ uuid: '', records: [] });
    continuousScan = ref(true);
    scanAbortControllerRef = ref<AbortController | null>(null);

    mockAlert.mockClear();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    MockNDEFReaderConstructor.mockClear();
    if (mockNdefReaderInstance) {
      mockNdefReaderInstance.scan.mockClear();
      mockNdefReaderInstance.write.mockClear();
      mockNdefReaderInstance.onreading = null;
      mockNdefReaderInstance.onreadingerror = null;
    }
    MockAbortControllerConstructor.mockClear();
    if (mockAbortControllerInstance) {
        mockAbortControllerInstance.abort.mockClear();
        if (mockAbortControllerInstance.signal) { // Check if signal exists
            mockAbortControllerInstance.signal.aborted = false;
            mockAbortControllerInstance.signal.onabort = null;
        }
    }
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe('readNFC', () => {
    it('should set status.reading to true and initialize NDEFReader and AbortController', async () => {
      readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);
      expect(status.value.reading).toBe(true);
      expect(MockNDEFReaderConstructor).toHaveBeenCalledTimes(1);
      expect(MockAbortControllerConstructor).toHaveBeenCalledTimes(1);
      expect(scanAbortControllerRef.value).toStrictEqual(mockAbortControllerInstance);
      expect(mockNdefReaderInstance.scan).toHaveBeenCalledWith({ signal: mockAbortControllerInstance.signal });
    });

    it('should return early if scan is already in progress', async () => {
      status.value.reading = true;
      await readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);
      expect(MockNDEFReaderConstructor).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith("Scan already in progress.");
    });

    it('successful single scan: updates tag, sets reading false, aborts controller', async () => {
      continuousScan.value = false;
      const readPromise = readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);
      
      await Promise.resolve(); // Allow microtasks to run (e.g., promise in readNFC)
      expect(mockNdefReaderInstance.onreading).toBeTypeOf('function'); // Ensure onreading is set
      if (mockNdefReaderInstance.onreading) {
        mockNdefReaderInstance.onreading({ serialNumber: 'test-sn', message: { records: [{ recordType: 'text', data: 'test' }] } });
      }
      await readPromise; 
      
      expect(scannedTag.value.uuid).toBe('test-sn');
      expect(scannedTag.value.records.length).toBe(1);
      expect(status.value.reading).toBe(false);
      expect(mockAbortControllerInstance.abort).toHaveBeenCalledTimes(1);
    });

    it('successful continuous scan: updates tag, reading remains true', async () => {
      continuousScan.value = true;
      const readPromise = readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);
      
      await Promise.resolve();
      expect(mockNdefReaderInstance.onreading).toBeTypeOf('function');
      if (mockNdefReaderInstance.onreading) {
        mockNdefReaderInstance.onreading({ serialNumber: 'continuous-sn', message: { records: [{ recordType: 'url', data: 'http://cont.com' }] } });
      }
      await readPromise;

      expect(scannedTag.value.uuid).toBe('continuous-sn');
      expect(scannedTag.value.records.length).toBe(1);
      expect(status.value.reading).toBe(true); 
    });

    it('should ignore onreading event if write operation is in progress', async () => {
      status.value.writing = true;
      const readPromise = readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);

      await Promise.resolve();
      expect(mockNdefReaderInstance.onreading).toBeTypeOf('function');
      if (mockNdefReaderInstance.onreading) {
        mockNdefReaderInstance.onreading({ serialNumber: 'ignored-sn', message: { records: [] } });
      }
      await readPromise;
      
      expect(scannedTag.value.uuid).toBe(''); 
      expect(mockConsoleLog).toHaveBeenCalledWith("Write operation in progress, ignoring read event.");
    });

    it('should set status.reading to false when scan is aborted via AbortSignal', async () => {
      const readPromise = readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);
      expect(status.value.reading).toBe(true);

      // Simulate abortion by directly calling the onabort handler if it's set on the mock's signal
      expect(scanAbortControllerRef.value?.signal?.onabort).toBeTypeOf('function');
      if (scanAbortControllerRef.value?.signal?.onabort) {
        (scanAbortControllerRef.value.signal as any).aborted = true; 
        scanAbortControllerRef.value.signal.onabort({} as Event); // Pass mock Event
      }
      await readPromise.catch(() => {}); // Catch potential AbortError if scan() rejects
      
      expect(status.value.reading).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith("Scan aborted via AbortSignal.");
    });

    it('onreadingerror event: sets reading false and logs error', async () => {
      const readPromise = readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);

      await Promise.resolve();
      expect(mockNdefReaderInstance.onreadingerror).toBeTypeOf('function');
      if (mockNdefReaderInstance.onreadingerror) {
        mockNdefReaderInstance.onreadingerror({ message: 'Test read error' });
      }
      await readPromise;
      
      expect(status.value.reading).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith("NDEF reading error:", { message: 'Test read error' });
    });
    
    it('onreadingerror event when scan was aborted: logs different message', async () => {
      const readPromise = readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);

      await Promise.resolve();
      if (scanAbortControllerRef.value?.signal) { 
        (scanAbortControllerRef.value.signal as any).aborted = true;
      }
      expect(mockNdefReaderInstance.onreadingerror).toBeTypeOf('function');
      if (mockNdefReaderInstance.onreadingerror) {
        mockNdefReaderInstance.onreadingerror({ message: 'Test read error after abort' });
      }
      await readPromise;
      
      expect(status.value.reading).toBe(false);
      expect(mockConsoleLog).toHaveBeenCalledWith("Reading error due to scan abortion.");
    });


    it('ndef.scan() throws AbortError: sets reading false, logs abortion', async () => {
      const abortError = new DOMException('Scan aborted by user.', 'AbortError');

      // Configure the mock NDEFReader constructor for this specific test
      // to ensure the 'scan' call within readNFC throws the abortError.
      MockNDEFReaderConstructor.mockImplementationOnce(() => {
        // Create a new mock instance for this specific test run
        const specificMockNdefReaderInstance = {
          scan: vi.fn().mockImplementationOnce(async () => {
            await Promise.resolve(); // Ensure async behavior
            throw abortError;
          }),
          write: vi.fn(() => Promise.resolve()), // Default write behavior
          onreading: null,
          onreadingerror: null,
        };
        // Assign to the outer scope mockNdefReaderInstance for potential cleanup access,
        // though this instance is primarily for this test. The service gets this instance.
        mockNdefReaderInstance = specificMockNdefReaderInstance;
        return specificMockNdefReaderInstance;
      });

      // Call the main readNFC function.
      // readNFC doesn't return a promise that signals completion of scan,
      // it sets up event handlers and its own try/catch handles scan errors.
      await readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);

      // Allow Vue to process reactive updates if status changes
      await nextTick(); 
      
      expect(status.value.reading).toBe(false);
      // Check for the log message from the main readNFC's catch block
      expect(mockConsoleLog).toHaveBeenCalledWith("Scan aborted by user or timeout.");
    });

    it('ndef.scan() throws NotSupportedError: alerts, sets reading false', async () => {
      const notSupportedError = new DOMException('WebNFC is not supported.', 'NotSupportedError');

      MockNDEFReaderConstructor.mockImplementationOnce(() => {
        const specificMockInstance = {
          scan: vi.fn().mockImplementationOnce(async () => {
            await Promise.resolve(); // Ensure async behavior for throwing
            throw notSupportedError;
          }),
          write: vi.fn(() => Promise.resolve()), // Default write
          onreading: null,
          onreadingerror: null,
        };
        // Update the global mockNdefReaderInstance reference. This is important if
        // any part of the test or beforeEach/afterEach cleanup logic relies on it,
        // though for this specific instance, it's primarily about what readNFC gets.
        mockNdefReaderInstance = specificMockInstance;
        return specificMockInstance;
      });

      await readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);

      // await Promise.resolve(); // Replace with nextTick for Vue reactivity
      await nextTick();
      
      expect(mockAlert).toHaveBeenCalledWith("WebNFC is not supported on this device/browser.");
      expect(status.value.reading).toBe(false);
    });

    it('ndef.scan() throws other error: alerts message, sets reading false', async () => {
      const otherError = new Error('Some other scan error');

      MockNDEFReaderConstructor.mockImplementationOnce(() => {
        const specificMockInstance = {
          scan: vi.fn().mockImplementationOnce(async () => {
            await Promise.resolve(); // Ensure async behavior for throwing
            throw otherError;
          }),
          write: vi.fn(() => Promise.resolve()), // Default write
          onreading: null,
          onreadingerror: null,
        };
        mockNdefReaderInstance = specificMockInstance;
        return specificMockInstance;
      });

      await readNFC(status, scannedTag, continuousScan, scanAbortControllerRef);

      await nextTick(); // Use nextTick for Vue reactivity
      
      expect(mockAlert).toHaveBeenCalledWith(`Error initiating scan: ${otherError.message}`);
      expect(status.value.reading).toBe(false);
    });
  });

  describe('writeNFC', () => {
    let mockEstimateSizeSpy: SpyInstance<Parameters<typeof nfcUtils.estimateNdefMessageSize>, ReturnType<typeof nfcUtils.estimateNdefMessageSize>>;

    beforeEach(() => {
        mockEstimateSizeSpy = vi.spyOn(nfcUtils, 'estimateNdefMessageSize').mockReturnValue(10);
    });
    afterEach(() => {
        mockEstimateSizeSpy.mockRestore();
    });

    it('should return early if no records are provided', async () => {
      await writeNFC([], status);
      expect(MockNDEFReaderConstructor).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith("No records to write.");
    });

    it('successful write: sets writing status, calls ndef.write', async () => {
      const textEncoder = new TextEncoder();
      const recordsToPass: NDEFRecord[] = [
        { recordType: 'text', data: new DataView(textEncoder.encode("hello").buffer), encoding: 'utf-8', lang: 'en', id: null, mediaType: null, toJSON: () => ({recordType: 'text'}) } as unknown as NDEFRecord,
      ];
      
      await writeNFC(recordsToPass, status);

      expect(status.value.writing).toBe(false); 
      expect(MockNDEFReaderConstructor).toHaveBeenCalledTimes(1);
      expect(mockNdefReaderInstance.write).toHaveBeenCalled();
      expect(mockAlert).not.toHaveBeenCalled(); 
    });

    it('should call alert for medium data size warning', async () => {
      mockEstimateSizeSpy.mockReturnValue(200); 
      const records = [{ recordType: 'text', data: new DataView(new TextEncoder().encode("test").buffer) } as unknown as NDEFRecord];
      await writeNFC(records, status);
      expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining("may not fit on very small NFC tags"));
    });

    it('should call alert for large data size warning', async () => {
      mockEstimateSizeSpy.mockReturnValue(600);
      const records = [{ recordType: 'text', data: new DataView(new TextEncoder().encode("test").buffer) } as unknown as NDEFRecord];
      await writeNFC(records, status);
      expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining("is large and may not fit on smaller NFC tags"));
    });

    it('ndef.write() throws error: alerts, sets writing false', async () => {
      const writeError = new Error('Failed to write tag');

      MockNDEFReaderConstructor.mockImplementationOnce(() => {
        const specificMockInstance = {
          scan: vi.fn(() => Promise.resolve()), // Default scan
          write: vi.fn().mockImplementationOnce(async () => {
            await Promise.resolve(); // Ensure async behavior for throwing
            throw writeError;
          }),
          onreading: null,
          onreadingerror: null,
        };
        mockNdefReaderInstance = specificMockInstance;
        return specificMockInstance;
      });

      const records = [{ recordType: 'text', data: new DataView(new TextEncoder().encode("test").buffer) } as unknown as NDEFRecord];
      await writeNFC(records, status);

      await nextTick(); // Use nextTick for Vue reactivity
      
      expect(mockAlert).toHaveBeenCalledWith(`Error writing tag: ${writeError.message}`);
      expect(status.value.writing).toBe(false);
    });

    it('should correctly map various record types for writing', async () => {
        const textEncoder = new TextEncoder();
        const records: NDEFRecord[] = [
            { recordType: 'text', data: new DataView(textEncoder.encode("Test").buffer), encoding: 'utf-8', lang: 'en', id: '1' } as unknown as NDEFRecord,
            { recordType: 'url', data: new DataView(textEncoder.encode("https://a.b").buffer), mediaType: 'text/uri' } as unknown as NDEFRecord,
            { recordType: 'mime', mediaType: 'image/jpeg', data: new DataView(new ArrayBuffer(10)) } as unknown as NDEFRecord,
            { recordType: 'empty', data: null } as unknown as NDEFRecord, // data is null for empty after reading
            { recordType: 'absolute-url', data: new DataView(textEncoder.encode("tel:123").buffer) } as unknown as NDEFRecord,
            { recordType: 'smart-poster', _smartPosterData: { records: [{recordType: 'url', data: 'http://sp.com'}]} , data: null } as any,
        ];

        const expectedMapped = [
            { recordType: 'text', data: "Test", encoding: 'utf-8', lang: 'en', id: '1'},
            { recordType: 'url', data: "https://a.b", mediaType: 'text/uri'}, 
            { recordType: 'mime', mediaType: 'image/jpeg', data: expect.any(ArrayBuffer) },
            { recordType: 'empty', data: undefined }, // MODIFIED
            { recordType: 'absolute-url', data: "tel:123" },
            { recordType: 'smart-poster', data: { records: [{recordType: 'url', data: 'http://sp.com'}]} }, // MODIFIED
        ];
        
        await writeNFC(records, status);
        // await Promise.resolve(); // Consider adding if other tests needed it, but let's try without first for this one.
        
        expect(mockNdefReaderInstance.write).toHaveBeenCalledWith({ records: expectedMapped.map(r => expect.objectContaining(r)) });

        // ADDED: Check the byteLength of the ArrayBuffer for the mime record
        const writtenArg = mockNdefReaderInstance.write.mock.calls[0][0];
        const mimeRecordInData = writtenArg.records.find((r: any) => r.recordType === 'mime');
        expect(mimeRecordInData).toBeDefined();
        if (mimeRecordInData) {
            expect((mimeRecordInData.data as ArrayBuffer).byteLength).toBe(10);
        }
    });
  });

  describe('cancelScan', () => {
    it('should call abort on active scan controller', () => {
      scanAbortControllerRef.value = MockAbortControllerConstructor(); 
      if (scanAbortControllerRef.value?.signal) { 
        (scanAbortControllerRef.value.signal as any).aborted = false; 
      }

      cancelScan(scanAbortControllerRef);
      
      expect(mockAbortControllerInstance.abort).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith("Scan manually cancelled.");
    });

    it('should not call abort if scanAbortController is null', () => {
      scanAbortControllerRef.value = null;
      cancelScan(scanAbortControllerRef);
      expect(mockAbortControllerInstance?.abort).not.toHaveBeenCalled(); 
    });

    it('should not call abort if scan is already aborted', () => {
      scanAbortControllerRef.value = MockAbortControllerConstructor();
      if (scanAbortControllerRef.value?.signal) { 
         (scanAbortControllerRef.value.signal as any).aborted = true; 
      }

      cancelScan(scanAbortControllerRef);
      expect(mockAbortControllerInstance.abort).not.toHaveBeenCalled();
    });
  });
});
