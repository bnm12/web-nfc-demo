<script setup lang="ts">
import { ref, computed, watch } from "vue";

/*global NDEFRecordInit*/
/*global NDEFMessageInit*/ // For Smart Poster

const emit = defineEmits(["add-record", "cancel"]);

const recordType = ref<"text" | "url" | "mime" | "absolute-url" | "smart-poster" | "empty" | "unknown" | "external">("text");
const externalTypeString = ref(""); // For 'external' record type
const smartPosterUrl = ref(""); // For 'smart-poster' URL part, added this ref
const mediaType = ref("");
const id = ref("");
const encoding = ref("utf-8");
const lang = ref("en");
const textData = ref("");
const fileData = ref<File | null>(null);
const fileArrayBuffer = ref<ArrayBuffer | null>(null);

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
         ((recordType.value === "external" || recordType.value === "unknown") && textData.value && !fileData.value); // Show if text data is primary for external/unknown
});

const showLang = computed(() => {
  // Lang is typically for 'text' records, including the title of a smart poster.
  return recordType.value === "text" || (recordType.value === "smart-poster" && textData.value);
});

watch(fileData, async (newFile) => {
  if (newFile) {
    if (!mediaType.value && newFile.type) {
      mediaType.value = newFile.type;
    }
    fileArrayBuffer.value = await newFile.arrayBuffer();
  } else {
    fileArrayBuffer.value = null;
  }
});

watch(recordType, (newType) => {
  // Reset fields when record type changes to avoid inconsistent states
  mediaType.value = "";
  textData.value = "";
  fileData.value = null;
  fileArrayBuffer.value = null;
  externalTypeString.value = "";
  smartPosterUrl.value = "";
  // Defaults
  if (newType === 'text') {
    lang.value = 'en';
    encoding.value = 'utf-8';
  } else {
    lang.value = ''; 
  }
  if (newType === 'smart-poster') {
    lang.value = 'en'; // Default lang for title
  }
});

// Helper to convert hex string to ArrayBuffer
function hexStringToArrayBuffer(hexString: string): ArrayBuffer {
  const hex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  if (hex.length % 2 !== 0) {
    console.warn("Hex string has an odd length, appending 0 to the end.");
  }
  const typedArray = new Uint8Array(Math.max(1, Math.ceil(hex.length / 2))); // Ensure at least 1 byte for empty string case
  for (let i = 0; i < hex.length; i += 2) {
    typedArray[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return typedArray.buffer;
}


const handleSubmit = () => {
  // --- Validations ---
  if (recordType.value === "mime") {
    if (!mediaType.value) {
      alert("MIME Type is required for 'mime' record type.");
      return;
    }
    if (!fileData.value && !textData.value) {
      alert("File or text data is required for 'mime' record type.");
      return;
    }
  } else if (recordType.value === "external") {
    if (!externalTypeString.value) {
      alert("External Record Type Domain:Name is required.");
      return;
    }
    // Basic validation for "domain:type" format. More strict regex could be used.
    if (!/^[a-zA-Z0-9.-]+:[a-zA-Z0-9.-_]+$/.test(externalTypeString.value)) {
        alert("External Record Type must be in 'domain:type' format (e.g., 'example.com:mytype').");
        return;
    }
    if (!fileData.value && !textData.value) {
      alert("Payload data (text or file) is required for 'external' record type.");
      return;
    }
  } else if (recordType.value === "smart-poster") {
    if (!smartPosterUrl.value) {
      alert("Smart Poster URL is required.");
      return;
    }
    try {
      new URL(smartPosterUrl.value); // Validate URL format
    } catch (e) {
      alert("Invalid Smart Poster URL format.");
      return;
    }
  } else if (recordType.value === "text" || recordType.value === "url" || recordType.value === "absolute-url") {
    if (!textData.value) {
      alert("Payload data is required for this record type.");
      return;
    }
  } else if (recordType.value === "unknown") {
    if (!fileData.value && !textData.value) {
      alert("Payload data (text or file) is required for 'unknown' record type.");
      return;
    }
    if (textData.value && textData.value.startsWith("0x") && (textData.value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(textData.value.slice(2)))) {
      alert("Hexadecimal payload for 'unknown' type must be valid hex (e.g., 0x010A2B) and have an even number of digits after '0x'.");
      return;
    }
  }

  const record: any = { // Use 'any' for flexibility, will be NDEFRecordInit before emit
    recordType: recordType.value,
  };

  if (id.value) record.id = id.value;

  // --- Type-Specific Logic ---
  if (recordType.value === "text") {
    record.data = textData.value;
    record.encoding = encoding.value || "utf-8";
    record.lang = lang.value || "en";
  } else if (recordType.value === "url" || recordType.value === "absolute-url") {
    record.data = textData.value;
    // For 'url' and 'absolute-url', encoding/lang are not part of the NDEF spec for the record itself.
    // They are relevant if the URL *points* to text content, but not for the URL record.
  } else if (recordType.value === "mime") {
    record.mediaType = mediaType.value;
    if (fileArrayBuffer.value) {
      record.data = fileArrayBuffer.value;
    } else { // textData must exist due to validation
      record.data = textData.value; // Will be encoded by NDEFRecord constructor or later
      if (isTextBasedMime.value && encoding.value) {
         record.encoding = encoding.value;
      }
    }
  } else if (recordType.value === "smart-poster") {
    const nestedRecords: NDEFRecordInit[] = [
      { recordType: "url", data: smartPosterUrl.value } // URL record is mandatory
    ];
    if (textData.value) { // Optional title text record
      nestedRecords.push({ recordType: "text", data: textData.value, lang: lang.value || "en", encoding: "utf-8" });
    }
    // Potentially add other records like action records here in the future
    record.data = { records: nestedRecords } as NDEFMessageInit;
    // Smart Poster itself does not have lang/encoding fields.
  } else if (recordType.value === "external") {
    record.recordType = externalTypeString.value; // This is key for external types
    if (fileArrayBuffer.value) {
      record.data = fileArrayBuffer.value;
    } else { // textData must exist
      record.data = textData.value;
      // If it's a text-based external type, allow encoding
      if (encoding.value) record.encoding = encoding.value;
    }
  } else if (recordType.value === "unknown") {
    if (fileArrayBuffer.value) {
      record.data = fileArrayBuffer.value;
    } else { // textData must exist
      if (textData.value.startsWith("0x")) {
        record.data = hexStringToArrayBuffer(textData.value);
      } else {
        record.data = textData.value; // Pass as string, NDEFRecord constructor handles UTF-8 encoding
        // If encoding is specified and it's not default UTF-8, that's a bit ambiguous for 'unknown'
        // but we can pass it if the user selected something.
        if (encoding.value) record.encoding = encoding.value;
      }
    }
  } else if (recordType.value === "empty") {
    // No data, mediaType, encoding, lang for 'empty' type
    // record.data will be undefined, which is correct.
  }

  emit("add-record", record as NDEFRecordInit);

  // --- Reset Form ---
  recordType.value = "text"; // Default
  mediaType.value = "";
  id.value = "";
  encoding.value = "utf-8";
  lang.value = "en";
  textData.value = "";
  fileData.value = null;
  // fileArrayBuffer is reset by watch(fileData)
  externalTypeString.value = "";
  smartPosterUrl.value = "";
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

      <!-- Smart Poster Inputs -->
      <div v-if="recordType === 'smart-poster'">
        <div>
          <label for="smartPosterUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Smart Poster URL (required):</label>
          <input type="url" id="smartPosterUrl" v-model="smartPosterUrl" placeholder="https://example.com" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the URL for the Smart Poster" />
        </div>
        <div class="mt-4">
          <label for="textData" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Smart Poster Title (Optional Text Record):</label>
          <textarea id="textData" v-model="textData" rows="2" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the title for the Smart Poster. This will be a nested Text record."></textarea>
        </div>
      </div>

      <!-- Text Data Input for Text, URL, Absolute URL, and as an option for MIME, External, Unknown -->
      <div v-if="recordType === 'text' || recordType === 'url' || recordType === 'absolute-url' || (recordType === 'mime' && isTextBasedMime) || recordType === 'external' || recordType === 'unknown'">
        <label for="textData" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span v-if="recordType === 'text'">Text Data:</span>
          <span v-else-if="recordType === 'url' || recordType === 'absolute-url'">URL:</span>
          <span v-else-if="recordType === 'mime'">Text Payload for {{ mediaType || 'MIME type' }}:</span>
          <span v-else-if="recordType === 'external'">Text Payload (optional, if not using file):</span>
          <span v-else-if="recordType === 'unknown'">Text Payload (UTF-8 or hex starting with 0x, optional):</span>
        </label>
        <textarea id="textData" v-model="textData" rows="3" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" 
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
      
      <!-- File Data Input for MIME, External, Unknown -->
      <div v-if="recordType === 'mime' || recordType === 'external' || recordType === 'unknown'">
        <label for="fileData" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            <span v-if="recordType === 'mime'">File Payload (recommended for non-text MIME):</span>
            <span v-else-if="recordType === 'external'">File Payload (optional, if not using text):</span>
            <span v-else-if="recordType === 'unknown'">File Payload (optional):</span>
        </label>
        <input type="file" id="fileData" @change="fileData = ($event.target as HTMLInputElement)?.files?.[0] ?? null" class="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none p-1" 
               :title="recordType === 'mime' ? 'Select a file for the MIME record. Type will be auto-filled if empty.' : 
                        recordType === 'external' ? 'Select a file for the external type record, if not providing text data.' : 
                        recordType === 'unknown' ? 'Select a file for the unknown type record.' : ''">
        <p v-if="recordType === 'mime'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          If your MIME type is text-based (e.g. text/vcard, application/json), you can use the text area above instead.
        </p>
      </div>

      <!-- No data inputs for 'empty' type -->
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
          <!-- Add other relevant encodings if necessary -->
        </select>
      </div>

      <div v-if="showLang && recordType !== 'empty'">
         <!-- For Smart Poster, lang applies to the Title (textData) -->
        <label for="lang" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Language Code (for Text content):</label>
        <input type="text" id="lang" v-model="lang" placeholder="e.g., en, fr" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Language code for 'Text' record or Smart Poster Title (e.g., en, fr, de)" />
      </div>

      <div class="flex justify-end space-x-3">
        <button type="button" @click="handleCancel" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border border-gray-300 dark:border-gray-500" title="Close this form without adding a record">Cancel</button>
        <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md border border-transparent" title="Add this record to the list (does not write to tag yet)">Create Record</button>
      </div>
    </form>
  </div>
</template>
