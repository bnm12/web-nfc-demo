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

// Simplified interface based on expected form output
interface NDEFRecordInitCustom {
  recordType: "text" | "url" | "mime";
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: string | ArrayBuffer; // Data from form can be text or ArrayBuffer (for files)
}

const scannedTag = ref({ uuid: "", records: [] as NDEFRecord[] });
const status = ref({ writing: false, reading: false });
const showAddForm = ref(false); // For toggling AddRecordForm visibility

async function readNFC() {
  const ndef = new NDEFReader();
  await ndef.scan();
  ndef.onreading = (event) => {
    if (status.value.writing) return;
    console.log(event);
    scannedTag.value.uuid = event.serialNumber;
    scannedTag.value.records = [];
    scannedTag.value.records.push(...event.message.records);
  };
  status.value.reading = true;
}

async function writeNFC(records: NDEFRecord[]) {
  if (!records.length) return;
  const ndef = new NDEFReader();

  // Prepare records for writing and estimation
  const recs: NDEFRecordInit[] = records.map((rec) => {
    const obj = {} as NDEFRecordInit;
    obj.recordType = rec.recordType; // e.g., 'text', 'url', 'mime'

    if (rec.mediaType) obj.mediaType = rec.mediaType; // e.g., 'image/png', 'text/vcard'
    if (rec.id) obj.id = rec.id;
    // Encoding and lang are not directly part of NDEFRecordInit standard fields,
    // but are used for text records by the NDEFReader API.
    // Our internal NDEFRecord might carry them.
    if (rec.recordType === 'text') {
      if (rec.encoding) obj.encoding = rec.encoding;
      if (rec.lang) obj.lang = rec.lang;
    }

    let dataPayload: string | ArrayBuffer | undefined;
    if (rec.data) {
      // rec.data from scannedTag.records is always ArrayBuffer
      const dataBuffer = rec.data; // rec.data is ArrayBuffer
      if (rec.recordType === 'text' || rec.recordType === 'url') {
        const decoder = new TextDecoder(rec.encoding ?? "utf-8");
        dataPayload = decoder.decode(dataBuffer); // Convert to string for NDEFWriter
      } else if (rec.recordType === 'mime') {
        // For MIME types, NDEFWriter expects ArrayBuffer or other BufferSource
        dataPayload = dataBuffer;
      } else {
        // Fallback for unknown types - try to decode as text
        const decoder = new TextDecoder(rec.encoding ?? "utf-8");
        dataPayload = decoder.decode(dataBuffer);
      }
    }
    obj.data = dataPayload;
    return obj;
  });

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

function estimateNdefMessageSize(records: NDEFRecordInit[]): number {
  let totalSize = 0;
  const textEncoder = new TextEncoder(); // For calculating string byte lengths

  records.forEach(record => {
    let recordSize = 3; // Base overhead: TNF/flags (1), Type Length (1), Payload Length (1 byte for short record)

    const typeString = record.recordType === 'mime' && record.mediaType ? record.mediaType : record.recordType;
    recordSize += typeString.length;

    if (record.id) {
      recordSize += record.id.length + 1; // ID Length byte + ID
    }

    let payloadByteLength = 0;
    if (record.data) {
      if (typeof record.data === 'string') {
        // For 'text' and 'url' types, NDEFReader.write encodes string to UTF-8 by default.
        // Encoding specified in record.encoding for 'text' type is handled by the writer.
        payloadByteLength = textEncoder.encode(record.data).length;
      } else if (record.data instanceof ArrayBuffer) {
        payloadByteLength = record.data.byteLength;
      }
      // Add other BufferSource types if necessary (e.g., DataView)
    }
    recordSize += payloadByteLength;

    if (payloadByteLength > 255) {
      recordSize += 3; // Additional 3 bytes for 4-byte payload length field (instead of 1 byte)
    }
    
    // Rough approximation for text record specific overhead (language code)
    // This is highly approximate as actual encoding varies.
    if (record.recordType === 'text' && record.lang) {
        // 1 byte for language code length + length of lang code itself
        recordSize += 1 + textEncoder.encode(record.lang).length;
    }


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
  console.log("Record init received:", recordInit);
  const newRecord: NDEFRecord = {
    recordType: recordInit.recordType,
    mediaType: recordInit.mediaType,
    id: recordInit.id,
  };

  if (recordInit.recordType === "text") {
    newRecord.encoding = recordInit.encoding || "utf-8";
    newRecord.lang = recordInit.lang || "en";
    if (typeof recordInit.data === 'string') {
      const encoder = new TextEncoder(); // encoding for TextEncoder is not standard, use TextDecoder's encoding for consistency if needed
      newRecord.data = encoder.encode(recordInit.data).buffer;
    } else {
      newRecord.data = recordInit.data; // Should be ArrayBuffer already
    }
  } else if (recordInit.recordType === "url") {
    if (typeof recordInit.data === 'string') {
      const encoder = new TextEncoder();
      newRecord.data = encoder.encode(recordInit.data).buffer;
    } else {
      newRecord.data = recordInit.data;
    }
  } else if (recordInit.recordType === "mime") {
    if (typeof recordInit.data === 'string') { // Text input for MIME type
      const encoder = new TextEncoder(); // Or use recordInit.encoding if provided for text-based MIME
      newRecord.data = encoder.encode(recordInit.data).buffer;
      if (recordInit.encoding) newRecord.encoding = recordInit.encoding;
    } else { // File input for MIME type
      newRecord.data = recordInit.data as ArrayBuffer; // Already ArrayBuffer
    }
  } else {
    newRecord.data = recordInit.data as ArrayBuffer;
  }

  scannedTag.value.records.push(newRecord);
  showAddForm.value = false; // Hide form after adding
  console.log("Record added. New records list:", scannedTag.value.records);
}

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
        {{ status.reading ? (status.writing ? 'Scan Paused' : 'Scanning...') : 'Scan Tag' }}
      </button>
      <button
        @click="writeNFC(scannedTag.records)"
        :disabled="!scannedTag.records.length || status.writing"
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
