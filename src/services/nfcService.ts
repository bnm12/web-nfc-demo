// src/services/nfcService.ts
/*global NDEFReader, NDEFRecord, NDEFMessageInit*/ // NDEFRecord is for type hint, NDEFMessageInit for smart poster
import type { Ref } from 'vue';
import type { NFCStatus, ScannedTag } from '../@types/app'; // NDEFRecordInitCustom is not directly used here
import { estimateNdefMessageSize } from '../utils/nfcUtils';

// Assume alert is globally available or handled by a global notification system.
declare function alert(message?: any): void;

export async function readNFC(
  status: Ref<NFCStatus>,
  scannedTag: Ref<ScannedTag>,
  continuousScan: Ref<boolean>,
  scanAbortController: Ref<AbortController | null>
): Promise<void> {
  if (status.value.reading) {
    console.log("Scan already in progress.");
    return;
  }

  const ndef = new NDEFReader(); // global NDEFReader
  scanAbortController.value = new AbortController();

  scanAbortController.value.signal.onabort = () => {
    console.log("Scan aborted via AbortSignal.");
    status.value.reading = false;
    // Clean up listeners
    ndef.onreading = () => {}; // Use arrow functions or .bind for proper 'this' if needed, though not an issue here.
    ndef.onreadingerror = () => {};
  };

  try {
    status.value.reading = true;
    console.log(`Starting NFC scan (Continuous: ${continuousScan.value})`);

    ndef.onreading = (event: any) => { // `event` is an NDEFReadingEvent
      if (status.value.writing) {
        console.log("Write operation in progress, ignoring read event.");
        return;
      }
      console.log("NFC tag read:", event);
      scannedTag.value.uuid = event.serialNumber;
      scannedTag.value.records = []; // Clear previous records
      scannedTag.value.records.push(...event.message.records); // event.message is NDEFMessage

      if (!continuousScan.value) {
        console.log("Single scan complete, stopping reader.");
        status.value.reading = false;
        ndef.onreading = () => {};
        ndef.onreadingerror = () => {};
        if (scanAbortController.value && !scanAbortController.value.signal.aborted) {
          scanAbortController.value.abort(); 
        }
      }
    };

    ndef.onreadingerror = (event: any) => { // `event` is an Event, but often has a message
      console.warn("NDEF reading error observed:", event);
      if (scanAbortController.value?.signal.aborted) {
        console.log("Reading error due to scan abortion.");
      } else {
        console.error("NDEF reading error:", event);
      }
      if (status.value.reading) { // Check if it was reading to avoid setting false if already stopped.
        status.value.reading = false;
      }
      // Deregister handlers to prevent future calls if the reader instance is reused (though typically it's not)
      ndef.onreading = () => {};
      ndef.onreadingerror = () => {};
    };

    await ndef.scan({ signal: scanAbortController.value.signal });
    console.log("NDEFReader scan() method resolved. Listening for tags...");

  } catch (error) {
    console.error("NFC Read Operation Error:", error);
    if ((error as DOMException).name === 'AbortError') {
      console.log("Scan aborted by user or timeout.");
    } else if ((error as DOMException).name === 'NotSupportedError') {
        alert("WebNFC is not supported on this device/browser.");
    } else {
      alert(`Error initiating scan: ${(error as Error).message}`);
    }
    status.value.reading = false; 
    // Ensure listeners are cleaned up on error too
    ndef.onreading = () => {};
    ndef.onreadingerror = () => {};
  }
}

export async function writeNFC(
  records: NDEFRecord[], // Array of actual NDEFRecord instances
  status: Ref<NFCStatus>
): Promise<void> {
  if (!records.length) {
    console.log("No records to write.");
    return;
  }
  const ndef = new NDEFReader();

  // Convert NDEFRecord instances to NDEFRecordInit for writing
  const recsToWrite: NDEFRecordInit[] = records.map((rec: NDEFRecord) => {
    const obj: NDEFRecordInit = { recordType: rec.recordType };

    if (rec.id) obj.id = rec.id;
    if (rec.mediaType) obj.mediaType = rec.mediaType;
    if (rec.encoding) obj.encoding = rec.encoding;
    if (rec.lang) obj.lang = rec.lang;

    if (rec.recordType === "smart-poster") {
      // For smart posters, data for NDEFRecordInit should be NDEFMessageInit
      // This custom _smartPosterData property was attached in handleAddRecord
      obj.data = (rec as any)._smartPosterData as NDEFMessageInit; 
      // Encoding/lang are not top-level for smart-poster NDEFRecordInit itself
      delete obj.encoding;
      delete obj.lang;
    } else if (rec.recordType === "empty") {
      delete obj.mediaType;
      delete obj.encoding;
      delete obj.lang;
      obj.data = undefined; // Explicitly undefined for empty
    } else if (rec.data) { // rec.data is DataView
      // For 'text', 'url', 'absolute-url', NDEFRecordInit expects string data.
      // For 'mime', 'unknown', 'external', it can be string or ArrayBuffer.
      // The NDEFRecord constructor handles string to ArrayBuffer conversion.
      // Here, we need to decide if we pass string or ArrayBuffer based on original intent.
      if (rec.encoding && (rec.recordType === 'text' || rec.mediaType?.startsWith('text/'))) {
        const decoder = new TextDecoder(rec.encoding || "utf-8");
        obj.data = decoder.decode(rec.data); // Convert DataView back to string
      } else if (rec.recordType === 'url' || rec.recordType === 'absolute-url') {
        const decoder = new TextDecoder("utf-8"); // URLs are typically UTF-8
        obj.data = decoder.decode(rec.data);
      } else {
        // For 'mime', 'unknown', 'external' that are not text-based, pass ArrayBuffer
        obj.data = rec.data.buffer.slice(rec.data.byteOffset, rec.data.byteOffset + rec.data.byteLength);
      }
    } else {
      obj.data = undefined; // No data payload
    }
    return obj;
  });

  const estimatedSize = estimateNdefMessageSize(recsToWrite);
  const SMALL_TAG_CAPACITY = 140; // Example NTAG213 capacity
  const MEDIUM_TAG_CAPACITY = 500; // Example NTAG215/NTAG216 might be around here or more

  console.log(`Estimated NDEF message size: ${estimatedSize} bytes`);

  if (estimatedSize > MEDIUM_TAG_CAPACITY) {
    alert(`Warning: The data size (~${estimatedSize} bytes) is large and may not fit on smaller NFC tags. It might only work on tags with >500 bytes capacity.`);
  } else if (estimatedSize > SMALL_TAG_CAPACITY) {
    alert(`Warning: The data size (~${estimatedSize} bytes) may not fit on very small NFC tags (like NTAG213, ~144 bytes). Ensure your tag has enough capacity.`);
  }

  console.log("Records to write (NDEFRecordInit format):", recsToWrite);
  status.value.writing = true;
  try {
    await ndef.write({ records: recsToWrite }); // NDEFMessageInit takes 'records'
    console.log("NFC tag written successfully.");
  } catch (err) {
    console.error("Error writing NDEF message:", err);
    alert(`Error writing tag: ${(err as Error).message}`);
  }
  status.value.writing = false;
}

export function cancelScan(scanAbortController: Ref<AbortController | null>): void {
  if (scanAbortController.value && !scanAbortController.value.signal.aborted) {
    scanAbortController.value.abort();
    console.log("Scan manually cancelled.");
  }
}

// Add this new function in src/services/nfcService.ts
// (Keep the original readNFC function as is)
// import type { Ref } from 'vue'; // Ensure Ref is imported if not already at top level of imports
// import type { NFCStatus } from '../@types/app'; // Ensure NFCStatus is imported
// NDEFReader will be the globally stubbed one.

export async function readNFC_simplified_diagnostic(
  status: Ref<NFCStatus>
): Promise<void> {
  // @ts-ignore
  const ndef = new NDEFReader(); // Uses the global mock setup in tests

  try {
    status.value.reading = true;
    // console.log('[DIAG] Simplified: Set status.reading = true');

    // Use a minimal signal for the ndef.scan() call, as it expects one.
    // The global AbortController is mocked, so this uses the mock.
    // @ts-ignore
    const diagnosticAbortController = new AbortController(); 
    
    await ndef.scan({ signal: diagnosticAbortController.signal }); // This line will be mocked to throw in the test

    // console.log('[DIAG] Simplified: ndef.scan supposedly completed (should not be reached in error test)');
  } catch (error:any) { // Use any for error type for simplicity in diagnostic
    // console.error('[DIAG] Simplified: In catch block, error name:', error?.name);
    // if (error?.name === 'AbortError') {
    //   console.log('[DIAG] Simplified: AbortError caught');
    // } else {
    //   console.log('[DIAG] Simplified: Other error caught');
    // }
    status.value.reading = false;
    // console.log('[DIAG] Simplified: Set status.reading = false');
  }
  // console.log('[DIAG] Simplified: Exiting function, status.reading is', status.value.reading);
}
