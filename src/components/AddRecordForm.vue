<script setup lang="ts">
import { ref, computed, watch } from "vue";

/*global NDEFRecordInit*/

const emit = defineEmits(["add-record", "cancel"]);

const recordType = ref<"text" | "url" | "mime">("text");
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
  return recordType.value === "text" || (recordType.value === "mime" && isTextBasedMime.value);
});

const showLang = computed(() => {
  return recordType.value === "text";
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
  // Defaults
  if (newType === 'text') {
    lang.value = 'en';
    encoding.value = 'utf-8';
  } else {
    lang.value = ''; // lang is only for text
  }
});


const handleSubmit = () => {
  if (recordType.value === "mime" && !mediaType.value) {
    alert("MIME Type is required for 'mime' record type.");
    return;
  }
  if (recordType.value === "mime" && !fileData.value && !textData.value) {
    alert("File or text data is required for 'mime' record type.");
    return;
  }
   if ((recordType.value === "text" || recordType.value === "url") && !textData.value) {
    alert("Payload data is required.");
    return;
  }

  const record: NDEFRecordInit = {
    recordType: recordType.value,
  };

  if (id.value) record.id = id.value;

  if (recordType.value === "text") {
    record.data = textData.value;
    record.encoding = encoding.value;
    record.lang = lang.value;
  } else if (recordType.value === "url") {
    record.data = textData.value;
     // URLs typically don't have lang/encoding in the same way NDEF text records do
  } else if (recordType.value === "mime") {
    record.mediaType = mediaType.value;
    if (fileArrayBuffer.value) {
      record.data = fileArrayBuffer.value;
    } else if (textData.value) {
      // This implies it's a text-based MIME type where user opted for textarea
      record.data = textData.value; // TextEncoder will be used in App.vue if needed
      if (isTextBasedMime.value) {
         record.encoding = encoding.value;
      }
    }
  }

  emit("add-record", record);
  // Reset form or specific fields after emitting
  recordType.value = "text";
  mediaType.value = "";
  id.value = "";
  encoding.value = "utf-8";
  lang.value = "en";
  textData.value = "";
  fileData.value = null;
  fileArrayBuffer.value = null;
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
        <select id="recordType" v-model="recordType" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black dark:text-white" title="Select the main type for this NDEF record (e.g., Text, URL, or a custom MIME type)">
          <option value="text">Text</option>
          <option value="url">URL</option>
          <option value="mime">MIME Type</option>
        </select>
      </div>

      <div v-if="recordType === 'mime'">
        <label for="mediaType" class="block text-sm font-medium text-gray-700 dark:text-gray-300">MIME Type:</label>
        <input type="text" id="mediaType" v-model="mediaType" placeholder="e.g., image/png, text/vcard" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Enter the MIME type for this record (e.g., image/jpeg, application/json, text/vcard)" />
      </div>

      <div v-if="recordType === 'text' || recordType === 'url'">
        <label for="textData" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ recordType === 'text' ? 'Text Data:' : 'URL:' }}
        </label>
        <textarea id="textData" v-model="textData" rows="3" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" :title="recordType === 'text' ? 'Enter the text content for the record' : 'Enter the full URL (e.g., https://example.com)'"></textarea>
      </div>

      <div v-if="recordType === 'mime'">
        <label for="fileData" class="block text-sm font-medium text-gray-700 dark:text-gray-300">File Payload:</label>
        <input type="file" id="fileData" @change="fileData = ($event.target as HTMLInputElement)?.files?.[0] ?? null" class="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none p-1" title="Select a file to use as the record payload. MIME type field above will be auto-filled if empty.">
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">If your MIME type is text-based (e.g. text/vcard, application/json), you can use the text area below instead.</p>
        <label for="mimeTextData" class="mt-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Or Text Payload for MIME type:</label>
        <textarea id="mimeTextData" v-model="textData" rows="3" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" :placeholder="`Enter text data if ${mediaType || 'your MIME type'} is text-based`" title="Enter text content if this is a text-based MIME type (e.g., application/json, text/xml). This will be used if no file is selected."></textarea>
      </div>
      
      <div>
        <label for="recordId" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Record ID (Optional):</label>
        <input type="text" id="recordId" v-model="id" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Optional: Enter a unique ID for this record (e.g., 'my-record-1')" />
      </div>

      <div v-if="showEncoding">
        <label for="encoding" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Encoding:</label>
        <select id="encoding" v-model="encoding" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black dark:text-white" title="Select the text encoding (e.g., utf-8, utf-16). Applies to 'Text' records and text-based 'MIME' records.">
          <option value="utf-8">UTF-8</option>
          <option value="utf-16">UTF-16</option>
          <!-- Add other relevant encodings if necessary -->
        </select>
      </div>

      <div v-if="showLang">
        <label for="lang" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Language Code:</label>
        <input type="text" id="lang" v-model="lang" placeholder="e.g., en, fr" class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm text-black dark:text-white bg-white dark:bg-gray-700" title="Optional: Enter language code for 'Text' records (e.g., en, fr, de)" />
      </div>

      <div class="flex justify-end space-x-3">
        <button type="button" @click="handleCancel" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border border-gray-300 dark:border-gray-500" title="Close this form without adding a record">Cancel</button>
        <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md border border-transparent" title="Add this record to the list (does not write to tag yet)">Create Record</button>
      </div>
    </form>
  </div>
</template>
