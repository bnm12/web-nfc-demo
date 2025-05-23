<script setup lang="ts">
/*global NDEFReader*/
/*global NDEFRecord*/
/*global NDEFRecordInit*/
/*global TextEncoder*/ // Added for handleAddRecord

import NDEFRecordVue from "./components/NDEFRecord.vue";
import AddRecordForm from "./components/AddRecordForm.vue"; // Import AddRecordForm
import SpinnerIcon from "./assets/SpinnerIcon.vue";
import PauseIcon from "./assets/PauseIcon.vue";

import { ref } from "vue";

const scanAbortController = ref<AbortController | null>(null);
const continuousScan = ref(true); // Default to continuous scanning

// Updated interface based on expected form output from AddRecordForm.vue
interface NDEFRecordInitCustom {
  recordType: string; // Can be standard or external like "example.com:mytype"
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: string | ArrayBuffer | NDEFMessageInit; // Data from form
}

const scannedTag = ref({ uuid: "", records: [] as NDEFRecord[] });
const status = ref({ writing: false, reading: false });
const showAddForm = ref(false); // For toggling AddRecordForm visibility

async function readNFC() {
  if (status.value.reading) {
    console.log("Scan already in progress.");
    return;
  }

  const ndef = new NDEFReader();
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

    ndef.onreading = (event) => {
      if (status.value.writing) {
        console.log("Write operation in progress, ignoring read event.");
        return;
      }
      console.log("NFC tag read:", event);
      scannedTag.value.uuid = event.serialNumber;
      scannedTag.value.records = []; // Clear previous records
      scannedTag.value.records.push(...event.message.records);

      if (!continuousScan.value) {
        console.log("Single scan complete, stopping reader.");
        status.value.reading = false;
        ndef.onreading = () => {};
        ndef.onreadingerror = () => {};
        if (scanAbortController.value && !scanAbortController.value.signal.aborted) {
          scanAbortController.value.abort(); // Abort to stop the scan
        }
      }
    };

    ndef.onreadingerror = (event) => {
      // Log the error event object for more details
      console.warn("NDEF reading error observed:", event);
      // Check if the error is due to an explicit abort or another reason
      if (scanAbortController.value?.signal.aborted) {
        console.log("Reading error due to scan abortion.");
      } else {
        console.error("NDEF reading error:", event);
        // alert(`Error reading tag: ${event.message || 'Unknown error'}`); // Avoid alert for now
      }
      if (status.value.reading) {
        status.value.reading = false;
      }
      ndef.onreading = () => {};
      ndef.onreadingerror = () => {};
    };

    await ndef.scan({ signal: scanAbortController.value.signal });
    console.log("NDEFReader scan() method resolved. Listening for tags...");
    // If continuousScan is true, status.reading remains true.
    // If continuousScan is false, onreading handler sets status.reading to false and aborts.
    // If scan is aborted before any reading, the catch block handles it.

  } catch (error) {
    console.error("NFC Read Operation Error:", error);
    if ((error as DOMException).name === 'AbortError') {
      console.log("Scan aborted by user or timeout.");
      // Status.reading is already set by the signal's onabort handler or single scan logic.
    } else if ((error as DOMException).name === 'NotSupportedError') {
        alert("WebNFC is not supported on this device/browser.");
    } else {
      alert(`Error initiating scan: ${(error as Error).message}`);
    }
    status.value.reading = false; // Ensure reading is false on any error/abort
    // Clean up listeners in case of an error during scan() call itself
    ndef.onreading = () => {};
    ndef.onreadingerror = () => {};
  }
}

async function writeNFC(records: NDEFRecord[]) {
  if (!records.length) return;
  const ndef = new NDEFReader();

  // Prepare records for writing and estimation
  const recs: NDEFRecordInit[] = records.map((rec: NDEFRecord) => {
    const obj: NDEFRecordInit = { recordType: rec.recordType };

    if (rec.id) obj.id = rec.id;
    if (rec.mediaType) obj.mediaType = rec.mediaType; // For 'mime' or some 'external' types

    // Encoding and lang are relevant for 'text', or text-based 'mime', 'external', 'unknown'
    // They are part of NDEFRecordInit for these cases.
    // For smart poster, they are on inner records. For URL types, not applicable.
    if (rec.encoding) obj.encoding = rec.encoding;
    if (rec.lang) obj.lang = rec.lang;


    if (rec.recordType === "smart-poster") {
      obj.data = (rec as any)._smartPosterData; // This is NDEFMessageInit
      // Encoding/lang are not top-level for smart-poster NDEFRecordInit itself
      delete obj.encoding;
      delete obj.lang;
    } else if (rec.recordType === "empty") {
      // No data, no mediaType (unless explicitly set, but unusual), no encoding, no lang
      delete obj.mediaType; // usually null/undefined for empty
      delete obj.encoding;
      delete obj.lang;
      obj.data = undefined;
    } else if (rec.data) { // rec.data is DataView for standard record types after reading/construction
      const dataView = rec.data;
      // Determine if data should be string or ArrayBuffer for NDEFRecordInit
      // This depends on the record type and how it was initially constructed or if it was read.
      // Standard record types like 'text', 'url', 'absolute-url' expect string data.
      // 'mime', 'unknown', and potentially 'external' often use ArrayBuffer,
      // but can use string if they are text-based.

      // Heuristic: if encoding or lang is present, it's likely text.
      // NDEFRecord spec: 'text' data is string. 'url' data is string.
      // 'mime' can be string or ArrayBuffer. 'unknown' ArrayBuffer. 'external' ArrayBuffer.
      // However, our form allows text input for mime/unknown/external.

      // If an encoding is specified on the NDEFRecord object, it's likely text-based.
      if (rec.encoding && (rec.recordType === 'text' || rec.recordType === 'url' || rec.recordType === 'absolute-url' || rec.mediaType?.startsWith('text/') || obj.recordType.startsWith('text/'))) {
        const decoder = new TextDecoder(rec.encoding || "utf-8");
        obj.data = decoder.decode(dataView);
      } else if (rec.recordType === 'text' || rec.recordType === 'url' || rec.recordType === 'absolute-url') {
        // Default to decoding as text for these types if no specific encoding mentioned (should have been utf-8)
        const decoder = new TextDecoder(rec.encoding || "utf-8");
        obj.data = decoder.decode(dataView);
      }
      else {
        // For 'mime', 'unknown', 'external', default to ArrayBuffer if not clearly text.
        // The NDEFRecord constructor would have taken string and converted to ArrayBuffer with UTF-8 if no encoding specified.
        // If it was from a file, it's already ArrayBuffer.
        // rec.data (DataView) directly provides arrayBuffer.
        obj.data = dataView.buffer;
      }
    } else {
      // No rec.data (e.g. could be an empty text record if data was empty string)
      // For most types, if data is undefined/null, it means an empty payload.
      // NDEFRecordInit allows data to be undefined.
      obj.data = undefined; 
    }
    return obj;
  });

  // Estimate size *after* records are in NDEFRecordInit format
  const estimatedSize = estimateNdefMessageSize(recs);
  const SMALL_TAG_CAPACITY = 140;
  const MEDIUM_TAG_CAPACITY = 500;

  console.log(`Estimated NDEF message size: ${estimatedSize} bytes`);

  if (estimatedSize > MEDIUM_TAG_CAPACITY) {
    alert(`Warning: The data size (~${estimatedSize} bytes) is large and may not fit on smaller NFC tags. It might only work on tags with >500 bytes capacity.`);
  } else if (estimatedSize > SMALL_TAG_CAPACITY) {
    alert(`Warning: The data size (~${estimatedSize} bytes) may not fit on very small NFC tags (like NTAG213, ~144 bytes). Ensure your tag has enough capacity.`);
  }

  console.log("Records to write:", recs);
  status.value.writing = true;
  try {
    await ndef.write({ records: recs }); // NDEFMessageInit uses 'records'
  } catch (err) {
    console.error("Error writing NDEF message:", err, arguments);
    alert(`Error writing tag: ${(err as Error).message}`);
  }
  status.value.writing = false;
}

// Helper function
function isNDEFRecordTypeExternal(recordType: string): boolean {
  // Basic check: external types are domain-name based, containing a colon.
  // Standard types like 'text', 'url', 'mime', 'smart-poster', 'absolute-url', 'empty', 'unknown' do not.
  if (!recordType) return false;
  return !["text", "url", "mime", "smart-poster", "absolute-url", "empty", "unknown"].includes(recordType) && recordType.includes(':');
}

function estimateNdefMessageSize(records: NDEFRecordInit[], isRecursiveCall = false): number {
  let totalSize = 0;
  const textEncoder = new TextEncoder();

  records.forEach(record => {
    let recordSize = 1; // TNF/Flags byte

    // 2. Type Field Length Calculation (typeStringForCalc determines the TYPE field content)
    let typeStringForCalc = "";
    if (record.recordType === 'empty' || record.recordType === 'unknown') {
      typeStringForCalc = ""; // Type length is 0 for these according to NDEF spec
    } else if (record.recordType === 'absolute-url') {
      // For TNF_ABSOLUTE_URI, the Type field *is* the URI. NDEFRecordInit.data holds this URI.
      typeStringForCalc = (typeof record.data === 'string') ? record.data : "";
    } else if (record.recordType === 'mime' && record.mediaType) {
      typeStringForCalc = record.mediaType;
    } else if (isNDEFRecordTypeExternal(record.recordType)) {
      typeStringForCalc = record.recordType; // The full external name string
    } else if (record.recordType === 'text') {
      typeStringForCalc = "T"; // Short NDEF representation
    } else if (record.recordType === 'url') {
      typeStringForCalc = "U"; // Short NDEF representation
    } else if (record.recordType === 'smart-poster') {
      typeStringForCalc = "Sp"; // Short NDEF representation
    } else {
      console.warn("estimateNdefMessageSize: Unhandled recordType for typeStringForCalc:", record.recordType);
      // Fallback to record.recordType if it's some other non-external, non-well-known type not listed
      // This path should ideally not be taken if all types are handled.
      typeStringForCalc = record.recordType; 
    }
    
    const typeFieldLength = textEncoder.encode(typeStringForCalc).length;

    if (record.recordType === 'empty') { 
      // TNF_EMPTY (0x00) has no type length, no payload length, no ID
      // The TNF/Flags byte (recordSize=1) is the only part.
      totalSize += recordSize; 
      return; // Skips further processing for this record
    }

    recordSize += 1; // Type Length byte
    recordSize += typeFieldLength; // Actual bytes for the type string

    // 1. Payload Calculation
    let payloadByteLength = 0;
    if (record.recordType === 'absolute-url') {
      payloadByteLength = 0; // Payload is considered part of the type field for TNF_ABSOLUTE_URI
    } else if (record.recordType === 'text') {
      // NDEF text record payload: status byte (1) + language code string (UTF-8) + text data (UTF-8/UTF-16)
      let textDataLength = 0;
      if (typeof record.data === 'string') {
        // Encoding for size calculation should match NDEFRecord constructor behavior
        // If record.encoding is utf-16, it's more complex. Assuming utf-8 for simplicity here as per NDEFRecordInit.
        textDataLength = textEncoder.encode(record.data).length; 
      }
      const langCode = record.lang || "en"; // Default to "en" if not specified
      const langCodeByteLength = textEncoder.encode(langCode).length;
      payloadByteLength = 1 + langCodeByteLength + textDataLength; // status byte + lang code + text data
    } else if (record.recordType === 'smart-poster' && record.data && typeof record.data === 'object' && 'records' in record.data) {
      // Data for smart-poster is NDEFMessageInit, payload is the sum of its records.
      payloadByteLength = estimateNdefMessageSize((record.data as NDEFMessageInit).records, true);
    } else if (record.recordType !== 'empty' && record.data) { 
      // For other types like mime, url (non-absolute), external, unknown (if data is present)
      if (typeof record.data === 'string') {
        payloadByteLength = textEncoder.encode(record.data).length;
      } else if (record.data instanceof ArrayBuffer) {
        payloadByteLength = record.data.byteLength;
      }
    }
    // For 'empty', payloadByteLength remains 0 (already handled by early return).
    
    // Payload Length field size (1 byte for Short Record, 4 bytes otherwise)
    recordSize += (payloadByteLength < 256) ? 1 : 4;

    // ID Length field and ID (if present)
    if (record.id) {
      recordSize += 1; // ID Length byte (field is present if IL flag in TNF is set)
      recordSize += textEncoder.encode(record.id).length; // Actual ID bytes
    }
    
    recordSize += payloadByteLength; // Add the calculated payload size
    totalSize += recordSize;
  });

  return totalSize;
}

function decodeRecord(record: NDEFRecord) {
  // This is used for displaying scanned records, not for preparing write data.
  if (!record.data) return "No data in record";
  const decoder = new TextDecoder(record.encoding ?? "utf-8");
  return decoder.decode(record.data.buffer); // Ensure .buffer is accessed if data is DataView
}

function handleAddRecord(recordInit: NDEFRecordInitCustom) {
  console.log("Record init received from form:", recordInit);

  // The recordInit.recordType might be an external type string like "example.com:mytype"
  // or a standard NDEFRecordType like "text", "url", "smart-poster", etc.
  const payload: NDEFRecordInit = {
    recordType: recordInit.recordType, // This is now a string, correctly handled by NDEFRecord constructor
  };

  // Assign common properties if they exist
  if (recordInit.id) payload.id = recordInit.id;
  if (recordInit.mediaType) payload.mediaType = recordInit.mediaType; // Mostly for 'mime'

  // Handle encoding and lang based on the actual record type (standard or implied by data)
  // The AddRecordForm now prepares these more thoroughly.
  // For 'smart-poster', encoding/lang are part of its nested records, not the top-level record.
  // For 'empty', these are not applicable.
  // For 'external' or 'unknown', they are only applicable if data is string-based.
  if (recordInit.encoding) payload.encoding = recordInit.encoding;
  if (recordInit.lang) payload.lang = recordInit.lang;


  // Assign data. This can be string, ArrayBuffer, or NDEFMessageInit (for smart-poster)
  // The NDEFRecord constructor is designed to handle these different data source types.
  if (recordInit.data !== undefined) {
    payload.data = recordInit.data;
  } else if (recordInit.recordType === "empty") {
    // Ensure no data field for empty record, NDEFRecord constructor expects this.
    // payload.data should remain undefined.
  }


  console.log("Payload for NDEFRecord constructor:", payload);

  try {
    const newRecord = new NDEFRecord(payload);
    if (payload.recordType === "smart-poster" && payload.data) {
      // Attach the original NDEFMessageInit for smart poster data, as newRecord.data will be null
      (newRecord as any)._smartPosterData = payload.data;
    }
    scannedTag.value.records.push(newRecord);
    console.log("Record added. New records list:", scannedTag.value.records);
  } catch (error) {
    console.error("Error creating NDEFRecord:", error, payload);
    // Optionally, inform the user about the error
    alert(`Error adding record: ${(error as Error).message}`);
  }

  showAddForm.value = false; // Hide form after adding
}

const cancelScan = () => {
  if (scanAbortController.value && !scanAbortController.value.signal.aborted) {
    scanAbortController.value.abort();
    // status.value.reading is set to false by the abort handler now
    console.log("Scan manually cancelled.");
  }
};

function handleCancelAddRecord() {
  showAddForm.value = false;
}

function handleDeleteRecord(index: number) {
  if (index >= 0 && index < scannedTag.value.records.length) {
    scannedTag.value.records.splice(index, 1);
    console.log(`Record at index ${index} deleted.`);
  } else {
    console.warn(`Attempted to delete record at invalid index: ${index}`);
  }
}

</script>

<template>
  <div class="flex flex-col p-4 space-y-4 bg-gray-100 dark:bg-gray-900 min-h-screen">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">NFC Tag Editor</h1>
    </header>

    <div class="controls-section flex flex-col sm:flex-row gap-2 mb-4">
      <button
        @click="readNFC"
        :disabled="status.reading"
        :class="[
          'w-full sm:w-auto flex-1 text-white font-bold py-2 px-4 rounded-md shadow-sm flex items-center justify-center transition-colors duration-150',
          status.reading && !status.writing ? 'bg-blue-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-700',
          status.reading ? 'disabled:bg-blue-400 dark:disabled:bg-blue-700' : 'disabled:bg-gray-400 dark:disabled:bg-gray-600'
        ]"
        title="Scan for nearby NFC tags"
      >
        <SpinnerIcon
          v-if="status.reading && !status.writing"
          class="w-5 h-5 mr-2 text-gray-200 animate-spin dark:text-gray-100 fill-white"
        />
        <PauseIcon
          v-if="status.reading && status.writing"
          class="w-5 h-5 mr-2 text-gray-200 dark:text-gray-100 fill-gray-700 dark:fill-gray-300"
        />
        {{ status.reading ? (continuousScan ? 'Scanning (continuous)...' : 'Scanning (once)...') : 'Scan Tag' }}
      </button>
      <button
        @click="cancelScan"
        v-if="status.reading && !status.writing"
        class="w-full sm:w-auto flex-1 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md shadow-sm flex items-center justify-center transition-colors duration-150"
        title="Cancel the ongoing NFC scan"
      >
        Cancel Scan
      </button>
      <button
        @click="writeNFC(scannedTag.records)"
        :disabled="!scannedTag.records.length || status.writing || status.reading"
        :class="[
          'w-full sm:w-auto flex-1 text-white font-bold py-2 px-4 rounded-md shadow-sm flex items-center justify-center transition-colors duration-150',
          status.writing ? 'bg-green-600 animate-pulse' : 'bg-green-500 hover:bg-green-700',
          status.writing ? 'disabled:bg-green-400 dark:disabled:bg-green-700' : 'disabled:bg-gray-400 dark:disabled:bg-gray-600'
        ]"
        :title="!scannedTag.records.length ? 'Add records first before writing' : 'Write the current list of records to an NFC tag'"
      >
        <SpinnerIcon
          v-if="status.writing"
          class="w-5 h-5 mr-2 text-gray-200 animate-spin dark:text-gray-100 fill-white"
        />
        {{ status.writing ? 'Writing...' : 'Write to Tag' }}
      </button>
    </div>

    <!-- Global Status Indicator -->
    <div v-if="status.reading && !status.writing" class="p-4 mb-4 text-center text-blue-700 bg-blue-100 dark:bg-blue-700 dark:text-blue-100 rounded-lg shadow-md flex items-center justify-center">
      <SpinnerIcon class="w-6 h-6 mr-3 animate-spin fill-blue-500 dark:fill-blue-300" />
      <p class="font-semibold">Scanning for NFC Tag... Please tap a tag to your device.</p>
    </div>
    <div v-if="status.writing" class="p-4 mb-4 text-center text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100 rounded-lg shadow-md flex items-center justify-center">
      <SpinnerIcon class="w-6 h-6 mr-3 animate-pulse fill-green-500 dark:fill-green-300" />
      <p class="font-semibold">Writing to NFC Tag... Keep the tag in place.</p>
    </div>

    <div class="add-record-section mb-4">
      <button
        @click="showAddForm = !showAddForm"
        class="w-full bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md shadow-sm"
        :title="showAddForm ? 'Close the form for adding a new record' : 'Open form to add a new NDEF record'"
      >
        {{ showAddForm ? 'Cancel Adding Record' : 'Add New Record' }}
      </button>
      <AddRecordForm
        v-if="showAddForm"
        @add-record="handleAddRecord"
        @cancel="handleCancelAddRecord"
        class="mt-4 p-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg"
      />
    </div>

    <div class="controls-section flex items-center gap-2 mb-4">
      <input
        type="checkbox"
        id="continuousScanCheckbox"
        v-model="continuousScan"
        :disabled="status.reading"
        class="form-checkbox h-5 w-5 text-indigo-600 dark:text-indigo-400 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-indigo-300"
      />
      <label for="continuousScanCheckbox" class="text-sm font-medium text-gray-700 dark:text-gray-300">Continuous Scanning</label>
    </div>
    
    <div v-if="scannedTag.uuid || scannedTag.records.length > 0" class="records-display bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
      <h3
        v-if="scannedTag.uuid"
        class="text-black dark:text-white text-lg mb-4 text-center font-semibold"
      >
        <span title="Unique Identifier of the scanned NFC tag">Tag UID:</span> <span class="font-mono">{{ scannedTag.uuid.toUpperCase() }}</span>
      </h3>
      
      <div v-if="scannedTag.records.length === 0 && !showAddForm" class="text-center text-gray-500 dark:text-gray-400 py-4">
        <p>No records on this tag, or no records added yet.</p>
        <p>Click "Add New Record" to create one.</p>
      </div>

      <div class="space-y-3">
        <NDEFRecordVue
          v-for="(record, index) in scannedTag.records"
          :key="index" 
          :record="record"
          @delete-record="handleDeleteRecord(index)"
          class="mb-1 border border-gray-200 dark:border-gray-700 rounded-md"
        />
      </div>
    </div>
    <div v-else-if="!status.reading && !status.writing && !showAddForm" class="text-center text-gray-500 dark:text-gray-400 py-10">
        <p>Click "Scan Tag" to read an NFC tag, or "Add New Record" to start creating records.</p>
    </div>
    <!-- The specific message for scanning without results is now covered by the global status indicator -->

  </div>
</template>

<style>
/* Minimal global styles if needed, or rely purely on Tailwind */
body {
  font-family: 'Inter', sans-serif; /* Example: Using a common sans-serif font */
}
</style>
