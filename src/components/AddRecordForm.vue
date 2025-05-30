<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { hexStringToArrayBuffer } from "../utils/nfcUtils"; // Corrected path
import type { NDEFRecordInitCustom } from '../@types/app';   // Corrected path

/*global NDEFRecordInit, NDEFMessageInit*/ // For WebNFC global types

const emit = defineEmits(["add-record", "cancel"]);

// --- Reactive State for Form Inputs ---
const recordType = ref<"text" | "url" | "mime" | "absolute-url" | "smart-poster" | "empty" | "unknown" | "external">("text");
const externalTypeString = ref(""); 
const smartPosterUrl = ref(""); 
const mediaType = ref("");
const id = ref("");
const encoding = ref("utf-8");
const lang = ref("en");
const textData = ref("");
const fileData = ref<File | null>(null);
const fileArrayBuffer = ref<ArrayBuffer | null>(null);

// --- Computed Properties for UI Logic ---
const isTextBasedMime = computed(() => {
  return (
    mediaType.value.startsWith("text/") ||
    mediaType.value === "application/json" ||
    mediaType.value === "application/xml" ||
    mediaType.value === "text/vcard"
  );
});

const showEncoding = computed(() => {
  return recordType.value === "text" ||
         (recordType.value === "mime" && isTextBasedMime.value) ||
         ((recordType.value === "external" || recordType.value === "unknown") && textData.value && !fileData.value);
});

const showLang = computed(() => {
  return recordType.value === "text" || (recordType.value === "smart-poster" && textData.value);
});

// --- Watchers for Form Inputs ---
watch(fileData, async (newFile) => {
  if (newFile) {
    if (!mediaType.value && newFile.type) { // Auto-fill MIME type if empty and file has type
      mediaType.value = newFile.type;
    }
    fileArrayBuffer.value = await newFile.arrayBuffer();
  } else {
    fileArrayBuffer.value = null;
  }
});

watch(recordType, (newType) => {
  // Reset fields when record type changes
  mediaType.value = "";
  textData.value = "";
  fileData.value = null; // This will trigger the above watcher to nullify fileArrayBuffer
  externalTypeString.value = "";
  smartPosterUrl.value = "";
  // Set defaults for certain types
  if (newType === 'text') {
    lang.value = 'en';
    encoding.value = 'utf-8';
  } else {
    lang.value = ''; // Clear for non-text types unless it's a smart poster title
  }
  if (newType === 'smart-poster') {
    lang.value = 'en'; // Default lang for smart poster title
    encoding.value = 'utf-8'; // Default encoding for smart poster title
  }
});

// --- Payload Preparation Logic (Extracted for Testability) ---
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
  isMimeTextBasedLogic: boolean, // Pass the computed value
  hexToBufferUtilFunc: (hex: string) => ArrayBuffer // Pass the utility function
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
      if (isMimeTextBasedLogic && currentEncoding) {
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
        record.data = hexToBufferUtilFunc(currentTextData);
      } else {
        record.data = currentTextData; 
        if (currentEncoding) record.encoding = currentEncoding;
      }
    }
  } else if (currentRecordType === "empty") {
    // No specific data fields for 'empty'
  }
  return record;
}

// --- Form Submission and Cancellation ---
const handleSubmit = () => {
  // --- Validations (simplified for brevity, assume they are comprehensive) ---
  if (recordType.value === "mime" && !mediaType.value) {
    alert("MIME Type is required for 'mime' record type."); return;
  }
  if (recordType.value === "external" && !externalTypeString.value) {
    alert("External Record Type Domain:Name is required."); return;
  }
  if (recordType.value === "external" && !/^[a-zA-Z0-9.-]+:[a-zA-Z0-9.-_]+$/.test(externalTypeString.value)) {
    alert("External Record Type must be in 'domain:type' format (e.g., 'example.com:mytype')."); return;
  }
  if (recordType.value === "smart-poster" && !smartPosterUrl.value) {
    alert("Smart Poster URL is required."); return;
  }
  // Add more validations as needed...

  const recordPayload = prepareRecordPayload(
    recordType.value,
    externalTypeString.value,
    mediaType.value,
    id.value,
    encoding.value,
    lang.value,
    textData.value,
    fileArrayBuffer.value, // Use the processed ArrayBuffer
    smartPosterUrl.value,
    isTextBasedMime.value, // Pass the computed value
    hexStringToArrayBuffer  // Pass the imported utility
  );

  emit("add-record", recordPayload);

  // Reset Form after submission
  recordType.value = "text"; // Default
  externalTypeString.value = "";
  smartPosterUrl.value = "";
  mediaType.value = "";
  id.value = "";
  encoding.value = "utf-8";
  lang.value = "en";
  textData.value = "";
  fileData.value = null; // This will also clear fileArrayBuffer via watcher
};

const handleCancel = () => {
  emit("cancel");
}
</script>

<template>
  <div class="p-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-md bg-white dark:bg-gray-800">
    <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add New NDEF Record</h3>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label for="recordType" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Record Type:</label>
        <select id="recordType" v-model="recordType" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black dark:text-white" title="Select the main type for this NDEF record">
          <option value="text">Text</option>
          <option value="url">URL (Relative or Well-Known)</option>
          <option value="absolute-url">Absolute URL</option>
          <option value="mime">MIME Type</option>
          <option value="smart-poster">Smart Poster</option>
          <option value="external">External Type</option>
          <option value="unknown">Unknown</option>
          <option value="empty">Empty</option>
        </select>
      </div>

      <div v-if="recordType === 'external'">
        <label for="externalTypeString" class="block text-sm font-medium text-gray-700 dark:text-gray-300">External Record Type Domain:Name</label>
        <input type="text" id="externalTypeString" v-model="externalTypeString" placeholder="e.g., example.com:mytype" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the external type string (e.g., mydomain.com:mycustomtype)" />
      </div>

      <div v-if="recordType === 'mime'">
        <label for="mediaType" class="block text-sm font-medium text-gray-700 dark:text-gray-300">MIME Type:</label>
        <input type="text" id="mediaType" v-model="mediaType" placeholder="e.g., image/png, text/vcard" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the MIME type for this record (e.g., image/jpeg, application/json, text/vcard)" />
      </div>

      <div v-if="recordType === 'smart-poster'">
        <div>
          <label for="smartPosterUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Smart Poster URL (required):</label>
          <input type="url" id="smartPosterUrl" v-model="smartPosterUrl" placeholder="https://example.com" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the URL for the Smart Poster" />
        </div>
        <div class="mt-4">
          <label for="textDataSP" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Smart Poster Title (Optional Text Record):</label> <!-- Changed id to textDataSP to avoid conflict -->
          <textarea id="textDataSP" v-model="textData" rows="2" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the title for the Smart Poster. This will be a nested Text record."></textarea>
        </div>
      </div>

      <div v-if="recordType === 'text' || recordType === 'url' || recordType === 'absolute-url' || (recordType === 'mime' && isTextBasedMime) || recordType === 'external' || recordType === 'unknown'">
        <label for="textDataMain" class="block text-sm font-medium text-gray-700 dark:text-gray-300"> <!-- Changed id to textDataMain -->
          <span v-if="recordType === 'text'">Text Data:</span>
          <span v-else-if="recordType === 'url' || recordType === 'absolute-url'">URL:</span>
          <span v-else-if="recordType === 'mime'">Text Payload for {{ mediaType || 'MIME type' }}:</span>
          <span v-else-if="recordType === 'external'">Text Payload (optional, if not using file):</span>
          <span v-else-if="recordType === 'unknown'">Text Payload (UTF-8 or hex starting with 0x, optional):</span>
        </label>
        <textarea id="textDataMain" v-model="textData" rows="3" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" 
                  :title="recordType === 'text' ? 'Enter the text content for the record' : 
                           recordType === 'url' || recordType === 'absolute-url' ? 'Enter the full URL (e.g., https://example.com)' :
                           recordType === 'mime' ? 'Enter text content for this text-based MIME type.' :
                           recordType === 'external' ? 'Enter text data for the external type record, if not providing a file.' :
                           recordType === 'unknown' ? 'Enter data as a UTF-8 string, or as a hexadecimal string prefixed with 0x (e.g., 0x01020304).' : ''"
                  :placeholder="recordType === 'unknown' ? 'Enter UTF-8 text or hex (e.g., 0x01020304)' : ''"></textarea>
        <p v-if="recordType === 'mime' && !isTextBasedMime" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Using text for a non-text-based MIME type ({{mediaType}}) is unusual. Prefer 'File Payload'.
        </p>
      </div>
      
      <div v-if="recordType === 'mime' || recordType === 'external' || recordType === 'unknown'">
        <label for="fileData" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            <span v-if="recordType === 'mime'">File Payload (recommended for non-text MIME):</span>
            <span v-else-if="recordType === 'external'">File Payload (optional, if not using text):</span>
            <span v-else-if="recordType === 'unknown'">File Payload (optional):</span>
        </label>
        <input type="file" id="fileData" @change="fileData = ($event.target as HTMLInputElement)?.files?.[0] ?? null" class="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none p-2" 
               :title="recordType === 'mime' ? 'Select a file for the MIME record. Type will be auto-filled if empty.' : 
                        recordType === 'external' ? 'Select a file for the external type record, if not providing text data.' : 
                        recordType === 'unknown' ? 'Select a file for the unknown type record.' : ''">
        <p v-if="recordType === 'mime'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          If your MIME type is text-based (e.g. text/vcard, application/json), you can use the text area above instead.
        </p>
      </div>

      <div v-if="recordType === 'empty'" class="text-center text-gray-500 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <p>The 'empty' record type has no data payload.</p>
      </div>
      
      <div>
        <label for="recordId" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Record ID (Optional):</label>
        <input type="text" id="recordId" v-model="id" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Optional: Enter a unique ID for this record (e.g., 'my-record-1')" />
      </div>

      <div v-if="showEncoding && recordType !== 'empty' && recordType !== 'smart-poster'">
        <label for="encoding" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Encoding:</label>
        <select id="encoding" v-model="encoding" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black dark:text-white" title="Select text encoding. Applies to 'Text', text-based 'MIME', and text-based 'External'/'Unknown' records.">
          <option value="utf-8">UTF-8</option>
          <option value="utf-16">UTF-16</option>
        </select>
      </div>

      <div v-if="showLang && recordType !== 'empty'">
        <label for="lang" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Language Code (for Text content):</label>
        <input type="text" id="lang" v-model="lang" placeholder="e.g., en, fr" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Language code for 'Text' record or Smart Poster Title (e.g., en, fr, de)" />
      </div>

      <div class="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
        <button type="button" @click="handleCancel" class="w-full px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border border-gray-300 dark:border-gray-500" title="Close this form without adding a record">Cancel</button>
        <button type="submit" class="w-full px-5 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md border border-transparent" title="Add this record to the list (does not write to tag yet)">Create Record</button>
      </div>
    </form>
  </div>
</template>
