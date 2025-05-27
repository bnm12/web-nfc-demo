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
    ndef.onreading = () => {};
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
      if (status.value.reading) { 
        status.value.reading = false;
      }
      ndef.onreading = () => {};
      ndef.onreadingerror = () => {};
    };

    await ndef.scan({ signal: scanAbortController.value.signal });
    console.log("NDEFReader scan() method resolved. Listening for tags...");

  } catch (error) {
    console.error("NFC Read Operation Error:", error);
    status.value.reading = false; // Set status reliably
    ndef.onreading = () => {};     // Clean up listeners
    ndef.onreadingerror = () => {};

    if ((error as DOMException).name === 'AbortError') {
      console.log("Scan aborted by user or timeout."); // Log this event
      // For AbortError, we explicitly DO NOT re-throw, allowing readNFC to resolve.
      scanAbortController.value = null; // Align with test expectation
    } else {
      // For other errors, alert and then re-throw.
      if ((error as DOMException).name === 'NotSupportedError') {
        alert("WebNFC is not supported on this device/browser.");
      } else {
        alert(`Error initiating scan: ${(error as Error).message}`);
      }
      throw error; // Re-throw other errors
    }
  }
}

export async function writeNFC(
  records: NDEFRecord[], 
  status: Ref<NFCStatus>
): Promise<void> {
  if (!records.length) {
    console.log("No records to write.");
    return;
  }
  const ndef = new NDEFReader();

  const recsToWrite: NDEFRecordInit[] = records.map((rec: NDEFRecord) => {
    const obj: NDEFRecordInit = { recordType: rec.recordType };
    if (rec.id) obj.id = rec.id;
    if (rec.mediaType) obj.mediaType = rec.mediaType;
    if (rec.encoding) obj.encoding = rec.encoding;
    if (rec.lang) obj.lang = rec.lang;

    if (rec.recordType === "smart-poster") {
      obj.data = (rec as any)._smartPosterData as NDEFMessageInit; 
      delete obj.encoding;
      delete obj.lang;
    } else if (rec.recordType === "empty") {
      delete obj.mediaType;
      delete obj.encoding;
      delete obj.lang;
      obj.data = undefined; 
    } else if (rec.data) { 
      if (rec.encoding && (rec.recordType === 'text' || rec.mediaType?.startsWith('text/'))) {
        const decoder = new TextDecoder(rec.encoding || "utf-8");
        obj.data = decoder.decode(rec.data);
      } else if (rec.recordType === 'url' || rec.recordType === 'absolute-url') {
        const decoder = new TextDecoder("utf-8"); 
        obj.data = decoder.decode(rec.data);
      } else {
        obj.data = rec.data.buffer.slice(rec.data.byteOffset, rec.data.byteOffset + rec.data.byteLength);
      }
    } else {
      obj.data = undefined; 
    }
    return obj;
  });

  const estimatedSize = estimateNdefMessageSize(recsToWrite);
  const SMALL_TAG_CAPACITY = 140; 
  const MEDIUM_TAG_CAPACITY = 500;

  console.log(`Estimated NDEF message size: ${estimatedSize} bytes`);
  if (estimatedSize > MEDIUM_TAG_CAPACITY) {
    alert(`Warning: The data size (~${estimatedSize} bytes) is large and may not fit on smaller NFC tags. It might only work on tags with >500 bytes capacity.`);
  } else if (estimatedSize > SMALL_TAG_CAPACITY) {
    alert(`Warning: The data size (~${estimatedSize} bytes) may not fit on very small NFC tags (like NTAG213, ~144 bytes). Ensure your tag has enough capacity.`);
  }

  console.log("Records to write (NDEFRecordInit format):", recsToWrite);
  status.value.writing = true;
  try {
    await ndef.write({ records: recsToWrite }); 
    console.log("NFC tag written successfully.");
    status.value.writing = false; // Set false on success
  } catch (err) {
    console.error("Error writing NDEF message:", err);
    alert(`Error writing tag: ${(err as Error).message}`);
    status.value.writing = false; 
    throw err; // Re-throw the error
  }
}

export function cancelScan(scanAbortController: Ref<AbortController | null>): void {
  if (scanAbortController.value && !scanAbortController.value.signal.aborted) {
    scanAbortController.value.abort();
    console.log("Scan manually cancelled.");
  }
}
